import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

/**
 * Security rules tests.
 *
 * Needs the Firestore emulator:
 *   npm run test:rules
 * which wraps this in `firebase emulators:exec`.
 */

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "amelior8it-rules-test",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => { await testEnv?.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Seed as admin, bypassing rules — this is the state the server would have
  // written through the Admin SDK.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "orders/A8-ALICE1"), {
      orderId: "A8-ALICE1",
      donorUid: "alice",
      donorEmail: "alice@example.com",
      totalCharged: 4300,
      status: "ASSIGNED",
      partnerId: "maji-safi",
      relayId: "relay_1",
    });
    await setDoc(doc(db, "orders/A8-OTHER1"), {
      orderId: "A8-OTHER1",
      donorUid: "bob",
      totalCharged: 2000,
      status: "FUNDED",
      partnerId: "other-org",
      relayId: null,
    });
    await setDoc(doc(db, "orgUsers/orgadmin"), {
      uid: "orgadmin", partnerId: "maji-safi", role: "org_admin", active: true,
    });
    await setDoc(doc(db, "orgInvites/sometoken"), { partnerId: "maji-safi", email: "x@y.z" });
    await setDoc(doc(db, "payouts/maji-safi_2026-09"), {
      partnerId: "maji-safi", period: "2026-09", amountUsdCents: 1000, status: "draft",
    });
    await setDoc(doc(db, "giftItems/water-filter-family"), {
      name: "Family water filter",
      priceUsdCents: 3200,
      available: true,
    });
    await setDoc(doc(db, "users/alice"), { uid: "alice", totalGiven: 4300, giftCount: 1 });
    await setDoc(doc(db, "subscriptions/sub_1"), { donorUid: "alice", status: "active" });
    await setDoc(doc(db, "relays/relay_1"), {
      name: "James M.", active: true, partnerId: "maji-safi",
    });
    await setDoc(doc(db, "relays/relay_other"), {
      name: "Someone Else", active: true, partnerId: "other-org",
    });
  });
});

const asAlice = () => testEnv.authenticatedContext("alice").firestore();
const asMallory = () => testEnv.authenticatedContext("mallory").firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();

// Custom claims, exactly as the Admin SDK sets them.
const asOrg = (partnerId = "maji-safi", orgRole = "org_staff") =>
  testEnv.authenticatedContext("orgstaff", { orgRole, partnerId }).firestore();
const asOtherOrg = () => asOrg("other-org");
const asRelay = (relayId = "relay_1", partnerId = "maji-safi") =>
  testEnv.authenticatedContext("relayuser", { role: "relay", relayId, partnerId }).firestore();

describe("orders", () => {
  it("lets a donor read their own order", async () => {
    await assertSucceeds(getDoc(doc(asAlice(), "orders/A8-ALICE1")));
  });

  // Definition of done #15.
  it("stops one donor reading another donor's order", async () => {
    await assertFails(getDoc(doc(asMallory(), "orders/A8-ALICE1")));
  });

  it("stops an anonymous visitor reading any order", async () => {
    await assertFails(getDoc(doc(asAnon(), "orders/A8-ALICE1")));
  });

  // Definition of done: no client writes to an order, ever.
  it("stops the owning donor writing their own order", async () => {
    await assertFails(updateDoc(doc(asAlice(), "orders/A8-ALICE1"), { status: "VERIFIED" }));
  });

  it("stops a donor creating an order directly", async () => {
    await assertFails(setDoc(doc(asAlice(), "orders/A8-FORGED"), {
      donorUid: "alice", status: "VERIFIED", totalCharged: 1,
    }));
  });

  it("stops a donor inflating their own amount", async () => {
    await assertFails(updateDoc(doc(asAlice(), "orders/A8-ALICE1"), { totalCharged: 999999 }));
  });

  it("keeps the audit trail out of client reach", async () => {
    await assertFails(getDoc(doc(asAlice(), "orders/A8-ALICE1/events/e1")));
    await assertFails(setDoc(doc(asAlice(), "orders/A8-ALICE1/events/e2"), { type: "forged" }));
  });
});

describe("catalog", () => {
  it("is publicly readable", async () => {
    await assertSucceeds(getDoc(doc(asAnon(), "giftItems/water-filter-family")));
  });

  it("is not client-writable", async () => {
    await assertFails(updateDoc(doc(asAlice(), "giftItems/water-filter-family"), { priceUsdCents: 1 }));
  });
});

