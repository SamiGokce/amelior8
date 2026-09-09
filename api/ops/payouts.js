import { adminDb } from "../_lib/admin.js";
import { requireOps } from "../_lib/auth.js";
import { HttpError, json, methodGuard, readJsonBody, withErrors } from "../_lib/http.js";
import { buildPayout, periodKey, setPayoutStatus } from "../_lib/payouts.js";

const iso = (t) => t?.toDate?.()?.toISOString() || null;

const shape = (p) => ({
  payoutId: p.payoutId,
  partnerId: p.partnerId,
  period: p.period,
  amountUsdCents: p.amountUsdCents,
  giftTotalUsdCents: p.giftTotalUsdCents,
  deliveryCount: p.deliveryCount,
  status: p.status,
  builtAt: iso(p.builtAt),
  paidAt: iso(p.paidAt),
});

/**
 * Monthly partner reconciliation.
 *
 *   GET  ?period=2026-09            every partner's payout for a period
 *   POST { period, partnerId? }     build or refresh drafts
 *   POST { payoutId, status }       move one through draft -> payable -> paid
 */
export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, ["GET", "POST"])) return;
  const ops = await requireOps(req);
  const db = adminDb();

  if (req.method === "GET") {
    const period = req.query.period || periodKey();
    const snap = await db.collection("payouts").where("period", "==", period).get();
    const payouts = snap.docs.map((d) => shape(d.data()));
    return json(res, 200, {
      period,
      payouts,
      totalUsdCents: payouts.reduce((sum, p) => sum + (p.amountUsdCents || 0), 0),
    });
  }

  const { period = periodKey(), partnerId, payoutId, status, note = null } = readJsonBody(req);
  const actor = { kind: "ops", id: ops.uid };

  if (payoutId && status) {
    return json(res, 200, await setPayoutStatus(payoutId, status, actor, note));
  }

  const partnerIds = partnerId
    ? [partnerId]
    : (await db.collection("partners").where("active", "==", true).get()).docs.map((d) => d.id);

  if (partnerIds.length === 0) {
    throw new HttpError(404, "No active organisations to build payouts for.", "no_partners");
  }

  const built = [];
  for (const id of partnerIds) {
    built.push(shape(await buildPayout(id, period, { actor })));
  }

  json(res, 201, {
    period,
    built: built.length,
    payouts: built,
    totalUsdCents: built.reduce((sum, p) => sum + (p.amountUsdCents || 0), 0),
  });
});
