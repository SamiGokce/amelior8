import { requireOps } from "../../../_lib/auth.js";
import { json, methodGuard, readJsonBody, withErrors } from "../../../_lib/http.js";
import { reviewDelivery } from "../../../_lib/review.js";

/**
 * Amelior8's backstop on a delivery. `id` is the order id.
 *
 * The local org decides every delivery in the normal course; this exists for
 * disputes and for catching a partner who is approving their own relays too
 * freely. It runs through the same reviewDelivery() the org uses, so the audit
 * trail records it identically — just attributed to ops.
 */
export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, "POST")) return;
  const ops = await requireOps(req);

  const { decision, reason = null, note = null } = readJsonBody(req);
  const result = await reviewDelivery(
    req.query.id,
    decision,
    { kind: "ops", id: ops.uid },
    { note: note || reason, isOps: true },
  );

  json(res, 200, result);
});
