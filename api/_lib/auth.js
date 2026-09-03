import { timingSafeEqual } from "node:crypto";
import { adminAuth } from "./admin.js";
import { HttpError } from "./http.js";

/**
 * Verifies the Firebase ID token on an authenticated donor request.
 * Every /api route that touches donor data calls this — the client's claim
 * about who it is counts for nothing on its own.
 */
export async function requireUser(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    throw new HttpError(401, "You need to be signed in.", "unauthenticated");
  }
  try {
    return await adminAuth().verifyIdToken(token);
  } catch {
    throw new HttpError(401, "Your session has expired. Sign in again.", "invalid_token");
  }
}

/** Constant-time compare so the ops key can't be probed a byte at a time. */
function safeEqual(a, b) {
  const bufA = Buffer.from(a || "", "utf8");
  const bufB = Buffer.from(b || "", "utf8");
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Ops endpoints need BOTH the shared key and a Firebase account carrying the
 * `role: "ops"` custom claim. The key alone is not enough — a leaked key
 * shouldn't be able to move real orders, and every action stays attributable
 * to a person for the audit trail.
 */
export async function requireOps(req) {
  const expected = process.env.OPS_API_KEY;
  if (!expected) {
    throw new HttpError(503, "Ops access is not configured.", "ops_not_configured");
  }

  const provided = (req.headers["x-ops-key"] || "").toString();
  if (!safeEqual(provided, expected)) {
    throw new HttpError(403, "Not authorised.", "forbidden");
  }

  const decoded = await requireUser(req);
  if (decoded.role !== "ops") {
    throw new HttpError(403, "Not authorised.", "forbidden");
  }
  return decoded;
}
