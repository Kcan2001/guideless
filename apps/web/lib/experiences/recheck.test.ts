import { describe, expect, it } from "vitest";
import { ABSORB_FRACTION, blockedMessage, decideRecheck } from "@/lib/experiences/recheck";

/**
 * What happens when a supplier's price moves between the quote and the charge.
 *
 * This is commercial policy expressed as a function, which is exactly why it is tested rather than
 * inlined into a checkout: the cases that cost money — a rate that drifted, a rate that vanished,
 * a margin that went negative — are the ones nobody exercises by hand.
 */

const base = {
  customerAmount: 9500,
  originalNetAmount: 6500,
  currentNetAmount: 6500,
  available: true,
};

describe("when nothing has changed", () => {
  it("proceeds with no drift", () => {
    expect(decideRecheck(base)).toEqual({ action: "proceed", driftAmount: 0 });
  });

  it("proceeds when the supplier got cheaper, and records it as negative drift", () => {
    const decision = decideRecheck({ ...base, currentNetAmount: 6000 });
    expect(decision.action).toBe("proceed");
    expect(decision.driftAmount).toBe(-500);
  });
});

describe("when the price moved", () => {
  it("absorbs a small rise rather than re-pricing somebody mid-checkout", () => {
    // 5% of 6500 is 325, so 6800 is inside what we swallow.
    const decision = decideRecheck({ ...base, currentNetAmount: 6800 });
    expect(decision.action).toBe("proceed");
  });

  it("still sells a larger rise, but flags it for somebody to look at", () => {
    const decision = decideRecheck({ ...base, currentNetAmount: 7800 });
    expect(decision.action).toBe("proceed_with_margin_warning");
    expect(decision).toMatchObject({ driftAmount: 1300, marginAmount: 1700 });
  });

  // The traveler is looking at a price. It does not change under them for either outcome above.
  it("charges the advertised price either way", () => {
    for (const current of [6500, 6800, 7800]) {
      const decision = decideRecheck({ ...base, currentNetAmount: current });
      expect(decision.action).not.toBe("block");
    }
  });

  it("uses the stated fraction rather than a magic number", () => {
    const justInside =
      base.originalNetAmount + Math.round(base.originalNetAmount * ABSORB_FRACTION);
    expect(decideRecheck({ ...base, currentNetAmount: justInside }).action).toBe("proceed");
    expect(decideRecheck({ ...base, currentNetAmount: justInside + 1 }).action).toBe(
      "proceed_with_margin_warning",
    );
  });
});

describe("when it should not be sold", () => {
  it("blocks a withdrawn option instead of charging for nothing", () => {
    expect(decideRecheck({ ...base, currentNetAmount: null })).toMatchObject({
      action: "block",
      reason: "withdrawn",
    });
  });

  it("blocks one that sold out", () => {
    expect(decideRecheck({ ...base, available: false })).toMatchObject({
      action: "block",
      reason: "sold_out",
    });
  });

  // Selling below cost is a decision a person makes, never one a checkout makes for them.
  it("blocks rather than quietly selling at a loss", () => {
    expect(decideRecheck({ ...base, currentNetAmount: 9900 })).toMatchObject({
      action: "block",
      reason: "margin_lost",
    });
  });

  it("treats breaking even as sellable", () => {
    expect(decideRecheck({ ...base, currentNetAmount: 9500 }).action).not.toBe("block");
  });
});

describe("what the traveler is told", () => {
  it("says nothing was charged, whatever went wrong", () => {
    for (const reason of ["withdrawn", "sold_out", "margin_lost"] as const) {
      expect(blockedMessage(reason)).toMatch(/nothing has been charged/i);
    }
  });

  // Our margin is our business. A customer must never read the real reason for this one.
  it("never mentions cost, margin or a supplier", () => {
    for (const reason of ["withdrawn", "sold_out", "margin_lost"] as const) {
      const message = blockedMessage(reason).toLowerCase();
      expect(message).not.toContain("margin");
      expect(message).not.toContain("cost");
      expect(message).not.toContain("supplier");
    }
  });
});
