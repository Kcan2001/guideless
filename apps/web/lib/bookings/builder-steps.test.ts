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
  it("shows every step for an event departure with tiers, experiences and transfers", () => {
    const steps = deriveBuilderSteps(monaco).map((s) => s.key);
    expect(steps).toEqual([
      "dates",
      "stay",
      "race",
      "experiences",
      "transfers",
      "travelers",
      "review",
      "payment",
    ]);
  });

  it("phrases the race step with the event name, minus the series prefix", () => {
    const race = deriveBuilderSteps(monaco).find((s) => s.key === "race");
    expect(race?.title).toBe("How do you want to watch Monaco Grand Prix 2027?");
  });

  it("drops the race, transfer and stay steps when the departure has none", () => {
    const steps = deriveBuilderSteps({
      stayOptionCount: 0,
      addOns: [{ tier_group: null, kind: "activity" }],
    }).map((s) => s.key);
    expect(steps).toEqual(["dates", "experiences", "travelers", "review", "payment"]);
  });

  it("always keeps dates, travelers, review and payment", () => {
    const steps = deriveBuilderSteps({ stayOptionCount: 0, addOns: [] }).map((s) => s.key);
    expect(steps).toEqual(["dates", "travelers", "review", "payment"]);
  });
});

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
