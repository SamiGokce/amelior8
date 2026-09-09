import { assertOrderAssignedToRelay, requireRelay } from "../../../_lib/auth.js";
import { json, methodGuard, readJsonBody, withErrors } from "../../../_lib/http.js";
import { getOrder } from "../../../_lib/orderState.js";
import { completeReceipt, createReceiptUploadUrl } from "../../../_lib/proof.js";
import { sendOrderEmail } from "../../../_lib/email.js";
import { STATUS } from "../../../../shared/orderStatus.js";

/**
 * The relay records buying the gift. Two steps, because the photo goes
 * straight to Storage rather than through this function:
 *
 *   POST { contentType }                        -> { uploadUrl, path }
 *   POST { path, complete: true, amountPaid }   -> ASSIGNED becomes PURCHASED
 *
 * Split like this so a relay on a weak connection can retry the upload without
 * redoing anything else — which is also what makes offline queueing possible.
 */
export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, "POST")) return;
  const relay = await requireRelay(req);

  const orderId = req.query.id;
  const order = await getOrder(orderId);
  assertOrderAssignedToRelay(order, relay.relayId);

  const { contentType = "image/jpeg", path, complete, amountPaidUsdCents } = readJsonBody(req);

  if (!complete) {
    return json(res, 200, await createReceiptUploadUrl(orderId, contentType));
  }

  const updated = await completeReceipt(orderId, path, relay.actor, { amountPaidUsdCents });
  await sendOrderEmail(STATUS.PURCHASED, { ...order, ...updated, id: orderId });

  json(res, 200, {
    orderId,
    status: STATUS.PURCHASED,
    // Surfaced so the relay sees immediately that they went over budget and
    // the org will be asked about it — no silent flag behind their back.
    overBudget: updated.overBudget,
    varianceUsdCents: updated.varianceUsdCents,
  });
});
