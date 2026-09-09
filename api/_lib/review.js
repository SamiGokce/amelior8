import { FieldValue, adminDb } from "./admin.js";
import { HttpError } from "./http.js";
import { getOrder, recordEvent, transitionOrder } from "./orderState.js";
import { sendOrderEmail } from "./email.js";
import { STATUS } from "../../shared/orderStatus.js";

/**
 * The single implementation of "a human decided about this delivery".
 *
 * The local org uses it for every delivery; Amelior8 ops uses the same function
 * as a backstop for disputes. One code path, so an approval means the same
 * thing and lands in the audit trail the same way whoever made it.
 *
 * Approving grants the badge the donor sees. Which badge depends on what the
 * automatic check said:
 *   - AI passed and a human agreed  -> "AI Verified"
 *   - a human approved despite a flag, failure, or no AI at all -> "Verified"
 * We never claim an AI verified something it did not.
 *
 * @param {string} orderId
 * @param {"approve"|"reject"} decision
 * @param {{kind: "org"|"ops", id: string}} actor
 * @param {{note?: string|null, isOps?: boolean}} options
 */
export async function reviewDelivery(orderId, decision, actor, { note = null, isOps = false } = {}) {
  if (decision !== "approve" && decision !== "reject") {
    throw new HttpError(400, "decision must be 'approve' or 'reject'.", "bad_decision");
  }

  const order = await getOrder(orderId);
  if (!order.proofPhotoPath) {
    throw new HttpError(409, "This gift has no delivery photo to review.", "no_proof");
  }
  if (order.status !== STATUS.DELIVERED) {
    throw new HttpError(
      409,
      `Only a delivered gift can be reviewed (this one is ${order.status}).`,
      "not_reviewable",
    );
  }

  const aiState = order.verification?.ai?.state || "unavailable";
  const decidedBy = isOps ? "ops" : "org";

  await recordEvent(orderId, "delivery_review", actor, {
    decision,
    note,
    decidedBy,
    aiState,
  });

  if (decision === "reject") {
    const { order: updated } = await transitionOrder(
      orderId,
      STATUS.PROOF_REJECTED,
      actor,
      {
        note: note || `Rejected on ${decidedBy} review.`,
        patch: {
          // The rejected photo stays in Storage for the audit trail; the order
          // simply stops pointing at it so a replacement can be uploaded.
          rejectedProofPath: order.proofPhotoPath,
          proofPhotoPath: null,
          verification: {
            ...(order.verification || {}),
            state: "rejected",
            [decidedBy]: { decision: "rejected", by: actor.id, at: FieldValue.serverTimestamp(), note },
          },
        },
      },
    );

    // Clear the dedup marker so a second rejection can notify again.
    await adminDb().collection("orders").doc(orderId)
      .collection("emails").doc(STATUS.PROOF_REJECTED).delete().catch(() => {});
    await sendOrderEmail(STATUS.PROOF_REJECTED, { ...order, ...updated, id: orderId });

    return { orderId, status: STATUS.PROOF_REJECTED, decision };
  }

  const aiAgreed = aiState === "passed";

  const { order: updated } = await transitionOrder(
    orderId,
    STATUS.VERIFIED,
    actor,
    {
      note: note || `Approved on ${decidedBy} review.`,
      patch: {
        verification: {
          ...(order.verification || {}),
          state: aiAgreed ? "passed" : "overridden",
          method: aiAgreed ? "ai+human" : "human",
          reviewedBy: actor.id,
          reviewedAt: FieldValue.serverTimestamp(),
          [decidedBy]: { decision: "approved", by: actor.id, at: FieldValue.serverTimestamp(), note },
        },
      },
    },
  );

  await sendOrderEmail(STATUS.VERIFIED, { ...order, ...updated, id: orderId });

  return {
    orderId,
    status: STATUS.VERIFIED,
    decision,
    badge: aiAgreed ? "AI Verified" : "Verified",
  };
}
