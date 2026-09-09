import { FieldValue, adminDb } from "../../../_lib/admin.js";
import { requireOps } from "../../../_lib/auth.js";
import { HttpError, json, methodGuard, readJsonBody, withErrors } from "../../../_lib/http.js";
import { getOrder, recordEvent, transitionOrder } from "../../../_lib/orderState.js";
import { sendOrderEmail } from "../../../_lib/email.js";
import { STATUS } from "../../../../shared/orderStatus.js";

/**
 * Human review of a delivery photo. `id` is the order id — proof is 1:1 with
 * an order in this model.
 *
 * Ops can approve or reject regardless of what the AI decided, in both
 * directions: a wrongly flagged photo can be approved, and a wrongly passed
 * one rejected. Either way the decision is recorded against a named person, so
 * a relay whose payment depends on it has something to appeal to.
 */
export default withErrors(async (req, res) => {
  if (!methodGuard(req, res, "POST")) return;
  const ops = await requireOps(req);

  const orderId = req.query.id;
  const { decision, reason = null } = readJsonBody(req);

  if (decision !== "approve" && decision !== "reject") {
    throw new HttpError(400, "decision must be 'approve' or 'reject'.", "bad_decision");
  }

  const order = await getOrder(orderId);
  if (!order.proofPhotoPath) {
    throw new HttpError(409, "This order has no proof photo to review.", "no_proof");
  }

  const verification = {
    ...(order.verification || {}),
    state: "overridden",
    method: "human",
    reviewedBy: ops.uid,
    reviewedAt: FieldValue.serverTimestamp(),
    reasons: [
      ...(order.verification?.reasons || []),
      `Human review: ${decision}${reason ? ` — ${reason}` : ""}`,
    ],
  };

  await recordEvent(orderId, "verification_review", { kind: "ops", id: ops.uid }, {
    decision,
    reason,
    previousState: order.verification?.state || "none",
  });

  if (decision === "approve") {
    const { order: updated } = await transitionOrder(
      orderId,
      STATUS.VERIFIED,
      { kind: "ops", id: ops.uid },
      { note: reason || "Approved on human review.", patch: { verification } },
    );
    await sendOrderEmail(STATUS.VERIFIED, { ...order, ...updated, id: orderId });
    return json(res, 200, { orderId, status: STATUS.VERIFIED, decision });
  }

  const { order: updated } = await transitionOrder(
    orderId,
    STATUS.PROOF_REJECTED,
    { kind: "ops", id: ops.uid },
    {
      note: reason || "Rejected on human review.",
      // The rejected photo stays in Storage for the audit trail; the order
      // simply stops pointing at it so a replacement can be uploaded.
      patch: { verification, rejectedProofPath: order.proofPhotoPath, proofPhotoPath: null },
    },
  );

  await adminDb().collection("orders").doc(orderId)
    .collection("emails").doc(STATUS.PROOF_REJECTED).delete().catch(() => {});
  await sendOrderEmail(STATUS.PROOF_REJECTED, { ...order, ...updated, id: orderId });

  json(res, 200, { orderId, status: STATUS.PROOF_REJECTED, decision });
});
