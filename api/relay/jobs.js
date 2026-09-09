import { adminDb } from "../_lib/admin.js";
import { requireRelay } from "../_lib/auth.js";
import { json, methodGuard, withErrors } from "../_lib/http.js";
import { STATUS } from "../../shared/orderStatus.js";

const iso = (t) => t?.toDate?.()?.toISOString() || null;

// What a relay still has to do something about.
const OPEN = [STATUS.ASSIGNED, STATUS.PURCHASED, STATUS.PROOF_REJECTED];

/**
 * The relay's own jobs. Scoped to their relayId by the token — a relay can
 * only ever see gifts assigned to them.
 *
 * Everything needed to do the job offline is included in one response: what to
 * buy, the budget, who it is for and where. The app caches this so a relay in
 * a dead spot still knows what they are doing.
 */
export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, "GET")) return;
  const relay = await requireRelay(req);

  const snap = await adminDb()
    .collection("orders")
    .where("relayId", "==", relay.relayId)
    .limit(100)
    .get();

  const all = snap.docs.map((d) => {
    const o = d.data();
    return {
      id: d.id,
      status: o.status,
      item: o.itemSnapshot?.name || null,
      itemDescription: o.itemSnapshot?.description || null,
      category: o.itemSnapshot?.category || null,
      quantity: o.quantity || 1,
      // What they may spend, and what they earn for the delivery.
      budgetUsdCents: o.giftAmount,
      earningUsdCents: o.relayFee,
      recipient: o.recipient || null,
      country: o.countrySnapshot?.name || o.countryCode,
      partner: o.partnerSnapshot?.name || null,
      purchase: o.purchase
        ? {
            amountPaidUsdCents: o.purchase.amountPaidUsdCents,
            submittedAt: iso(o.purchase.submittedAt),
          }
        : null,
      verification: o.verification?.state || "none",
      // A rejection needs to say so plainly, so the relay knows to go again.
      rejectionNote: o.status === STATUS.PROOF_REJECTED
        ? o.verification?.org?.note || o.verification?.ops?.note || null
        : null,
      assignedAt: iso(o.stageTimestamps?.assigned),
      deliveredAt: iso(o.stageTimestamps?.delivered),
    };
  });

  const open = all.filter((o) => OPEN.includes(o.status));
  const awaitingReview = all.filter((o) => o.status === STATUS.DELIVERED);
  const done = all.filter((o) => o.status === STATUS.VERIFIED);

  open.sort((a, b) => (a.assignedAt || "").localeCompare(b.assignedAt || ""));

  json(res, 200, {
    open,
    awaitingReview,
    done: done.slice(0, 25),
    summary: {
      openCount: open.length,
      awaitingReviewCount: awaitingReview.length,
      completedCount: done.length,
      // Accrued, not payable. No payout rail is wired yet and the app says so.
      earnedUsdCents: done.reduce((sum, o) => sum + (o.earningUsdCents || 0), 0),
    },
  });
});
