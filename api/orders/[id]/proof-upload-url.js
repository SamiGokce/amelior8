import { requireUser } from "../../_lib/auth.js";
import { HttpError, json, methodGuard, readJsonBody, withErrors } from "../../_lib/http.js";
import { completeProof, createProofUploadUrl } from "../../_lib/proof.js";
import { getOrder } from "../../_lib/orderState.js";
import { verifyProof } from "../../_lib/verification.js";

/**
 * Facilitator-facing proof upload. The GR8 app will call this.
 *
 * It requires a `role: "facilitator"` custom claim, which nobody holds yet —
 * that is deliberate. Until the GR8 app exists, ops uploads on a facilitator's
 * behalf through /api/ops/orders/[id]/proof-upload-url, which shares the same
 * implementation.
 */
export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, "POST")) return;

  const user = await requireUser(req);
  if (user.role !== "facilitator") {
    throw new HttpError(403, "Not authorised.", "forbidden");
  }

  const orderId = req.query.id;
  const { contentType = "image/jpeg", path, complete } = readJsonBody(req);

  const order = await getOrder(orderId);
  if (order.facilitatorId !== user.facilitatorId) {
    throw new HttpError(403, "This gift is assigned to another GR8.", "not_your_order");
  }

  const actor = { kind: "facilitator", id: user.facilitatorId || user.uid };

  if (complete) {
    const updated = await completeProof(orderId, path, actor);
    const verification = await verifyProof(orderId);
    return json(res, 200, { orderId, status: updated.status, verification });
  }

  json(res, 200, await createProofUploadUrl(orderId, contentType, actor));
});
