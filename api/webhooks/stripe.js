import { FieldValue, adminDb } from "../_lib/admin.js";
import { json, methodGuard, withErrors } from "../_lib/http.js";
import { reserveOrderId } from "../_lib/ids.js";
import { stripe } from "../_lib/stripe.js";
import { transitionOrder } from "../_lib/orderState.js";
import { sendOrderEmail } from "../_lib/email.js";
import { syncAccountStatus } from "../_lib/connect.js";
import { STATUS } from "../../shared/orderStatus.js";

// Stripe signs the raw bytes — Vercel's JSON parser would invalidate them.
export const config = { api: { bodyParser: false } };

function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/**
 * Claims an event id before doing any work.
 *
 * Stripe retries deliveries, and a retry must not create a second order or
 * send a second email. `create` fails if the doc already exists, so exactly
 * one delivery ever gets through.
 */
async function claimEvent(event) {
  const ref = adminDb().collection("webhookEvents").doc(event.id);
  try {
    await ref.create({ type: event.type, processedAt: FieldValue.serverTimestamp() });
    return true;
  } catch {
    console.log(`Stripe event ${event.id} already processed — skipping.`);
    return false;
  }
}

/** The order is the source of truth for the donor; the redirect is not. */
async function fundOrder(orderId, { paymentIntentId, subscriptionId }) {
  const patch = { paymentStatus: "succeeded" };
  if (paymentIntentId) patch.stripePaymentIntentId = paymentIntentId;
  if (subscriptionId) patch.subscriptionId = subscriptionId;

  const { changed, order } = await transitionOrder(
    orderId,
    STATUS.FUNDED,
    { kind: "system", id: "stripe" },
    { note: "Payment cleared.", patch },
  );

  if (changed) {
    await sendOrderEmail(STATUS.FUNDED, { ...order, id: orderId });
    await adminDb().collection("users").doc(order.donorUid).set({
      totalGiven: FieldValue.increment(order.totalCharged || 0),
      giftCount: FieldValue.increment(1),
    }, { merge: true });
  }
  return { changed, order };
}

/** A renewal creates a fresh order from the subscription's stored snapshot. */
async function createRenewalOrder(subscriptionId, invoice) {
  const db = adminDb();
  const subSnap = await db.collection("subscriptions").doc(subscriptionId).get();
  if (!subSnap.exists) {
    console.warn(`Renewal for unknown subscription ${subscriptionId} — skipping.`);
    return null;
  }
  const sub = subSnap.data();
  const orderId = await reserveOrderId(db);

  await db.collection("orders").doc(orderId).set({
    ...sub.orderTemplate,
    orderId,
    subscriptionId,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: invoice.payment_intent || null,
    paymentStatus: "succeeded",
    status: STATUS.PENDING_PAYMENT,
    stageTimestamps: {},
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    _reserved: FieldValue.delete(),
  }, { merge: true });

  await db.collection("subscriptions").doc(subscriptionId).update({
    createdOrderIds: FieldValue.arrayUnion(orderId),
    lastChargedAt: FieldValue.serverTimestamp(),
  });

  await fundOrder(orderId, { paymentIntentId: invoice.payment_intent });
  return orderId;
}

async function onCheckoutCompleted(session) {
  const orderId = session.metadata?.orderId || session.client_reference_id;
  if (!orderId) {
    console.warn(`checkout.session.completed with no orderId (${session.id})`);
    return;
  }

  if (session.mode === "subscription" && session.subscription) {
    const db = adminDb();
    const orderSnap = await db.collection("orders").doc(orderId).get();
    const order = orderSnap.data() || {};

    // Template for every future renewal. Snapshots are frozen at signup.
    const { createdAt, updatedAt, ...template } = order;
    await db.collection("subscriptions").doc(session.subscription).set({
      subscriptionId: session.subscription,
      donorUid: order.donorUid,
      donorEmail: order.donorEmail,
      stripeSubscriptionId: session.subscription,
      itemId: order.itemId,
      itemSnapshot: order.itemSnapshot,
      amountUsdCents: order.totalCharged,
      interval: "month",
      status: "active",
      orderTemplate: {
        ...template,
        stripeCheckoutSessionId: null,
        stripePaymentIntentId: null,
        proofPhotoPath: null,
        relayId: null,
        relaySnapshot: null,
        verification: { state: "none", method: null, score: null, reasons: [], reviewedBy: null, reviewedAt: null },
        cancelledAt: null,
      },
      createdOrderIds: [orderId],
      createdAt: FieldValue.serverTimestamp(),
      cancelledAt: null,
    }, { merge: true });
  }

  await fundOrder(orderId, {
    paymentIntentId: session.payment_intent,
    subscriptionId: session.subscription,
  });
}

async function onInvoicePaid(invoice) {
  // The first invoice is the signup itself — checkout.session.completed already
  // created and funded that order. Only later cycles make a new one.
  if (invoice.billing_reason !== "subscription_cycle") return;
  if (!invoice.subscription) return;
  await createRenewalOrder(invoice.subscription, invoice);
}

async function onPaymentFailed(paymentIntent) {
  const orderId = paymentIntent.metadata?.orderId;
  if (!orderId) return;
  await transitionOrder(orderId, STATUS.PAYMENT_FAILED, { kind: "system", id: "stripe" }, {
    note: paymentIntent.last_payment_error?.message || "Payment failed.",
    patch: { paymentStatus: "failed" },
  });
}

