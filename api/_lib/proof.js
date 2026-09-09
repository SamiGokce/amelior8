import { FieldValue, adminBucket, adminDb } from "./admin.js";
import { stripMetadata } from "./images.js";
import { HttpError } from "./http.js";
import { getOrder, transitionOrder } from "./orderState.js";
import { STATUS } from "../../shared/orderStatus.js";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const UPLOAD_WINDOW_MS = 30 * 60 * 1000;   // generous: relays upload on bad connections
const READ_WINDOW_MS = 15 * 60 * 1000;

function assertType(contentType) {
  if (!ALLOWED_TYPES.includes(contentType)) {
    throw new HttpError(400, `contentType must be one of: ${ALLOWED_TYPES.join(", ")}`, "bad_content_type");
  }
}

/**
 * Signed upload URL for one of an order's images.
 *
 * `kind` is "proof" (the handover photo) or "receipt" (proof of purchase).
 * Filenames are timestamped so a replacement after a rejection never
 * overwrites the original — the audit trail keeps both.
 */
export async function createUploadUrl(orderId, kind, contentType, { allowedStatuses }) {
  assertType(contentType);

  const order = await getOrder(orderId);
  if (!allowedStatuses.includes(order.status)) {
    throw new HttpError(
      409,
      `Cannot upload a ${kind} while the gift is ${order.status}.`,
      "not_uploadable",
    );
  }

  const ext = contentType.split("/")[1].replace("jpeg", "jpg");
  const path = `${kind === "receipt" ? "receipts" : "proofs"}/${orderId}/${Date.now()}.${ext}`;

  const [uploadUrl] = await adminBucket().file(path).getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + UPLOAD_WINDOW_MS,
    contentType,
  });

  await adminDb().collection("orders").doc(orderId).update({
    [kind === "receipt" ? "pendingReceiptPath" : "pendingProofPath"]: path,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { uploadUrl, path, contentType, expiresInSeconds: UPLOAD_WINDOW_MS / 1000 };
}

export const createProofUploadUrl = (orderId, contentType) =>
  createUploadUrl(orderId, "proof", contentType, {
    allowedStatuses: [STATUS.PURCHASED, STATUS.DELIVERED, STATUS.PROOF_REJECTED],
  });

export const createReceiptUploadUrl = (orderId, contentType) =>
  createUploadUrl(orderId, "receipt", contentType, {
    allowedStatuses: [STATUS.ASSIGNED, STATUS.PURCHASED],
  });

/** The object must really exist before we believe an upload happened. */
async function confirmUploaded(path, expected) {
  if (!path || path !== expected) {
    throw new HttpError(400, "That upload does not match this gift.", "path_mismatch");
  }
  const [exists] = await adminBucket().file(path).exists();
  if (!exists) {
    throw new HttpError(400, "No file was uploaded to that URL.", "upload_missing");
  }
}

/**
 * Re-encodes an uploaded image in place, dropping all metadata.
 *
 * The relay app strips EXIF before uploading too. This is the belt to that
 * pair of braces: a recipient's location must not be recoverable from a file
 * we store, whatever the client did or failed to do.
 */
async function sanitiseUpload(path) {
  const file = adminBucket().file(path);
  const [original] = await file.download();

  let stripped;
  try {
    stripped = await stripMetadata(original);
  } catch (err) {
    // Fail closed. An image we cannot strip is an image we must not keep —
    // better to make the relay retake it than to store their recipient's
    // coordinates.
    console.error(`Could not strip metadata from ${path}:`, err);
    await file.delete().catch(() => {});
    throw new HttpError(
      400,
      "That photo could not be processed. Please take it again.",
      "unprocessable_image",
    );
  }

  await file.save(stripped.buffer, {
    contentType: stripped.contentType,
    metadata: { cacheControl: "private, max-age=0" },
  });
  return { hadLocation: stripped.hadLocation, bytes: stripped.buffer.length };
}

/**
 * The relay bought the gift. ASSIGNED -> PURCHASED.
 *
 * They are spending platform float, so the receipt and the amount they
 * actually paid are both recorded, and a spend over the gift budget is
 * flagged for the org rather than silently accepted.
 */
export async function completeReceipt(orderId, path, actor, { amountPaidUsdCents }) {
  const order = await getOrder(orderId);
  await confirmUploaded(path, order.pendingReceiptPath);
  await sanitiseUpload(path);

  const amount = Number(amountPaidUsdCents);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new HttpError(400, "amountPaidUsdCents must be a positive whole number of cents.", "bad_amount");
  }
  if (amount > 100_000_00) {
    throw new HttpError(400, "That amount looks wrong. Check the receipt.", "amount_implausible");
  }

  const budget = order.giftAmount || 0;
  const overBudget = amount > budget;

  const { order: updated } = await transitionOrder(orderId, STATUS.PURCHASED, actor, {
    note: `Gift purchased for ${(amount / 100).toFixed(2)} USD.`,
    patch: {
      pendingReceiptPath: FieldValue.delete(),
      purchase: {
        receiptPath: path,
        amountPaidUsdCents: amount,
        budgetUsdCents: budget,
        overBudget,
        varianceUsdCents: amount - budget,
        submittedBy: actor.id,
        submittedAt: FieldValue.serverTimestamp(),
      },
    },
  });

  return { ...updated, id: orderId, overBudget, varianceUsdCents: amount - budget };
}

