import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { FieldValue, adminBucket, adminDb } from "./admin.js";
import { STATUS } from "../../shared/orderStatus.js";
import { recordEvent, transitionOrder } from "./orderState.js";
import { sendOrderEmail } from "./email.js";

const MODEL = "claude-sonnet-5";

const VERDICT_TOOL = {
  name: "record_verification",
  description: "Record the verification verdict for a delivery proof photo.",
  input_schema: {
    type: "object",
    properties: {
      verdict: {
        type: "string",
        enum: ["pass", "flag", "fail"],
        description:
          "pass = clearly shows the ordered gift being delivered or held by a recipient. " +
          "flag = plausible but unclear, needs a human look. " +
          "fail = clearly not the ordered gift, or not a delivery at all.",
      },
      score: {
        type: "number",
        description: "Confidence in the verdict, 0 to 1.",
      },
      showsOrderedItem: { type: "boolean" },
      showsHandover: { type: "boolean" },
      locationConsistent: {
        type: "boolean",
        description: "Nothing in the photo contradicts the stated country.",
      },
      reasons: {
        type: "array",
        items: { type: "string" },
        description: "Short, specific observations supporting the verdict.",
      },
    },
    required: ["verdict", "score", "showsOrderedItem", "showsHandover", "reasons"],
  },
};

function prompt(order) {
  const item = order.itemSnapshot || {};
  return `You are verifying photographic proof that a charitable gift was delivered.

The gift ordered:
- Item: ${item.name || "unknown"}
- Description: ${item.description || "none given"}
- Country of delivery: ${order.countrySnapshot?.name || order.countryCode || "unknown"}
- Delivering partner: ${order.partnerSnapshot?.name || "unknown"}

Assess the attached photo:
1. Does it plausibly show the item that was ordered?
2. Does it show a handover, or the item in a recipient's possession?
3. Is anything visibly inconsistent with the stated country?

A real donor sees the result of this check, and a real relay's payment
depends on it. Do not pass a photo you are unsure about — use "flag" and let a
person decide. Do not fail a photo merely for being ordinary or poorly lit.

Record your verdict with the record_verification tool.`;
}

/** Byte-identical reuse of an earlier order's photo. */
function contentHash(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function findReuse(orderId, hash) {
  const dupes = await adminDb()
    .collection("orders")
    .where("proofHash", "==", hash)
    .limit(2)
    .get();
  const other = dupes.docs.find((d) => d.id !== orderId);
  return other ? other.id : null;
}

/**
 * Runs verification on an order's uploaded proof photo and applies the result.
 *
 * Pass -> the order moves to VERIFIED and the donor is emailed.
 * Flag/fail -> the order stays DELIVERED with the verdict recorded, and the
 * donor sees "Verification in review". A false "verified" is never shown.
 */
export async function verifyProof(orderId) {
  const db = adminDb();
  const orderRef = db.collection("orders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) throw new Error(`Order ${orderId} not found`);
  const order = { id: orderId, ...snap.data() };

  if (!order.proofPhotoPath) throw new Error(`Order ${orderId} has no proof photo`);

  const [buffer] = await adminBucket().file(order.proofPhotoPath).download();
  const [metadata] = await adminBucket().file(order.proofPhotoPath).getMetadata();
  const mediaType = metadata.contentType || "image/jpeg";

  // Exact-duplicate check. Note: this catches a byte-identical re-upload, not
  // a re-encoded or lightly edited copy — that needs a perceptual hash, which
  // is a follow-up.
  const hash = contentHash(buffer);
  const reusedFrom = await findReuse(orderId, hash);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // No key: leave it pending for a human rather than passing it blind.
    await orderRef.update({
      "verification.state": "pending",
      "verification.method": null,
      "verification.reasons": ["Automatic verification is not configured; awaiting human review."],
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { state: "pending", reason: "not_configured" };
  }

  let result;
  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      tools: [VERDICT_TOOL],
      tool_choice: { type: "tool", name: "record_verification" },
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: buffer.toString("base64") } },
          { type: "text", text: prompt(order) },
        ],
      }],
    });
    const toolUse = message.content.find((c) => c.type === "tool_use");
    if (!toolUse) throw new Error("Model returned no verdict");
    result = toolUse.input;
  } catch (err) {
    console.error(`Verification call failed for ${orderId}:`, err);
    await orderRef.update({
      "verification.state": "pending",
      "verification.reasons": ["Automatic verification could not run; awaiting human review."],
      updatedAt: FieldValue.serverTimestamp(),
    });
    await recordEvent(orderId, "verification_error", { kind: "system", id: "verification" }, {
      error: err.message,
    });
    return { state: "pending", reason: "call_failed" };
  }

  const reasons = [...(result.reasons || [])];
  let verdict = result.verdict;

  // A reused photo is never a pass, whatever the model thought of it.
  if (reusedFrom) {
    verdict = "fail";
    reasons.unshift(`This photo is byte-identical to the proof on order ${reusedFrom}.`);
  }

  const state = verdict === "pass" ? "passed" : verdict === "fail" ? "failed" : "flagged";

  await orderRef.update({
    proofHash: hash,
    verification: {
      state,
      method: "ai",
      score: result.score ?? null,
      reasons,
      showsOrderedItem: result.showsOrderedItem ?? null,
      showsHandover: result.showsHandover ?? null,
      locationConsistent: result.locationConsistent ?? null,
      reviewedBy: null,
      reviewedAt: null,
      verifiedAt: FieldValue.serverTimestamp(),
    },
    updatedAt: FieldValue.serverTimestamp(),
  });

  await recordEvent(orderId, "verification_result", { kind: "system", id: "ai" }, {
    verdict, score: result.score ?? null, reasons, reusedFrom,
  });

  if (verdict === "pass") {
    const { order: updated } = await transitionOrder(orderId, STATUS.VERIFIED, {
      kind: "system", id: "ai",
    }, { note: "Proof photo passed automatic verification." });
    await sendOrderEmail(STATUS.VERIFIED, { ...order, ...updated, id: orderId });
  } else {
    // Stays DELIVERED. Ops picks it up from the queue; the donor sees
    // "Verification in review" rather than a badge that isn't earned.
    console.warn(`Order ${orderId} proof ${state}: ${reasons.join(" ")}`);
  }

  return { state, verdict, reasons, score: result.score ?? null };
}
