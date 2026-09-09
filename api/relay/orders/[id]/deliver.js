import { assertOrderAssignedToRelay, requireRelay } from "../../../_lib/auth.js";
import { json, methodGuard, readJsonBody, withErrors } from "../../../_lib/http.js";
import { getOrder } from "../../../_lib/orderState.js";
import { completeProof, createProofUploadUrl } from "../../../_lib/proof.js";
import { verifyProof } from "../../../_lib/verification.js";
import { STATUS } from "../../../../shared/orderStatus.js";

/**
 * The relay records the handover. Same two-step shape as the receipt:
 *
 *   POST { contentType }                            -> { uploadUrl, path }
 *   POST { path, complete: true, recipientMessage } -> PURCHASED becomes DELIVERED
 *
 * The automatic check runs on completion so the org has a verdict waiting when
 * they open the review. It does not decide anything — the org approves, and
 * only then does the donor see a verified badge.
 */
export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, "POST")) return;
  const relay = await requireRelay(req);

  const orderId = req.query.id;
  const order = await getOrder(orderId);
  assertOrderAssignedToRelay(order, relay.relayId);

  const {
    contentType = "image/jpeg", path, complete, recipientMessage, recipientConsent,
  } = readJsonBody(req);

  if (!complete) {
    return json(res, 200, await createProofUploadUrl(orderId, contentType));
  }

  await completeProof(orderId, path, relay.actor, { recipientMessage, recipientConsent });

  // Best-effort: a failed check must not lose a delivery the relay has already
  // made. verifyProof records its own error state and the org reviews anyway.
  let verification = null;
  try {
    verification = await verifyProof(orderId);
  } catch (err) {
    console.error(`Verification failed for ${orderId}:`, err);
  }

  json(res, 200, {
    orderId,
    status: STATUS.DELIVERED,
    verification,
    message: "Submitted. Your organisation will review it.",
  });
});
