import { describe, expect, it } from "vitest";
import {
  deriveBuilderSteps,
  nextStep,
  partitionAddOns,
  previousStep,
  resolveStep,
} from "./builder-steps";

const monaco = {
  stayOptionCount: 2,
  eventName: "Formula 1 Monaco Grand Prix 2027",
  addOns: [
    { tier_group: "race_view", kind: "ticket" },
    { tier_group: "race_view", kind: "ticket" },
    { tier_group: null, kind: "activity" },
    { tier_group: null, kind: "transfer" },
  ],
};

describe("deriveBuilderSteps", () => {
  it("puts everything optional into one day-by-day step", () => {
    const steps = deriveBuilderSteps(monaco).map((s) => s.key);
    expect(steps).toEqual(["dates", "stay", "days", "travelers", "review", "payment"]);
  });

  it("phrases the day step with the event name, minus the series prefix", () => {
    const days = deriveBuilderSteps(monaco).find((s) => s.key === "days");
    expect(days?.title).toBe("How do you want to spend Monaco Grand Prix 2027?");
  });

  it("keeps the day step for a departure whose only extras are experiences", () => {
    const steps = deriveBuilderSteps({
      stayOptionCount: 0,
      addOns: [{ tier_group: null, kind: "activity" }],
    }).map((s) => s.key);
    expect(steps).toEqual(["dates", "days", "travelers", "review", "payment"]);
  });

  it("drops the day step entirely when there is nothing optional to sell", () => {
    const steps = deriveBuilderSteps({ stayOptionCount: 1, addOns: [] }).map((s) => s.key);
    expect(steps).toEqual(["dates", "stay", "travelers", "review", "payment"]);
  });

  it("always keeps dates, travelers, review and payment", () => {
    const steps = deriveBuilderSteps({ stayOptionCount: 0, addOns: [] }).map((s) => s.key);
    expect(steps).toEqual(["dates", "travelers", "review", "payment"]);
  });
});

// Still used by the tour page, which groups the same way when it is selling rather than booking.
describe("partitionAddOns", () => {
  it("splits tiers, transfers and the rest", () => {
    const parts = partitionAddOns(monaco.addOns);
    expect(parts.race).toHaveLength(2);
    expect(parts.experiences).toHaveLength(1);
    expect(parts.transfers).toHaveLength(1);
  });
});

describe("step navigation", () => {
  const steps = deriveBuilderSteps(monaco);
  it("resolves unknown or missing steps to the first", () => {
    expect(resolveStep(steps, undefined)).toBe("dates");
    expect(resolveStep(steps, "nonsense")).toBe("dates");
    expect(resolveStep(steps, "review")).toBe("review");
  });
  it("skips absent steps when moving forward or back", () => {
    const few = deriveBuilderSteps({ stayOptionCount: 0, addOns: [] });
    expect(nextStep(few, "dates")).toBe("travelers");
    expect(previousStep(few, "travelers")).toBe("dates");
    expect(nextStep(few, "payment")).toBeNull();
    expect(previousStep(few, "dates")).toBeNull();
  });
});
