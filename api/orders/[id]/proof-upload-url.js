import { requireUser } from "../../_lib/auth.js";
import { HttpError, json, methodGuard, readJsonBody, withErrors } from "../../_lib/http.js";
import { completeProof, createProofUploadUrl } from "../../_lib/proof.js";
import { getOrder } from "../../_lib/orderState.js";
import { verifyProof } from "../../_lib/verification.js";

/**
 * Relay-facing proof upload. The relay app will call this.
 *
 * It requires a `role: "relay"` custom claim, which nobody holds yet —
 * that is deliberate. Until the relay app exists, ops uploads on a relay's
 * behalf through /api/ops/orders/[id]/proof-upload-url, which shares the same
 * implementation.
 */
export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, "POST")) return;

  const user = await requireUser(req);
  if (user.role !== "relay") {
    throw new HttpError(403, "Not authorised.", "forbidden");
  }

  const orderId = req.query.id;
  const { contentType = "image/jpeg", path, complete, recipientMessage } = readJsonBody(req);

  const order = await getOrder(orderId);
  if (order.relayId !== user.relayId) {
    throw new HttpError(403, "This gift is assigned to another relay.", "not_your_order");
  }

  const actor = { kind: "relay", id: user.relayId || user.uid };

  if (complete) {
    const updated = await completeProof(orderId, path, actor, { recipientMessage });
    const verification = await verifyProof(orderId);
    return json(res, 200, { orderId, status: updated.status, verification });
  }

  json(res, 200, await createProofUploadUrl(orderId, contentType, actor));
});
