import { describe, expect, it } from "vitest";
import {
  ORG_ROLE,
  isOps,
  isOrgAdmin,
  isOrgUser,
  isRelay,
  relayEmail,
  validatePin,
  validateUsername,
} from "../shared/roles.js";

describe("role claims", () => {
  const donor = { uid: "d1" };
  const staff = { uid: "s1", orgRole: ORG_ROLE.STAFF, partnerId: "maji-safi" };
  const admin = { uid: "a1", orgRole: ORG_ROLE.ADMIN, partnerId: "maji-safi" };
  const relay = { uid: "r1", role: "relay", relayId: "rel1", partnerId: "maji-safi" };
  const ops = { uid: "o1", role: "ops" };

  it("treats a donor as having no privileged role", () => {
    expect(isOrgUser(donor)).toBe(false);
    expect(isRelay(donor)).toBe(false);
    expect(isOps(donor)).toBe(false);
    expect(isOrgAdmin(donor)).toBe(false);
  });

  it("recognises org staff and admins", () => {
    expect(isOrgUser(staff)).toBe(true);
    expect(isOrgUser(admin)).toBe(true);
    expect(isOrgAdmin(staff)).toBe(false);
    expect(isOrgAdmin(admin)).toBe(true);
  });

  it("does not treat an org role without a partnerId as valid", () => {
    // A claim set without scoping must never pass as membership of every org.
    expect(isOrgUser({ orgRole: ORG_ROLE.ADMIN })).toBe(false);
  });

  it("does not treat a relay claim without a relayId as valid", () => {
    expect(isRelay({ role: "relay" })).toBe(false);
    expect(isRelay(relay)).toBe(true);
  });

  it("keeps the roles disjoint", () => {
    expect(isRelay(staff)).toBe(false);
    expect(isOrgUser(relay)).toBe(false);
    expect(isOps(admin)).toBe(false);
    expect(isOps(ops)).toBe(true);
  });

  it("never lets an undefined claim object pass a check", () => {
    for (const check of [isOps, isOrgUser, isOrgAdmin, isRelay]) {
      expect(check(undefined)).toBe(false);
      expect(check(null)).toBe(false);
      expect(check({})).toBe(false);
    }
  });
});

describe("relay sign-in identity", () => {
  it("maps a username to a reserved, non-deliverable address", () => {
    expect(relayEmail("james-m")).toBe("james-m@relay.amelior8.invalid");
    expect(relayEmail("  JAMES-M  ")).toBe("james-m@relay.amelior8.invalid");
  });
});

describe("username rules", () => {
  it("accepts ordinary usernames", () => {
    for (const u of ["james-m", "abc", "relay123", "a1b2c3"]) {
      expect(validateUsername(u).ok).toBe(true);
    }
  });

  it("normalises case and surrounding space", () => {
    expect(validateUsername("  James-M ").value).toBe("james-m");
  });

  it("rejects anything that would not round-trip into an address", () => {
    for (const u of ["ab", "", "-leading", "has space", "has_underscore", "UPPER!", "a".repeat(31)]) {
      expect(validateUsername(u).ok).toBe(false);
    }
  });
});

describe("PIN rules", () => {
  it("accepts a six-digit PIN", () => {
    expect(validatePin("407913").ok).toBe(true);
    expect(validatePin("28461902").ok).toBe(true);
  });

  it("rejects anything too short, too long, or not digits", () => {
    for (const p of ["12345", "", "1234567890123", "abcdef", "12 456"]) {
      expect(validatePin(p).ok).toBe(false);
    }
  });

  // These are the PINs people actually pick, and no throttling saves you from
  // an attacker guessing them first.
  it("rejects repeated and sequential digits", () => {
    for (const p of ["000000", "111111", "999999", "123456", "654321", "0123456789"]) {
      expect(validatePin(p).ok).toBe(false);
    }
  });
});
