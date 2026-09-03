import { randomInt } from "node:crypto";

// Ambiguous glyphs removed — these get read aloud over the phone and typed
// into support tickets.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Human-readable, server-issued order id, e.g. "A8-7K3M9Q". */
export function generateOrderId() {
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += ALPHABET[randomInt(ALPHABET.length)];
  return `A8-${suffix}`;
}

/**
 * Order ids are short enough to collide eventually, so claim one atomically
 * rather than trusting randomness.
 */
export async function reserveOrderId(db, attempts = 8) {
  for (let i = 0; i < attempts; i++) {
    const id = generateOrderId();
    const ref = db.collection("orders").doc(id);
    const claimed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) return false;
      tx.create(ref, { orderId: id, _reserved: true });
      return true;
    });
    if (claimed) return id;
  }
  throw new Error("Could not allocate an order id after several attempts.");
}
