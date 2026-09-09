import { FieldValue, adminDb } from "../_lib/admin.js";
import { requireUser } from "../_lib/auth.js";
import { HttpError, json, methodGuard, readJsonBody, withErrors } from "../_lib/http.js";
import { reserveOrderId } from "../_lib/ids.js";
import { priceBreakdown, stripe } from "../_lib/stripe.js";
import { STATUS } from "../../shared/orderStatus.js";

/**
 * Creates the order (PENDING_PAYMENT) and a Stripe Checkout Session.
 *
 * The price is read from Firestore and computed here. The client sends an
 * item id and a quantity — never an amount.
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
  const partner = partnerSnap.data();

  const price = priceBreakdown(item, quantity);
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
      relayFeeUsdCents: item.relayFeeUsdCents,
      platformFeeUsdCents: item.platformFeeUsdCents,
      estimatedDeliveryDays: item.estimatedDeliveryDays || null,
    },
    partnerId: item.partnerId,
    partnerSnapshot: {
      name: partner.name,
      location: partner.location || null,
      registrationNumber: partner.registrationNumber || null,
      verified: !!partner.verified,
    },
    countryCode: item.countryCode,
    countrySnapshot: countrySnap.exists
      ? { code: countrySnap.id, name: countrySnap.data().name }
      : { code: item.countryCode, name: item.countryCode },

    quantity: price.quantity,
    giftAmount: price.giftAmount,
    relayFee: price.relayFee,
    platformFee: price.platformFee,
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

    // Recorded for the payout system that does not exist yet. Nothing acts on it.
    relayEarning: { amountUsdCents: price.relayFee, status: "accrued", payoutId: null },

    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    cancelledAt: null,
    _reserved: FieldValue.delete(),
  };

  await db.collection("orders").doc(orderId).set(order, { merge: true });

  const productName = `${item.name} — ${partner.name}`;
  const lineItem = mode === "subscription"
    ? {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: price.totalCharged,
          recurring: { interval: "month" },
          product_data: { name: `${productName} (monthly)` },
        },
      }
    : {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: price.totalCharged,
          product_data: {
            name: productName,
            description: `Gift ${price.quantity > 1 ? `x${price.quantity} ` : ""}delivered in ${order.countrySnapshot.name}`,
          },
        },
      };

  const session = await stripe().checkout.sessions.create({
    mode,
    line_items: [lineItem],
    customer_email: user.email,
    client_reference_id: orderId,
    // Read back by the webhook to find the order this payment belongs to.
    metadata: { orderId, itemId, donorUid: user.uid, quantity: String(price.quantity) },
    ...(mode === "subscription"
      ? { subscription_data: { metadata: { orderId, itemId, donorUid: user.uid } } }
      : { payment_intent_data: { metadata: { orderId, donorUid: user.uid } } }),
    success_url: `${base}/checkout/success?order=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/gift/${itemId}?cancelled=1`,
  });

  await db.collection("orders").doc(orderId).update({
    stripeCheckoutSessionId: session.id,
    updatedAt: FieldValue.serverTimestamp(),
  });

  json(res, 200, { orderId, checkoutUrl: session.url, sessionId: session.id });
});
