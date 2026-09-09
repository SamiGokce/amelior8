import { assertOrderBelongsToOrg, requireOrg } from "../../../_lib/auth.js";
import { json, methodGuard, readJsonBody, withErrors } from "../../../_lib/http.js";
import { getOrder } from "../../../_lib/orderState.js";
import { reviewDelivery } from "../../../_lib/review.js";
import { createReadUrl } from "../../../_lib/proof.js";

/**
 * The org's decision on a delivery.
 *
 * GET  returns what they need to decide with: signed links to the receipt and
 *      the handover photo, plus the automatic check's verdict and reasons.
 * POST records approve or reject, through the same reviewDelivery() that ops
 *      uses, so both land identically in the audit trail.
 */
export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, ["GET", "POST"])) return;
  const org = await requireOrg(req);

  const orderId = req.query.id;
  const order = await getOrder(orderId);
  assertOrderBelongsToOrg(order, org.partnerId);

  if (req.method === "GET") {
    const [proofUrl, receiptUrl] = await Promise.all([
      createReadUrl(order.proofPhotoPath),
      createReadUrl(order.purchase?.receiptPath),
    ]);

    return json(res, 200, {
      orderId,
      status: order.status,
      item: order.itemSnapshot?.name || null,
      itemDescription: order.itemSnapshot?.description || null,
      giftAmount: order.giftAmount,
      recipient: order.recipient || null,
      relay: order.relaySnapshot?.name || null,
      recipientMessage: order.recipientMessage || null,
      purchase: order.purchase
        ? {
            amountPaidUsdCents: order.purchase.amountPaidUsdCents,
            overBudget: !!order.purchase.overBudget,
            varianceUsdCents: order.purchase.varianceUsdCents,
          }
        : null,
      verification: order.verification || null,
      proofUrl,
      receiptUrl,
    });
  }

  const { decision, note = null } = readJsonBody(req);
  const result = await reviewDelivery(orderId, decision, org.actor, { note });
  json(res, 200, result);
});
