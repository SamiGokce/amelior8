import { requireUser } from "../../_lib/auth.js";
import { HttpError, json, methodGuard, withErrors } from "../../_lib/http.js";
import { getOrder } from "../../_lib/orderState.js";
import { createProofReadUrl } from "../../_lib/proof.js";

/**
 * Hands the donor a short-lived signed URL for their own gift's proof photo.
 * The Storage path itself never leaves the server.
 */
export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, "GET")) return;

  const user = await requireUser(req);
  const order = await getOrder(req.query.id);

  if (order.donorUid !== user.uid && user.role !== "ops") {
    throw new HttpError(404, "Order not found.", "order_not_found");
  }
  if (!order.proofPhotoPath) {
    return json(res, 200, { url: null, state: order.verification?.state || "none" });
  }

  json(res, 200, {
    url: await createProofReadUrl(order.proofPhotoPath),
    state: order.verification?.state || "none",
    expiresInSeconds: 900,
  });
});