/**
 * The relay handed the gift over. PURCHASED (or PROOF_REJECTED) -> DELIVERED.
 *
 * The order stops here until the local org reviews it. The automatic check
 * runs in between to give them something to decide with.
 */
export async function completeProof(orderId, path, actor, {
  recipientMessage = null,
  recipientConsent = false,
} = {}) {
  const order = await getOrder(orderId);
  await confirmUploaded(path, order.pendingProofPath);

  // Consent is an explicit act, never inferred from a photo existing.
  if (recipientConsent !== true) {
    throw new HttpError(
      400,
      "The recipient must agree to be photographed before this can be submitted.",
      "consent_required",
    );
  }

  const sanitised = await sanitiseUpload(path);

  const { order: updated } = await transitionOrder(orderId, STATUS.DELIVERED, actor, {
    note: "Delivery photo submitted.",
    patch: {
      proofPhotoPath: path,
      pendingProofPath: FieldValue.delete(),
      // Recorded against the order, not implied by the photo.
      recipientConsent: {
        photographed: true,
        confirmedBy: actor.id,
        confirmedByKind: actor.kind,
        confirmedAt: FieldValue.serverTimestamp(),
      },
      proofSanitised: {
        metadataStripped: true,
        hadLocationData: sanitised.hadLocation,
        at: FieldValue.serverTimestamp(),
      },
      // Cleared until the safeguarding derivative is regenerated, so a
      // replacement photo can never inherit the previous one's blurred copy.
      proofDonorPath: FieldValue.delete(),
      proofBlur: FieldValue.delete(),
      // Optional, captured at handover. The donor's page shows the quote block
      // only when this is actually present — never a stand-in.
      ...(recipientMessage ? { recipientMessage: String(recipientMessage).slice(0, 500) } : {}),
      verification: {
        state: "pending",
        method: null,
        reviewedBy: null,
        reviewedAt: null,
        ai: { state: "pending", score: null, reasons: [], ranAt: null },
        org: { decision: "pending", by: null, at: null, note: null },
      },
    },
  });

  return { ...updated, id: orderId, proofPhotoPath: path };
}

/**
 * Short-lived signed READ url. Receipts and proof photos are never publicly
 * readable and raw Storage paths never reach a client.
 */
export async function createReadUrl(path) {
  if (!path) return null;
  const [url] = await adminBucket().file(path).getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + READ_WINDOW_MS,
  });
  return url;
}

export const createProofReadUrl = createReadUrl;
