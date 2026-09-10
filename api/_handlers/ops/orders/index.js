import { adminDb } from "../../../_lib/admin.js";
import { requireOps } from "../../../_lib/auth.js";
import { json, methodGuard, withErrors } from "../../../_lib/http.js";

const iso = (t) => t?.toDate?.()?.toISOString() || null;

/** The ops queue: orders waiting on a human, newest first. */
export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, "GET")) return;
  await requireOps(req);

  const { status, limit = "50" } = req.query;
  // Ordering is dropped when filtering by status so this needs no composite
  // index — the ops queue is small and filtered views are already narrow.
  const q = status
    ? adminDb().collection("orders").where("status", "==", status)
    : adminDb().collection("orders").orderBy("createdAt", "desc");

  const snap = await q.limit(Math.min(200, parseInt(limit, 10) || 50)).get();

  const orders = snap.docs
    .filter((d) => !d.data()._reserved)
    .map((d) => {
      const o = d.data();
      return {
        id: d.id,
        status: o.status,
        donorEmail: o.donorEmail,
        item: o.itemSnapshot?.name,
        partner: o.partnerSnapshot?.name,
        country: o.countrySnapshot?.name || o.countryCode,
        totalCharged: o.totalCharged,
        relay: o.relaySnapshot?.name || null,
        verification: o.verification?.state || "none",
        createdAt: iso(o.createdAt),
      };
    });

  json(res, 200, { orders, count: orders.length });
});
