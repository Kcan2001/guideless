import { describe, expect, it } from "vitest";
import {
  cancellationWindows,
  describeLadder,
  freeUntil,
  freeUntilDay,
  isFreeAt,
  penaltyAt,
} from "./cancellation-policy";
import type { CancellationPolicy } from "./types";

/**
 * The shape these tests defend: a supplier ladder, not a single deadline. A LiteAPI probe of one
 * hotel over one date range returned 200 rates, 116 of which carried more than one window and the
 * deepest five. The old single-deadline model silently dropped the middle rungs.
 *
 * These assert behaviour, never a price: the amounts below are fixtures, not catalog values.
 */

const ladder: CancellationPolicy = {
  windows: [
    { from: "2027-05-01T10:00:00Z", penaltyAmount: 5_000 },
    { from: "2027-05-20T10:00:00Z", penaltyAmount: 20_000 },
    { from: "2027-05-28T10:00:00Z", penaltyAmount: 48_000 },
  ],
};

describe("cancellationWindows", () => {
  it("returns the ladder in ascending order however the supplier sent it", () => {
    const jumbled: CancellationPolicy = {
      windows: [
        { from: "2027-05-28T10:00:00Z", penaltyAmount: 48_000 },
        { from: "2027-05-01T10:00:00Z", penaltyAmount: 5_000 },
        { from: "2027-05-20T10:00:00Z", penaltyAmount: 20_000 },
      ],
    };
    expect(cancellationWindows(jumbled).map((w) => w.penaltyAmount)).toEqual([
      5_000, 20_000, 48_000,
    ]);
  });

  it("folds a legacy single deadline into a one-rung ladder", () => {
    const legacy: CancellationPolicy = { deadline: "2027-05-20T23:59:00Z", penaltyAmount: 12_000 };
    expect(cancellationWindows(legacy)).toEqual([
      { from: "2027-05-20T23:59:00Z", penaltyAmount: 12_000 },
    ]);
  });

  it("prefers the ladder when a row carries both", () => {
    const both: CancellationPolicy = { ...ladder, deadline: "2020-01-01T00:00:00Z" };
    expect(cancellationWindows(both)).toHaveLength(3);
    expect(freeUntil(both)).toBe("2027-05-01T10:00:00Z");
  });

  it("drops a window with an unreadable timestamp rather than guessing where it sits", () => {
    const broken: CancellationPolicy = {
      windows: [
        { from: "not a date", penaltyAmount: 999 },
        { from: "2027-05-01T10:00:00Z", penaltyAmount: 5_000 },
      ],
    };
    expect(cancellationWindows(broken)).toEqual([
      { from: "2027-05-01T10:00:00Z", penaltyAmount: 5_000 },
    ]);
  });

  it("is empty for a policy with nothing in it", () => {
    expect(cancellationWindows({ description: "Non-refundable" })).toEqual([]);
    expect(cancellationWindows(null)).toEqual([]);
  });
});

describe("freeUntil", () => {
  it("is the earliest rung, which is when free cancellation ends", () => {
    expect(freeUntil(ladder)).toBe("2027-05-01T10:00:00Z");
    expect(freeUntilDay(ladder)).toBe("2027-05-01");
  });

  it("is null when there is no ladder at all", () => {
    expect(freeUntil({ description: "Non-refundable" })).toBeNull();
    expect(freeUntilDay(null)).toBe("");
  });
});

describe("penaltyAt", () => {
  it("charges nothing before the first rung", () => {
    expect(penaltyAt(ladder, "2027-04-01T00:00:00Z")).toBe(0);
    expect(isFreeAt(ladder, "2027-04-01T00:00:00Z")).toBe(true);
  });

  it("charges the middle rung in the middle, which the old model could not express", () => {
    expect(penaltyAt(ladder, "2027-05-10T00:00:00Z")).toBe(5_000);
    expect(penaltyAt(ladder, "2027-05-22T00:00:00Z")).toBe(20_000);
    expect(isFreeAt(ladder, "2027-05-10T00:00:00Z")).toBe(false);
  });

  it("charges the deepest rung after the last one opens", () => {
    expect(penaltyAt(ladder, "2027-06-01T00:00:00Z")).toBe(48_000);
  });

  it("treats the boundary as already inside the window", () => {
    expect(penaltyAt(ladder, "2027-05-01T10:00:00Z")).toBe(5_000);
  });

  it("returns zero for a policy with no windows, which is not the same as free", () => {
    // The caller distinguishes these with NormalizedRate.refundable; this function cannot.
    expect(penaltyAt({ description: "Non-refundable" }, "2027-06-01T00:00:00Z")).toBe(0);
  });
});

describe("describeLadder", () => {
  it("summarises every rung for a staff screen", () => {
    const text = describeLadder(ladder);
    expect(text).toContain("Free until 2027-05-01");
    expect(text).toContain("2027-05-20");
    expect(text).toContain("2027-05-28");
  });

  it("falls back to the supplier's own words when there is no ladder", () => {
    expect(describeLadder({ description: "Non-refundable" })).toBe("Non-refundable");
  });
});
