import { describe, expect, it } from "vitest";
import {
  STATUS,
  canTransition,
  stageStates,
  statusExplanation,
} from "../shared/orderStatus.js";

describe("order state machine", () => {
  it("walks the happy path one stage at a time", () => {
    const path = [
      STATUS.PENDING_PAYMENT,
      STATUS.FUNDED,
      STATUS.ASSIGNED,
      STATUS.PURCHASED,
      STATUS.DELIVERED,
      STATUS.VERIFIED,
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i], path[i + 1])).toBe(true);
    }
  });

  it("refuses to skip a stage", () => {
    // The one the definition of done calls out by name.
    expect(canTransition(STATUS.FUNDED, STATUS.DELIVERED)).toBe(false);
    expect(canTransition(STATUS.FUNDED, STATUS.VERIFIED)).toBe(false);
    expect(canTransition(STATUS.PENDING_PAYMENT, STATUS.ASSIGNED)).toBe(false);
    expect(canTransition(STATUS.ASSIGNED, STATUS.DELIVERED)).toBe(false);
  });

  it("refuses to move backward", () => {
    expect(canTransition(STATUS.PURCHASED, STATUS.FUNDED)).toBe(false);
    expect(canTransition(STATUS.DELIVERED, STATUS.ASSIGNED)).toBe(false);
    expect(canTransition(STATUS.VERIFIED, STATUS.DELIVERED)).toBe(false);
  });

  it("treats VERIFIED, REFUNDED and PAYMENT_FAILED as terminal", () => {
    for (const terminal of [STATUS.VERIFIED, STATUS.REFUNDED, STATUS.PAYMENT_FAILED]) {
      for (const target of Object.values(STATUS)) {
        expect(canTransition(terminal, target)).toBe(false);
      }
    }
  });

  it("only lets ON_HOLD return to the status it paused", () => {
    expect(canTransition(STATUS.ON_HOLD, STATUS.PURCHASED, STATUS.PURCHASED)).toBe(true);
    expect(canTransition(STATUS.ON_HOLD, STATUS.DELIVERED, STATUS.PURCHASED)).toBe(false);
    expect(canTransition(STATUS.ON_HOLD, STATUS.VERIFIED, STATUS.PURCHASED)).toBe(false);
    // Cancelling out of a hold is always allowed.
    expect(canTransition(STATUS.ON_HOLD, STATUS.CANCELLED, STATUS.PURCHASED)).toBe(true);
  });

  it("allows a replacement photo after PROOF_REJECTED", () => {
    expect(canTransition(STATUS.DELIVERED, STATUS.PROOF_REJECTED)).toBe(true);
    expect(canTransition(STATUS.PROOF_REJECTED, STATUS.DELIVERED)).toBe(true);
    // But a rejected proof can never jump straight to verified.
    expect(canTransition(STATUS.PROOF_REJECTED, STATUS.VERIFIED)).toBe(false);
  });

  it("refunds only after cancellation", () => {
    expect(canTransition(STATUS.CANCELLED, STATUS.REFUNDED)).toBe(true);
    expect(canTransition(STATUS.PURCHASED, STATUS.REFUNDED)).toBe(false);
  });
});

describe("donor-visible stages", () => {
  it("shows four stages, never five", () => {
    expect(stageStates({ status: STATUS.VERIFIED })).toHaveLength(4);
  });

  it("marks stage one current while awaiting a relay", () => {
    const stages = stageStates({ status: STATUS.FUNDED });
    expect(stages[0].state).toBe("complete");
    expect(stages[1].state).toBe("current");
    expect(stages[3].state).toBe("pending");
  });

  it("completes every stage once verified", () => {
    expect(stageStates({ status: STATUS.VERIFIED }).every((s) => s.state === "complete")).toBe(true);
  });

  it("resolves VERIFIED inside stage four rather than adding one", () => {
    const delivered = stageStates({ status: STATUS.DELIVERED });
    const verified = stageStates({ status: STATUS.VERIFIED });
    expect(delivered[3].state).toBe("complete");
    expect(verified[3].state).toBe("complete");
    expect(delivered).toHaveLength(verified.length);
  });

  it("holds the paused stage rather than showing progress", () => {
    const stages = stageStates({ status: STATUS.ON_HOLD, heldFrom: STATUS.ASSIGNED });
    expect(stages[1].state).toBe("complete");
    expect(stages[2].state).toBe("current");
  });

  it("never leaves a donor without an explanation", () => {
    for (const status of Object.values(STATUS)) {
      expect(statusExplanation({ status }).length).toBeGreaterThan(0);
    }
  });

  it("does not claim delivery is verified while the check is pending", () => {
    const text = statusExplanation({
      status: STATUS.DELIVERED,
      verification: { state: "pending" },
    });
    expect(text).toContain("checking");
    expect(text.toLowerCase()).not.toContain("verified");
  });
});
