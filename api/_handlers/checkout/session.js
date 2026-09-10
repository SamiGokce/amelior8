import { FieldValue, adminDb } from "../../_lib/admin.js";
import { requireUser } from "../../_lib/auth.js";
import { HttpError, json, methodGuard, readJsonBody, withErrors } from "../../_lib/http.js";
import { reserveOrderId } from "../../_lib/ids.js";
import { stripe } from "../../_lib/stripe.js";
import { assertCanReceiveFunds } from "../../_lib/connect.js";
import { STATUS } from "../../../shared/orderStatus.js";
import { VERIFICATION_FEE_USD_CENTS, priceBreakdown } from "../../../shared/fees.js";

/**
 * Creates the order (PENDING_PAYMENT) and a Stripe Checkout Session.
 *
 * The price is read from Firestore and computed here. The client sends an item
 * id and a quantity — never an amount.
 *
 * The charge is a destination charge against the partner's own connected
 * account: the gift price and the partner's half of the verification fee
 * settle with them, and our half is taken as a Stripe application fee. Amelior8
 * never holds the donor's money.
 */
export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, "POST")) return;

  const user = await requireUser(req);
  if (!user.email_verified) {
    throw new HttpError(403, "Please verify your email address before giving.", "email_unverified");
  }

  const { itemId, mode = "payment", quantity = 1 } = readJsonBody(req);
  if (!itemId) throw new HttpError(400, "itemId is required.", "missing_item");
  if (mode !== "payment" && mode !== "subscription") {
    throw new HttpError(400, "mode must be 'payment' or 'subscription'.", "bad_mode");
  }

  const db = adminDb();

  const itemSnap = await db.collection("giftItems").doc(itemId).get();
  if (!itemSnap.exists) throw new HttpError(404, "That gift is no longer listed.", "item_not_found");
  const item = itemSnap.data();
  if (item.available === false) {
    throw new HttpError(409, "That gift is currently unavailable.", "item_unavailable");
  }

  const [partnerSnap, countrySnap] = await Promise.all([
    db.collection("partners").doc(item.partnerId).get(),
    db.collection("countries").doc(item.countryCode).get(),
  ]);
  if (!partnerSnap.exists) {
    throw new HttpError(409, "This gift's partner is not available.", "partner_missing");
  }
  const partner = { partnerId: item.partnerId, ...partnerSnap.data() };

  // No order may exist against a partner who cannot receive the funds.
  assertCanReceiveFunds(partner);

  const price = priceBreakdown(item, quantity, VERIFICATION_FEE_USD_CENTS);
  const orderId = await reserveOrderId(db);
  const base = process.env.APP_BASE_URL || `https://${req.headers.host}`;

  // Snapshots are taken now and never updated — a later price change must not
  // rewrite what this donor was charged or promised.
  const order = {
    orderId,
    donorUid: user.uid,
    donorEmail: user.email,
    donorName: user.name || user.email,

    itemId,
    itemSnapshot: {
      name: item.name,
      description: item.description || "",
      category: item.category,
      imageUrl: item.imageUrl || null,
      priceUsdCents: item.priceUsdCents,
      estimatedDeliveryDays: item.estimatedDeliveryDays || null,
    },
    partnerId: item.partnerId,
    partnerSnapshot: {
      name: partner.name,
      location: partner.location || null,
      registrationNumber: partner.registrationNumber || null,
      verified: !!partner.verified,
      stripeAccountId: partner.stripeAccountId,
    },
    countryCode: item.countryCode,
    countrySnapshot: countrySnap.exists
      ? { code: countrySnap.id, name: countrySnap.data().name }
      : { code: item.countryCode, name: item.countryCode },

    quantity: price.quantity,
    // The gift price, 100% of which goes to the partner.
    giftAmount: price.giftAmount,
    // Flat per-order fee, split evenly. platformFee is our application fee;
    // partnerFeeShare rides the destination transfer and is reconciled monthly.
    verificationFee: price.verificationFee,
    platformFee: price.platformFee,
    partnerFeeShare: price.partnerFeeShare,
    transferToPartner: price.transferToPartner,
    totalCharged: price.totalCharged,
    currency: "USD",

    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    paymentStatus: "pending",
    subscriptionId: null,

    status: STATUS.PENDING_PAYMENT,
    stageTimestamps: {},
    relayId: null,
    relaySnapshot: null,
    recipientRef: null,
    estimatedDeliveryAt: null,

    proofPhotoPath: null,
    verification: { state: "none", method: null, score: null, reasons: [], reviewedBy: null, reviewedAt: null },

    // The partner's half of the verification fee. It has already moved to them
    // in the destination transfer; this accrues for the monthly reconciliation
    // in `payouts`, which is keyed by partner, not by relay. No money is ever
    // owed to an individual relay through this system.
    partnerEarning: { amountUsdCents: price.partnerFeeShare, status: "accrued", payoutId: null },

    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    cancelledAt: null,
    _reserved: FieldValue.delete(),
  };

  await db.collection("orders").doc(orderId).set(order, { merge: true });

  const productName = `${item.name} — ${partner.name}`;
  const recurring = mode === "subscription" ? { recurring: { interval: "month" } } : {};

  // Two line items, not one blended total. The donor sees what the gift costs
  // and what verified delivery costs, separately, in Stripe's own checkout.
  const lineItems = [
    {
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: price.giftAmount,
        ...recurring,
        product_data: {
          name: mode === "subscription" ? `${productName} (monthly)` : productName,
          description: `Your gift${price.quantity > 1 ? `, x${price.quantity}` : ""} — delivered in ${order.countrySnapshot.name}`,
        },
      },
    },
    {
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: price.verificationFee,
        ...recurring,
        product_data: {
          name: "Verified delivery",
          description: "A local relay buys the gift, hands it over in person, and photographs the handover.",
        },
      },
    },
  ];

  // A destination charge: the money settles with the partner's connected
  // account and Stripe takes our application fee out of it. Subscriptions can
  // only express the fee as a percentage, so it is derived from the same split
  // rather than hardcoded — a cent of rounding either way on renewals.
  const applicationFeePercent = Number(((price.platformFee / price.totalCharged) * 100).toFixed(4));

  const session = await stripe().checkout.sessions.create({
    mode,
    line_items: lineItems,
    customer_email: user.email,
    client_reference_id: orderId,
    // Read back by the webhook to find the order this payment belongs to.
    metadata: { orderId, itemId, donorUid: user.uid, quantity: String(price.quantity) },
    ...(mode === "subscription"
      ? {
          subscription_data: {
            metadata: { orderId, itemId, donorUid: user.uid },
            application_fee_percent: applicationFeePercent,
            transfer_data: { destination: partner.stripeAccountId },
          },
        }
      : {
          payment_intent_data: {
            metadata: { orderId, donorUid: user.uid, partnerId: partner.partnerId },
            application_fee_amount: price.platformFee,
            transfer_data: { destination: partner.stripeAccountId },
          },
        }),
    success_url: `${base}/checkout/success?order=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/gift/${itemId}?cancelled=1`,
  });

  await db.collection("orders").doc(orderId).update({
    stripeCheckoutSessionId: session.id,
    updatedAt: FieldValue.serverTimestamp(),
  });

  json(res, 200, { orderId, checkoutUrl: session.url, sessionId: session.id });
});