async function onChargeRefunded(charge) {
  const db = adminDb();
  const found = await db.collection("orders")
    .where("stripePaymentIntentId", "==", charge.payment_intent)
    .limit(1)
    .get();
  if (found.empty) {
    console.warn(`Refund for unknown payment intent ${charge.payment_intent}`);
    return;
  }

  const orderId = found.docs[0].id;
  const order = found.docs[0].data();

  // A refund can land on an order at any stage, so cancel first when needed —
  // transitionOrder refuses to skip.
  if (order.status !== STATUS.CANCELLED && order.status !== STATUS.REFUNDED) {
    await transitionOrder(orderId, STATUS.CANCELLED, { kind: "system", id: "stripe" }, {
      note: "Refunded in Stripe.",
    });
  }
  const { changed, order: updated } = await transitionOrder(
    orderId,
    STATUS.REFUNDED,
    { kind: "system", id: "stripe" },
    { note: "Refund settled.", patch: { paymentStatus: "refunded" } },
  );
  if (changed) await sendOrderEmail(STATUS.REFUNDED, { ...order, ...updated, id: orderId });
}

/**
 * A partner's Connect account changed. This is what flips onboardingComplete,
 * and it can also flip it back — Stripe disables accounts when requirements
 * fall due, and a partner who cannot receive money must stop taking gifts.
 */
async function onAccountUpdated(account) {
  const partnerId = account.metadata?.partnerId;
  if (!partnerId) {
    console.warn(`account.updated for ${account.id} with no partnerId in metadata`);
    return;
  }
  const { onboardingComplete } = await syncAccountStatus(partnerId, account);
  console.log(`Connect account for ${partnerId}: onboardingComplete=${onboardingComplete}`);
}

async function onSubscriptionDeleted(subscription) {
  await adminDb().collection("subscriptions").doc(subscription.id).set({
    status: "cancelled",
    cancelledAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

/**
 * A recurring gift's renewal charge failed (card expired, insufficient
 * funds). Stripe will retry on its own schedule; this just makes the
 * subscription's real state visible instead of it silently stalling.
 */
async function onInvoicePaymentFailed(invoice) {
  if (!invoice.subscription) return;
  await adminDb().collection("subscriptions").doc(invoice.subscription).set({
    status: "payment_failed",
    lastPaymentFailedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  console.error(`Recurring gift renewal failed for subscription ${invoice.subscription}`);
}

/**
 * The transfer half of a destination charge failed to reach the partner —
 * the donor was charged but the money never arrived. This can only happen
 * after the charge itself succeeded, so there is no order transition that
 * is safe to make automatically; it needs a human to look at it, same as
 * any other dispute. Logged loudly so it surfaces instead of vanishing.
 */
async function onTransferFailed(transfer) {
  console.error(
    `Transfer ${transfer.id} to account ${transfer.destination} failed — ` +
    `charge ${transfer.source_transaction || "unknown"}. Needs manual review.`,
  );
}

/** A partner's payout to their own bank failed on Stripe's side. */
async function onPayoutFailed(payout, account) {
  console.error(
    `Payout ${payout.id} failed for connected account ${account} — ` +
    `${payout.failure_message || payout.failure_code || "no reason given"}.`,
  );
}

export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, "POST")) return;

  // Connect events are delivered to a separate endpoint in Stripe, which gets
  // its own signing secret. Both are accepted here so one handler serves both.
  const secrets = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
  ].filter(Boolean);

  if (secrets.length === 0) {
    console.error("No Stripe webhook secret is set — refusing to trust this request.");
    return json(res, 503, { error: "Webhook not configured.", code: "not_configured" });
  }

  const body = await rawBody(req);
  const signature = req.headers["stripe-signature"];
  let event = null;
  for (const secret of secrets) {
    try {
      event = stripe().webhooks.constructEvent(body, signature, secret);
      break;
    } catch {
      // Try the next secret before giving up.
    }
  }
  if (!event) {
    console.error("Stripe signature verification failed against every configured secret.");
    return json(res, 400, { error: "Invalid signature.", code: "bad_signature" });
  }

  if (!(await claimEvent(event))) {
    return json(res, 200, { received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": await onCheckoutCompleted(event.data.object); break;
      case "invoice.paid": await onInvoicePaid(event.data.object); break;
      case "invoice.payment_failed": await onInvoicePaymentFailed(event.data.object); break;
      case "payment_intent.payment_failed": await onPaymentFailed(event.data.object); break;
      case "charge.refunded": await onChargeRefunded(event.data.object); break;
      case "customer.subscription.deleted": await onSubscriptionDeleted(event.data.object); break;
      case "account.updated": await onAccountUpdated(event.data.object); break;
      case "transfer.failed": await onTransferFailed(event.data.object); break;
      // Connect events carry the connected account id on the event itself.
      case "payout.failed": await onPayoutFailed(event.data.object, event.account); break;
      default: console.log(`Unhandled Stripe event ${event.type}`);
    }
  } catch (err) {
    // Release the claim so Stripe's retry can have another go — otherwise a
    // transient failure would silently drop a paid order.
    console.error(`Failed handling ${event.type} (${event.id}):`, err);
    await adminDb().collection("webhookEvents").doc(event.id).delete().catch(() => {});
    return json(res, 500, { error: "Handler failed.", code: "handler_failed" });
  }

  json(res, 200, { received: true });
});
