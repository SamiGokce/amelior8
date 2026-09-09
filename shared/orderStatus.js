// Single source of truth for the order lifecycle.
//
// Imported by BOTH the client (for stage display) and the API (for validated
// transitions), so the two can never drift. The transition function itself
// lives in api/_lib/orderState.js — nothing else may write `status`.

export const STATUS = {
  PENDING_PAYMENT: "PENDING_PAYMENT",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  FUNDED: "FUNDED",
  ASSIGNED: "ASSIGNED",
  PURCHASED: "PURCHASED",
  DELIVERED: "DELIVERED",
  VERIFIED: "VERIFIED",
  PROOF_REJECTED: "PROOF_REJECTED",
  ON_HOLD: "ON_HOLD",
  CANCELLED: "CANCELLED",
  REFUNDED: "REFUNDED",
};

export const TERMINAL_STATUSES = [
  STATUS.VERIFIED,
  STATUS.REFUNDED,
  STATUS.PAYMENT_FAILED,
];

// Forward-only, with the two documented returns: ON_HOLD back to the status it
// paused, and PROOF_REJECTED back to DELIVERED when a replacement photo lands.
export const ALLOWED_TRANSITIONS = {
  [STATUS.PENDING_PAYMENT]: [STATUS.FUNDED, STATUS.PAYMENT_FAILED, STATUS.CANCELLED],
  [STATUS.FUNDED]: [STATUS.ASSIGNED, STATUS.ON_HOLD, STATUS.CANCELLED],
  [STATUS.ASSIGNED]: [STATUS.PURCHASED, STATUS.ON_HOLD, STATUS.CANCELLED],
  [STATUS.PURCHASED]: [STATUS.DELIVERED, STATUS.ON_HOLD, STATUS.CANCELLED],
  [STATUS.DELIVERED]: [STATUS.VERIFIED, STATUS.PROOF_REJECTED, STATUS.ON_HOLD, STATUS.CANCELLED],
  [STATUS.PROOF_REJECTED]: [STATUS.DELIVERED, STATUS.ON_HOLD, STATUS.CANCELLED],
  // ON_HOLD returns to whatever it paused — resolved at runtime from
  // `heldFrom`, not from this table.
  [STATUS.ON_HOLD]: [STATUS.CANCELLED],
  [STATUS.CANCELLED]: [STATUS.REFUNDED],
  [STATUS.VERIFIED]: [],
  [STATUS.REFUNDED]: [],
  [STATUS.PAYMENT_FAILED]: [],
};

// Order of progress. Used to reject any transition that would skip a stage.
export const PROGRESS_ORDER = [
  STATUS.PENDING_PAYMENT,
  STATUS.FUNDED,
  STATUS.ASSIGNED,
  STATUS.PURCHASED,
  STATUS.DELIVERED,
  STATUS.VERIFIED,
];

/**
 * Is `to` reachable from `from`? `heldFrom` supplies the return target when
 * resuming out of ON_HOLD.
 */
export function canTransition(from, to, heldFrom = null) {
  if (from === STATUS.ON_HOLD) {
    return to === STATUS.CANCELLED || (!!heldFrom && to === heldFrom);
  }
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
}

// ---------------------------------------------------------------------------
// Donor-visible stages. VERIFIED is NOT a fifth stage — it resolves the proof
// badge inside stage 4.
// ---------------------------------------------------------------------------

export const STAGES = [
  { key: "funded", label: "Money received", reachedAt: [STATUS.FUNDED, STATUS.ASSIGNED, STATUS.PURCHASED, STATUS.DELIVERED, STATUS.PROOF_REJECTED, STATUS.VERIFIED] },
  { key: "assigned", label: "Relay chosen", reachedAt: [STATUS.ASSIGNED, STATUS.PURCHASED, STATUS.DELIVERED, STATUS.PROOF_REJECTED, STATUS.VERIFIED] },
  { key: "purchased", label: "Gift bought", reachedAt: [STATUS.PURCHASED, STATUS.DELIVERED, STATUS.PROOF_REJECTED, STATUS.VERIFIED] },
  { key: "delivered", label: "Gift delivered", reachedAt: [STATUS.DELIVERED, STATUS.VERIFIED] },
];

/**
 * Stage states for the tracking timeline. When an order is ON_HOLD the stage
 * it paused at is shown as current, not as progressing.
 */
export function stageStates(order) {
  const status = order?.status;
  const effective = status === STATUS.ON_HOLD ? order?.heldFrom || STATUS.FUNDED : status;
  const states = STAGES.map((stage) => (stage.reachedAt.includes(effective) ? "complete" : "pending"));
  const firstPending = states.indexOf("pending");
  if (firstPending !== -1 && states.slice(0, firstPending).every((s) => s === "complete")) {
    states[firstPending] = "current";
  }
  return STAGES.map((stage, i) => ({
    ...stage,
    state: states[i],
    at: order?.stageTimestamps?.[stage.key] || null,
  }));
}

/**
 * The honest one-line explanation a donor sees above the timeline. Never a
 * bare spinner — an order sitting at stage 1 for days must say why.
 */
export function statusExplanation(order) {
  switch (order?.status) {
    case STATUS.PENDING_PAYMENT:
      return "Waiting for your payment to clear. This usually takes a few seconds.";
    case STATUS.PAYMENT_FAILED:
      return "Your payment did not go through. Nothing was charged.";
    case STATUS.FUNDED:
      return "Your gift is funded. We are matching it with a relay in the area — this can take a day or two.";
    case STATUS.ASSIGNED:
      return "A relay has been assigned and is arranging the purchase.";
    case STATUS.PURCHASED:
      return "The gift has been bought and is on its way to the recipient.";
    case STATUS.DELIVERED:
      return order?.verification?.state === "pending" || order?.verification?.state === "flagged"
        ? "Delivered. We are checking the proof photo before confirming."
        : "Delivered to the recipient.";
    case STATUS.VERIFIED:
      return "Delivered and verified.";
    case STATUS.PROOF_REJECTED:
      return "The delivery photo did not pass our check. We have asked the relay for another one.";
    case STATUS.ON_HOLD:
      return "This gift is temporarily on hold. We will email you as soon as it moves again.";
    case STATUS.CANCELLED:
      return "This gift was cancelled. A refund is being processed.";
    case STATUS.REFUNDED:
      return "This gift was cancelled and refunded in full.";
    default:
      return "";
  }
}
