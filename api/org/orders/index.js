import { adminDb } from "../../_lib/admin.js";
import { requireOrg } from "../../_lib/auth.js";
import { json, methodGuard, withErrors } from "../../_lib/http.js";
import { STATUS } from "../../../shared/orderStatus.js";

const iso = (t) => t?.toDate?.()?.toISOString() || null;

// Anything paid for but not yet finished is the org's to act on. PENDING_PAYMENT
// is excluded — an unpaid order is not their problem.
const OPEN = [
  STATUS.FUNDED, STATUS.ASSIGNED, STATUS.PURCHASED,
  STATUS.DELIVERED, STATUS.PROOF_REJECTED, STATUS.ON_HOLD,
];

/**
 * The org's own work queue. Scoped to their partnerId by the token — an org
 * cannot list another org's gifts.
 *
 *   ?view=unassigned  gifts waiting for a relay
 *   ?view=review      deliveries waiting for their decision
 *   ?view=open        everything in flight (default)
 *   ?view=all         including finished
 *   ?relayId=...      what one relay is currently holding
 */
export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, "GET")) return;
  const org = await requireOrg(req);

  const { view = "open", relayId, limit = "100" } = req.query;
  const cap = Math.min(200, parseInt(limit, 10) || 100);

  let q = adminDb().collection("orders").where("partnerId", "==", org.partnerId);

  if (view === "unassigned") q = q.where("status", "==", STATUS.FUNDED);
  else if (view === "review") q = q.where("status", "==", STATUS.DELIVERED);
  else if (relayId) q = q.where("relayId", "==", relayId);

  const snap = await q.limit(cap).get();

  let orders = snap.docs
    .filter((d) => !d.data()._reserved)
    .map((d) => {
      const o = d.data();
      return {
        id: d.id,
        status: o.status,
        item: o.itemSnapshot?.name || null,
        itemDescription: o.itemSnapshot?.description || null,
        category: o.itemSnapshot?.category || null,
        quantity: o.quantity || 1,
        giftAmount: o.giftAmount,
        verificationFee: o.verificationFee,
        partnerFeeShare: o.partnerFeeShare,
        country: o.countrySnapshot?.name || o.countryCode,
        relayId: o.relayId || null,
        relay: o.relaySnapshot?.name || null,
        recipient: o.recipient || null,
        purchase: o.purchase
          ? {
              amountPaidUsdCents: o.purchase.amountPaidUsdCents,
              overBudget: !!o.purchase.overBudget,
              varianceUsdCents: o.purchase.varianceUsdCents,
              submittedAt: iso(o.purchase.submittedAt),
            }
          : null,
        verification: o.verification
          ? {
              state: o.verification.state,
              ai: o.verification.ai
                ? {
                    state: o.verification.ai.state,
                    score: o.verification.ai.score,
                    reasons: o.verification.ai.reasons || [],
                    reusedFromOrderId: o.verification.ai.reusedFromOrderId || null,
                  }
                : null,
            }
          : null,
        hasProof: !!o.proofPhotoPath,
        stageTimestamps: Object.fromEntries(
          Object.entries(o.stageTimestamps || {}).map(([k, v]) => [k, iso(v)]),
        ),
        createdAt: iso(o.createdAt),
      };
    });

  if (view === "open") orders = orders.filter((o) => OPEN.includes(o.status));

  // Sorted here rather than in the query, so no composite index is needed for
  // every filter combination.
  orders.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  json(res, 200, {
    orders,
    counts: {
      unassigned: orders.filter((o) => o.status === STATUS.FUNDED).length,
      awaitingReview: orders.filter((o) => o.status === STATUS.DELIVERED).length,
      inFlight: orders.filter((o) => OPEN.includes(o.status)).length,
    },
  });
});
