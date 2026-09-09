import { FieldValue, adminDb } from "./admin.js";
import { HttpError } from "./http.js";
import { STATUS, canTransition } from "../../shared/orderStatus.js";

// Which stage timestamp a status stamps on arrival.
const STAGE_KEY = {
  [STATUS.FUNDED]: "funded",
  [STATUS.ASSIGNED]: "assigned",
  [STATUS.PURCHASED]: "purchased",
  [STATUS.DELIVERED]: "delivered",
};

/**
 * The ONLY way an order's status changes. Ops endpoints call it today, the relay
 * app will call it later, the Stripe webhook calls it for funding and refunds.
 * Nothing anywhere writes `status` directly.
 *
 * Guarantees:
 *  - forward-only, per shared/orderStatus.js
 *  - idempotent: re-issuing an applied transition succeeds without re-firing
 *    side effects
 *  - attributed: every change appends an immutable event with actor + time
 *
 * @param {string} orderId
 * @param {string} toStatus
 * @param {{kind: "system"|"ops"|"relay"|"donor", id: string}} actor
 * @param {{note?: string, patch?: object, metadata?: object}} options
 * @returns {Promise<{changed: boolean, order: object, fromStatus: string}>}
 */
export async function transitionOrder(orderId, toStatus, actor, options = {}) {
  const { note = null, patch = {}, metadata = {} } = options;
  const db = adminDb();
  const orderRef = db.collection("orders").doc(orderId);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) {
      throw new HttpError(404, `Order ${orderId} not found.`, "order_not_found");
    }

    const order = snap.data();
    const fromStatus = order.status;

    // Idempotent: already there, so this is a retry (a duplicate webhook, a
    // double-clicked ops button). Succeed without touching anything.
    if (fromStatus === toStatus) {
      return { changed: false, order: { id: orderId, ...order }, fromStatus };
    }

    if (!canTransition(fromStatus, toStatus, order.heldFrom || null)) {
      throw new HttpError(
        409,
        `Cannot move order from ${fromStatus} to ${toStatus}.`,
        "illegal_transition",
      );
    }

    const now = FieldValue.serverTimestamp();
    const update = { ...patch, status: toStatus, updatedAt: now };

    const stageKey = STAGE_KEY[toStatus];
    // Only stamp a stage the first time it's reached — a PROOF_REJECTED ->
    // DELIVERED return must not rewrite the original delivery time.
    if (stageKey && !order.stageTimestamps?.[stageKey]) {
      update[`stageTimestamps.${stageKey}`] = now;
    }

    if (toStatus === STATUS.ON_HOLD) {
      update.heldFrom = fromStatus;
    } else if (fromStatus === STATUS.ON_HOLD) {
      update.heldFrom = FieldValue.delete();
    }

    if (toStatus === STATUS.CANCELLED) update.cancelledAt = now;

    tx.update(orderRef, update);

    tx.create(orderRef.collection("events").doc(), {
      type: "status_change",
      fromStatus,
      toStatus,
      actor,
      note,
      metadata,
      createdAt: now,
    });

    return {
      changed: true,
      fromStatus,
      order: { id: orderId, ...order, ...patch, status: toStatus },
    };
  });

  return result;
}

/**
 * Appends an event without changing status — proof uploads, verification
 * results, ops notes. Same audit trail, no state move.
 */
export async function recordEvent(orderId, type, actor, metadata = {}) {
  await adminDb()
    .collection("orders").doc(orderId)
    .collection("events").doc()
    .set({
      type,
      fromStatus: null,
      toStatus: null,
      actor,
      metadata,
      createdAt: FieldValue.serverTimestamp(),
    });
}

export async function getOrder(orderId) {
  const snap = await adminDb().collection("orders").doc(orderId).get();
  if (!snap.exists) throw new HttpError(404, "Order not found.", "order_not_found");
  return { id: snap.id, ...snap.data() };
}
