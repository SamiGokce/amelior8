import { createHash, randomBytes } from "node:crypto";
import { FieldValue, adminAuth, adminDb } from "./admin.js";
import { HttpError } from "./http.js";
import { ORG_ROLES } from "../../shared/roles.js";

const TTL_DAYS = 14;

// The raw token is shown once, in the link. Only its hash is stored, so a
// database leak does not hand anyone an org account.
const hash = (token) => createHash("sha256").update(token).digest("hex");

export async function createInvite({ partnerId, email, role, invitedBy, invitedByLabel }) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new HttpError(400, "Enter a valid email address.", "bad_email");
  }
  if (!ORG_ROLES.includes(role)) {
    throw new HttpError(400, `role must be one of: ${ORG_ROLES.join(", ")}`, "bad_role");
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);

  await adminDb().collection("orgInvites").doc(hash(token)).set({
    partnerId,
    email: cleanEmail,
    role,
    invitedBy,
    invitedByLabel: invitedByLabel || null,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
    acceptedAt: null,
    acceptedBy: null,
  });

  const base = process.env.APP_BASE_URL || "https://amelior8.com";
  return { token, email: cleanEmail, role, expiresAt, url: `${base}/org?invite=${token}` };
}

/**
 * Redeems an invite for an already-authenticated Firebase user.
 *
 * The signed-in email must match the invited email — otherwise a forwarded
 * link would let anyone into the organisation.
 */
export async function acceptInvite(token, decodedUser) {
  if (!token) throw new HttpError(400, "An invite token is required.", "missing_token");

  const db = adminDb();
  const ref = db.collection("orgInvites").doc(hash(token));
  const snap = await ref.get();

  if (!snap.exists) throw new HttpError(404, "That invite link is not valid.", "invite_not_found");
  const invite = snap.data();

  if (invite.acceptedAt) {
    throw new HttpError(409, "That invite has already been used.", "invite_used");
  }
  const expires = invite.expiresAt?.toDate?.() || new Date(invite.expiresAt);
  if (expires.getTime() < Date.now()) {
    throw new HttpError(410, "That invite has expired. Ask for a new one.", "invite_expired");
  }

  const signedInEmail = (decodedUser.email || "").toLowerCase();
  if (signedInEmail !== invite.email) {
    throw new HttpError(
      403,
      `This invite is for ${invite.email}. Sign in with that address.`,
      "invite_email_mismatch",
    );
  }
  if (!decodedUser.email_verified) {
    throw new HttpError(403, "Verify your email address first.", "email_unverified");
  }

  await adminAuth().setCustomUserClaims(decodedUser.uid, {
    orgRole: invite.role,
    partnerId: invite.partnerId,
  });

  await db.collection("orgUsers").doc(decodedUser.uid).set({
    uid: decodedUser.uid,
    email: invite.email,
    name: decodedUser.name || null,
    partnerId: invite.partnerId,
    role: invite.role,
    active: true,
    invitedBy: invite.invitedBy,
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await ref.update({
    acceptedAt: FieldValue.serverTimestamp(),
    acceptedBy: decodedUser.uid,
  });

  return { partnerId: invite.partnerId, role: invite.role };
}
