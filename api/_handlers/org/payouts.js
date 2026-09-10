import { adminDb } from "../../_lib/admin.js";
import { requireOrg } from "../../_lib/auth.js";
import { json, methodGuard, withErrors } from "../../_lib/http.js";

const iso = (t) => t?.toDate?.()?.toISOString() || null;

/**
 * The org's own reconciliation statements, read-only.
 *
 * Scoped to their partnerId by the token. Shows what their completed
 * deliveries accrued in each period — gift money settles with them per order
 * through Connect, so this is the verification-fee share rather than a debt.
 */
export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, "GET")) return;
  const org = await requireOrg(req);

  const snap = await adminDb()
    .collection("payouts")
    .where("partnerId", "==", org.partnerId)
    .limit(24)
    .get();

  const payouts = snap.docs
    .map((d) => {
      const p = d.data();
      return {
        payoutId: p.payoutId,
        period: p.period,
        amountUsdCents: p.amountUsdCents,
        giftTotalUsdCents: p.giftTotalUsdCents,
        deliveryCount: p.deliveryCount,
        status: p.status,
        lineItems: p.lineItems || [],
        builtAt: iso(p.builtAt),
        paidAt: iso(p.paidAt),
      };
    })
    .sort((a, b) => b.period.localeCompare(a.period));

  json(res, 200, { payouts });
});
