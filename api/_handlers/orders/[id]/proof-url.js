import { requireUser } from "../../../_lib/auth.js";
import { HttpError, json, methodGuard, withErrors } from "../../../_lib/http.js";
import { getOrder } from "../../../_lib/orderState.js";
import { createProofReadUrl } from "../../../_lib/proof.js";

/**
 * Hands the donor a short-lived signed URL for their own gift's proof photo.
 *
 * Always the safeguarding derivative, never the original. If no derivative
 * exists — it failed to generate, or has not been generated yet — the donor
 * gets no photo at all. Default closed: an unblurred original must never be
 * the fallback.
 *
 * Ops can request the original for a dispute; the org sees it in their review.
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

  const isOps = user.role === "ops";
  const path = isOps ? order.proofPhotoPath : order.proofDonorPath;

  if (!path) {
    return json(res, 200, {
      url: null,
      state: order.verification?.state || "none",
      pending: true,
      message: "The delivery photo is still being prepared.",
    });
  }

  json(res, 200, {
    url: await createProofReadUrl(path),
    state: order.verification?.state || "none",
    // So the donor knows why a face is obscured rather than assuming a bad photo.
    blur: isOps ? null : (order.proofBlur?.method || "full"),
    expiresInSeconds: 900,
  });
});
