import { FieldValue, adminBucket, adminDb } from "./admin.js";
import { HttpError } from "./http.js";
import { getOrder, transitionOrder } from "./orderState.js";
import { STATUS } from "../../shared/orderStatus.js";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const UPLOAD_WINDOW_MS = 15 * 60 * 1000;
const READ_WINDOW_MS = 15 * 60 * 1000;

/**
 * Issues a short-lived signed upload URL for an order's delivery photo.
 *
 * Shared by the facilitator-facing route and the ops stand-in so both write
 * the photo to exactly the same place under the same rules.
 */
export async function createProofUploadUrl(orderId, contentType, actor) {
  if (!ALLOWED_TYPES.includes(contentType)) {
    throw new HttpError(400, `contentType must be one of: ${ALLOWED_TYPES.join(", ")}`, "bad_content_type");
  }

  const order = await getOrder(orderId);
  const uploadable = [STATUS.PURCHASED, STATUS.DELIVERED, STATUS.PROOF_REJECTED];
  if (!uploadable.includes(order.status)) {
    throw new HttpError(
      409,
      `Proof can only be uploaded once the gift has been bought (order is ${order.status}).`,
      "not_uploadable",
    );
  }

  const ext = contentType.split("/")[1].replace("jpeg", "jpg");
  // Versioned filename so a replacement after PROOF_REJECTED never overwrites
  // the rejected original — the audit trail keeps both.
  const path = `proofs/${orderId}/${Date.now()}.${ext}`;

  const [uploadUrl] = await adminBucket().file(path).getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + UPLOAD_WINDOW_MS,
    contentType,
  });

  await adminDb().collection("orders").doc(orderId).update({
    pendingProofPath: path,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { uploadUrl, path, contentType, expiresInSeconds: UPLOAD_WINDOW_MS / 1000 };
}

/**
 * Called once the photo bytes are actually in Storage.
 *
 * There is no Storage trigger on Vercel, so the uploader tells us it finished.
 * We confirm the object really exists before believing it — otherwise anyone
 * with an upload URL could mark a gift delivered without uploading anything.
 */
export async function completeProof(orderId, path, actor, { recipientMessage = null } = {}) {
  const order = await getOrder(orderId);

  if (!path || path !== order.pendingProofPath) {
    throw new HttpError(400, "That upload does not match this order.", "path_mismatch");
  }

  const [exists] = await adminBucket().file(path).exists();
  if (!exists) {
    throw new HttpError(400, "No photo was uploaded to that URL.", "upload_missing");
  }

  const patch = {
    proofPhotoPath: path,
    // Optional, captured by the facilitator at handover. The donor's tracking
    // page renders the quote block only when this is actually present — never
    // a stand-in.
    ...(recipientMessage ? { recipientMessage: String(recipientMessage).slice(0, 500) } : {}),
    pendingProofPath: FieldValue.delete(),
    verification: {
      state: "pending",
      method: null,
      score: null,
      reasons: [],
      reviewedBy: null,
      reviewedAt: null,
    },
  };

  // PURCHASED -> DELIVERED, or PROOF_REJECTED -> DELIVERED for a replacement.
  const { order: updated } = await transitionOrder(orderId, STATUS.DELIVERED, actor, {
    note: "Delivery photo uploaded.",
    patch,
  });

  return { ...updated, id: orderId, proofPhotoPath: path };
}

/**
 * Short-lived signed READ url. Proof photos are never publicly readable and
 * raw Storage paths never reach the client.
 */
export async function createProofReadUrl(path) {
  if (!path) return null;
  const [url] = await adminBucket().file(path).getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + READ_WINDOW_MS,
  });
  return url;
}
