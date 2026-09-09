// Who can do what. Imported by the API for enforcement and by the front ends
// for showing the right controls — one definition, so they cannot drift.
//
// Roles live in Firebase Auth custom claims, set only by the Admin SDK:
//   ops        -> { role: "ops" }
//   org staff  -> { orgRole: "org_admin" | "org_staff", partnerId }
//   relay      -> { role: "relay", relayId, partnerId }
//   donor      -> no claims at all
//
// A donor token therefore cannot reach any org or relay endpoint, and an org
// token is scoped to exactly one partnerId.

export const ORG_ROLE = {
  ADMIN: "org_admin",
  STAFF: "org_staff",
};

export const ORG_ROLES = [ORG_ROLE.ADMIN, ORG_ROLE.STAFF];

/** Only an org admin manages people — staff do the day-to-day fulfilment. */
export const ORG_ADMIN_ONLY = [
  "manage_relays",
  "invite_staff",
];

export function isOrgAdmin(claims) {
  return claims?.orgRole === ORG_ROLE.ADMIN;
}

export function isOrgUser(claims) {
  return ORG_ROLES.includes(claims?.orgRole) && !!claims?.partnerId;
}

export function isRelay(claims) {
  return claims?.role === "relay" && !!claims?.relayId;
}

export function isOps(claims) {
  return claims?.role === "ops";
}

// ---------------------------------------------------------------------------
// Relay sign-in identity
// ---------------------------------------------------------------------------

/**
 * Relays sign in with a username and a PIN, but the credential itself is a
 * normal Firebase Auth account under a synthesized address. That gives real
 * token issuance, hashed credentials and built-in throttling instead of
 * hand-rolled auth — the username/PIN is only the interface.
 *
 * The domain is reserved and never receives mail; relays have no email address.
 */
export const RELAY_EMAIL_DOMAIN = "relay.amelior8.invalid";

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9-]{2,29}$/;
export const PIN_PATTERN = /^[0-9]{6,12}$/;

export function relayEmail(username) {
  return `${String(username).trim().toLowerCase()}@${RELAY_EMAIL_DOMAIN}`;
}

export function validateUsername(username) {
  const u = String(username || "").trim().toLowerCase();
  if (!USERNAME_PATTERN.test(u)) {
    return { ok: false, error: "Username must be 3-30 characters: lowercase letters, numbers and hyphens, starting with a letter or number." };
  }
  return { ok: true, value: u };
}

export function validatePin(pin) {
  const p = String(pin || "").trim();
  if (!PIN_PATTERN.test(p)) {
    return { ok: false, error: "PIN must be 6 to 12 digits." };
  }
  // Rejecting the worst PINs is worth the two lines. Firebase throttles
  // repeated failures, but "000000" needs no throttling to guess.
  if (/^(\d)\1+$/.test(p)) {
    return { ok: false, error: "PIN cannot be the same digit repeated." };
  }
  if ("0123456789".includes(p) || "9876543210".includes(p)) {
    return { ok: false, error: "PIN cannot be a run of consecutive digits." };
  }
  return { ok: true, value: p };
}
