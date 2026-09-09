import { FieldValue, adminDb } from "./admin.js";
import { HttpError } from "./http.js";
import { STATUS } from "../../shared/orderStatus.js";

/**
 * Monthly reconciliation, keyed by partner organisation.
 *
 * No money is owed to, or paid out to, an individual relay through this
 * system. The partner receives the funds; how they compensate their own people
 * is theirs to decide.
 *
 * Note on what this ledger is: because charges are destination charges, the
 * partner's half of the verification fee has *already* reached their Stripe
 * account at the moment the donor paid. A payout record is therefore a
 * reconciliation statement — what accrued to them in a period — not a debt
 * Amelior8 is holding. The draft/payable/paid lifecycle is kept so it can
 * become a real settlement if the split ever moves off Connect.
 */

/** "2026-09" — the period a payout aggregates. */
export function periodKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function periodBounds(period) {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) {
    throw new HttpError(400, "period must look like 2026-09.", "bad_period");
  }
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

/**
 * Builds (or refreshes) the draft payout for one partner and period.
 *
 * Sums the partner's share of the verification fee across every VERIFIED order
 * whose delivery was verified inside the period. Only orders that actually
 * completed count — an undelivered gift earns nobody anything.
 *
 * A payout already marked `paid` is never rewritten.
 */
export async function buildPayout(partnerId, period = periodKey(), { actor } = {}) {
  const { start, end } = periodBounds(period);
  const db = adminDb();
  const payoutId = `${partnerId}_${period}`;
  const ref = db.collection("payouts").doc(payoutId);

  const existing = await ref.get();
  if (existing.exists && existing.data().status === "paid") {
    return { payoutId, ...existing.data(), unchanged: true };
  }

  const snap = await db.collection("orders")
    .where("partnerId", "==", partnerId)
    .where("status", "==", STATUS.VERIFIED)
    .get();

  const included = [];
  let amountUsdCents = 0;
  let giftTotalUsdCents = 0;

  for (const doc of snap.docs) {
    const o = doc.data();
    const verifiedAt = o.stageTimestamps?.delivered?.toDate?.() || o.updatedAt?.toDate?.();
    if (!verifiedAt || verifiedAt < start || verifiedAt >= end) continue;

    const share = o.partnerEarning?.amountUsdCents ?? o.partnerFeeShare ?? 0;
    amountUsdCents += share;
    giftTotalUsdCents += o.giftAmount || 0;
    included.push({
      orderId: doc.id,
      item: o.itemSnapshot?.name || null,
      relay: o.relaySnapshot?.name || null,
      giftAmountUsdCents: o.giftAmount || 0,
      shareUsdCents: share,
      verifiedAt: verifiedAt.toISOString(),
    });
  }

  included.sort((a, b) => a.verifiedAt.localeCompare(b.verifiedAt));

  const payout = {
    payoutId,
    partnerId,
    period,
    periodStart: start,
    periodEnd: end,
    // The partner's half of the verification fee across the period.
    amountUsdCents,
    // Context, not a payable: gift money settles directly with them per order.
    giftTotalUsdCents,
    orderIds: included.map((o) => o.orderId),
    lineItems: included,
    deliveryCount: included.length,
    status: existing.exists ? existing.data().status : "draft",
    builtAt: FieldValue.serverTimestamp(),
    builtBy: actor?.id || "system",
  };

  await ref.set(payout, { merge: true });
  return { ...payout, unchanged: false };
}

/** draft -> payable -> paid. Forward only, and never off `paid`. */
const PAYOUT_FLOW = { draft: ["payable"], payable: ["paid", "draft"], paid: [] };

export async function setPayoutStatus(payoutId, toStatus, actor, note = null) {
  const ref = adminDb().collection("payouts").doc(payoutId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Payout not found.", "payout_not_found");

  const from = snap.data().status || "draft";
  if (from === toStatus) return { payoutId, status: toStatus, changed: false };

  if (!(PAYOUT_FLOW[from] || []).includes(toStatus)) {
    throw new HttpError(409, `Cannot move a payout from ${from} to ${toStatus}.`, "illegal_transition");
  }

  await ref.update({
    status: toStatus,
    [`${toStatus}At`]: FieldValue.serverTimestamp(),
    [`${toStatus}By`]: actor.id,
    ...(note ? { note } : {}),
  });

  return { payoutId, status: toStatus, changed: true };
}
