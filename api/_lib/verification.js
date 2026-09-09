import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { FieldValue, adminBucket, adminDb } from "./admin.js";
import { STATUS } from "../../shared/orderStatus.js";
import { recordEvent } from "./orderState.js";

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
 * Runs the automatic check on an uploaded proof photo and records the verdict.
 *
 * It does NOT decide the outcome. The local org approves or rejects every
 * delivery; this call gives them a verdict and its reasons to decide with, and
 * catches a reused or plainly wrong photo before a human looks at it.
 *
 * The order stays DELIVERED either way, and the donor sees "Verification in
 * review" until the org approves. A badge is never granted by this function.
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
      "verification.ai": {
        state: "unavailable",
        score: null,
        reasons: ["Automatic checking is not configured. This needs a human decision."],
        ranAt: FieldValue.serverTimestamp(),
      },
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
      "verification.ai": {
        state: "unavailable",
        score: null,
        reasons: ["Automatic checking could not run. This needs a human decision."],
        ranAt: FieldValue.serverTimestamp(),
      },
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

  const aiState = verdict === "pass" ? "passed" : verdict === "fail" ? "failed" : "flagged";

  await orderRef.update({
    proofHash: hash,
    verification: {
      // Donor-facing: stays "pending" until the local org decides. The badge
      // is earned by a human approval, not by this verdict.
      state: "pending",
      method: null,
      reviewedBy: null,
      reviewedAt: null,
      ai: {
        state: aiState,
        score: result.score ?? null,
        reasons,
        showsOrderedItem: result.showsOrderedItem ?? null,
        showsHandover: result.showsHandover ?? null,
        locationConsistent: result.locationConsistent ?? null,
        reusedFromOrderId: reusedFrom,
        ranAt: FieldValue.serverTimestamp(),
      },
      org: { decision: "pending", by: null, at: null, note: null },
    },
    updatedAt: FieldValue.serverTimestamp(),
  });

  await recordEvent(orderId, "verification_result", { kind: "system", id: "ai" }, {
    verdict, score: result.score ?? null, reasons, reusedFrom,
  });

  return { state: aiState, verdict, reasons, score: result.score ?? null, reusedFrom };
}
