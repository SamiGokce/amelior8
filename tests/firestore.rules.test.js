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
      status: "FUNDED",
    });
    await setDoc(doc(db, "giftItems/water-filter-family"), {
      name: "Family water filter",
      priceUsdCents: 3200,
      available: true,
    });
    await setDoc(doc(db, "users/alice"), { uid: "alice", totalGiven: 4300, giftCount: 1 });
    await setDoc(doc(db, "subscriptions/sub_1"), { donorUid: "alice", status: "active" });
    await setDoc(doc(db, "facilitators/gr8_1"), { name: "James M.", active: true });
  });
});

const asAlice = () => testEnv.authenticatedContext("alice").firestore();
const asMallory = () => testEnv.authenticatedContext("mallory").firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();

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

  it("hides facilitators from the client", async () => {
    await assertFails(getDoc(doc(asAlice(), "facilitators/gr8_1")));
  });

  it("hides webhook bookkeeping from the client", async () => {
    await assertFails(getDoc(doc(asAlice(), "webhookEvents/evt_1")));
  });

  it("hides the prototype donors collection", async () => {
    await assertFails(getDoc(doc(asAlice(), "donors/anything")));
  });
});
