import { timingSafeEqual } from "node:crypto";
import { adminAuth } from "./admin.js";
import { HttpError } from "./http.js";
import { ORG_ROLE, isOps, isOrgAdmin, isOrgUser, isRelay } from "../../shared/roles.js";

/**
 * Verifies the Firebase ID token on an authenticated request.
 * Every /api route that touches real data calls this — the client's claim
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
 * `role: "ops"` claim. A leaked key alone moves nothing, and every action
 * stays attributable to a person.
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
  if (!isOps(decoded)) throw new HttpError(403, "Not authorised.", "forbidden");
  return decoded;
}

/**
 * Local org staff. The token carries exactly one partnerId, and every org
 * endpoint scopes its reads and writes to it — an org can never see or touch
 * another org's orders, relays or people.
 *
 * @param {object} req
 * @param {{adminOnly?: boolean}} options
 */
export async function requireOrg(req, { adminOnly = false } = {}) {
  const decoded = await requireUser(req);

  if (!isOrgUser(decoded)) {
    throw new HttpError(403, "Not authorised.", "forbidden");
  }
  if (adminOnly && !isOrgAdmin(decoded)) {
    throw new HttpError(403, "Only an organisation admin can do that.", "admin_only");
  }

  return {
    uid: decoded.uid,
    email: decoded.email || null,
    name: decoded.name || null,
    partnerId: decoded.partnerId,
    orgRole: decoded.orgRole,
    isAdmin: decoded.orgRole === ORG_ROLE.ADMIN,
    actor: { kind: "org", id: decoded.uid },
  };
}

/**
 * A relay. Scoped to their own relayId — a relay can only act on gifts
 * assigned to them, which is checked per order, not just per token.
 */
export async function requireRelay(req) {
  const decoded = await requireUser(req);

  if (!isRelay(decoded)) {
    throw new HttpError(403, "Not authorised.", "forbidden");
  }

  return {
    uid: decoded.uid,
    relayId: decoded.relayId,
    partnerId: decoded.partnerId,
    actor: { kind: "relay", id: decoded.relayId },
  };
}

/**
 * Guards an order against the caller's org. Returns the same 404 as a missing
 * order so one org cannot probe another's order ids.
 */
export function assertOrderBelongsToOrg(order, partnerId) {
  if (!order || order.partnerId !== partnerId) {
    throw new HttpError(404, "Order not found.", "order_not_found");
  }
}

/** Same, for a relay: the gift must actually be assigned to them. */
export function assertOrderAssignedToRelay(order, relayId) {
  if (!order || order.relayId !== relayId) {
    throw new HttpError(404, "Job not found.", "job_not_found");
  }
}