describe("user profile", () => {
  it("lets a donor read their own profile", async () => {
    await assertSucceeds(getDoc(doc(asAlice(), "users/alice")));
  });

  it("stops a donor reading someone else's profile", async () => {
    await assertFails(getDoc(doc(asMallory(), "users/alice")));
  });

  it("allows a profile field edit", async () => {
    await assertSucceeds(updateDoc(doc(asAlice(), "users/alice"), { displayName: "Alice A." }));
  });

  it("stops a donor editing their own giving totals", async () => {
    await assertFails(updateDoc(doc(asAlice(), "users/alice"), { totalGiven: 10_000_000 }));
    await assertFails(updateDoc(doc(asAlice(), "users/alice"), { giftCount: 99 }));
  });
});

describe("server-only collections", () => {
  it("hides subscriptions from the client", async () => {
    await assertFails(getDoc(doc(asAlice(), "subscriptions/sub_1")));
  });

  it("hides relays from the client", async () => {
    await assertFails(getDoc(doc(asAlice(), "relays/relay_1")));
  });

  it("hides webhook bookkeeping from the client", async () => {
    await assertFails(getDoc(doc(asAlice(), "webhookEvents/evt_1")));
  });

  it("hides the prototype donors collection", async () => {
    await assertFails(getDoc(doc(asAlice(), "donors/anything")));
  });
});

describe("org isolation", () => {
  it("lets an org read a gift it is fulfilling", async () => {
    await assertSucceeds(getDoc(doc(asOrg(), "orders/A8-ALICE1")));
  });

  it("stops an org reading another org's gift", async () => {
    await assertFails(getDoc(doc(asOtherOrg(), "orders/A8-ALICE1")));
  });

  it("stops an org writing any order", async () => {
    await assertFails(updateDoc(doc(asOrg(), "orders/A8-ALICE1"), { status: "VERIFIED" }));
  });

  it("lets an org read its own roster but not another's", async () => {
    await assertSucceeds(getDoc(doc(asOrg(), "relays/relay_1")));
    await assertFails(getDoc(doc(asOrg(), "relays/relay_other")));
  });

  it("stops an org creating or editing a relay directly", async () => {
    await assertFails(updateDoc(doc(asOrg(), "relays/relay_1"), { active: false }));
    await assertFails(setDoc(doc(asOrg(), "relays/forged"), { partnerId: "maji-safi", name: "X" }));
  });

  it("keeps invite tokens unreadable even by the org they belong to", async () => {
    await assertFails(getDoc(doc(asOrg("maji-safi", "org_admin"), "orgInvites/sometoken")));
  });
});

describe("relay isolation", () => {
  it("lets a relay read a gift assigned to them", async () => {
    await assertSucceeds(getDoc(doc(asRelay(), "orders/A8-ALICE1")));
  });

  it("stops a relay reading a gift assigned to someone else", async () => {
    await assertFails(getDoc(doc(asRelay("relay_other", "other-org"), "orders/A8-ALICE1")));
  });

  it("stops a relay reading an unassigned gift", async () => {
    await assertFails(getDoc(doc(asRelay(), "orders/A8-OTHER1")));
  });

  it("stops a relay writing an order", async () => {
    await assertFails(updateDoc(doc(asRelay(), "orders/A8-ALICE1"), { status: "VERIFIED" }));
  });

  it("lets a relay read their own record but not a colleague's", async () => {
    await assertSucceeds(getDoc(doc(asRelay(), "relays/relay_1")));
    await assertFails(getDoc(doc(asRelay(), "relays/relay_other")));
  });

  it("stops a relay editing their own record", async () => {
    // Deactivation and PIN changes are the org's to make, through the API.
    await assertFails(updateDoc(doc(asRelay(), "relays/relay_1"), { active: true }));
  });
});

describe("donor cannot reach org or relay data", () => {
  it("keeps relays hidden from a donor", async () => {
    await assertFails(getDoc(doc(asAlice(), "relays/relay_1")));
  });

  it("keeps org membership hidden from a donor", async () => {
    await assertFails(getDoc(doc(asAlice(), "orgUsers/orgadmin")));
  });
});

describe("payouts", () => {
  it("lets an org read its own statement", async () => {
    await assertSucceeds(getDoc(doc(asOrg(), "payouts/maji-safi_2026-09")));
  });

  it("stops an org reading another org's statement", async () => {
    await assertFails(getDoc(doc(asOtherOrg(), "payouts/maji-safi_2026-09")));
  });

  it("stops an org writing a statement", async () => {
    await assertFails(updateDoc(doc(asOrg(), "payouts/maji-safi_2026-09"), { status: "paid" }));
    await assertFails(updateDoc(doc(asOrg(), "payouts/maji-safi_2026-09"), { amountUsdCents: 999999 }));
  });

  it("keeps statements away from donors and relays", async () => {
    await assertFails(getDoc(doc(asAlice(), "payouts/maji-safi_2026-09")));
    await assertFails(getDoc(doc(asRelay(), "payouts/maji-safi_2026-09")));
  });
});
