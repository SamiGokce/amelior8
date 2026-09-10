import { requireOps } from "../../../../_lib/auth.js";
import { json, methodGuard, readJsonBody, withErrors } from "../../../../_lib/http.js";
import { completeProof, createProofUploadUrl } from "../../../../_lib/proof.js";
import { verifyProof } from "../../../../_lib/verification.js";

/**
 * Proof upload on a relay's behalf, until the relay app exists.
 *
 *   POST { contentType }        -> { uploadUrl, path }   (then PUT the bytes)
 *   POST { path, complete: true } -> confirms the upload, moves the order to
 *                                    DELIVERED, and runs verification
 *
 * Shares createProofUploadUrl/completeProof with the relay route, so the
 * two can never diverge.
 */
export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, "POST")) return;
  const ops = await requireOps(req);

  const orderId = req.query.id;
  const {
    contentType = "image/jpeg", path, complete, recipientMessage, recipientConsent,
  } = readJsonBody(req);
  const actor = { kind: "ops", id: ops.uid };

  if (complete) {
    const order = await completeProof(orderId, path, actor, { recipientMessage, recipientConsent });
    // Verification runs inline: a donor should not see a bare "delivered" with
    // an unresolved badge for any longer than necessary.
    const result = await verifyProof(orderId);
    return json(res, 200, { orderId, status: order.status, verification: result });
  }

  json(res, 200, await createProofUploadUrl(orderId, contentType, actor));
});
