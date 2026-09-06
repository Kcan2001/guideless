import { describe, expect, it } from "vitest";
import { daysBetweenDates, onboardingSteps, travelersComplete } from "./onboarding";

const base = {
  daysUntilStart: 180,
  balanceDue: 0,
  balanceDueDate: null,
  travelersComplete: true,
  appConnected: false,
  tripId: null,
};

describe("onboardingSteps", () => {
  it("shows only the quiet essentials six months out", () => {
    const keys = onboardingSteps(base).map((s) => s.key);
    expect(keys).toEqual(["booked", "travelers"]);
  });

  it("surfaces the balance as soon as one is owed, whatever the date", () => {
    const steps = onboardingSteps({ ...base, balanceDue: 70000, balanceDueDate: "2027-03-15" });
    const balance = steps.find((s) => s.key === "balance");
    expect(balance?.done).toBe(false);
    expect(balance?.href).toBe("#pay");
    expect(balance?.hint).toContain("2027-03-15");
  });

  it("adds the app inside 90 days and the group inside 30", () => {
    expect(onboardingSteps({ ...base, daysUntilStart: 60 }).map((s) => s.key)).toEqual([
      "booked",
      "travelers",
      "balance",
      "app",
    ]);
    expect(onboardingSteps({ ...base, daysUntilStart: 20 }).map((s) => s.key)).toEqual([
      "booked",
      "travelers",
      "balance",
      "app",
      "group",
    ]);
  });

  it("opens the group early when the trip is already activated", () => {
    const steps = onboardingSteps({ ...base, daysUntilStart: 45, tripId: "trip-1" });
    const group = steps.find((s) => s.key === "group");
    expect(group?.done).toBe(true);
    expect(group?.href).toBe("/trips/trip-1");
  });

  it("marks incomplete traveler details as the customer's next step", () => {
    const steps = onboardingSteps({ ...base, travelersComplete: false });
    expect(steps.find((s) => s.key === "travelers")).toMatchObject({
      done: false,
      href: "#travelers",
    });
  });

  it("shows final details in the last week", () => {
    const steps = onboardingSteps({ ...base, daysUntilStart: 3, tripId: "t", appConnected: true });
    expect(steps.map((s) => s.key)).toContain("final");
    expect(steps.every((s) => s.done)).toBe(true);
  });
});

describe("travelersComplete", () => {
  it("requires DOB, nationality and an emergency contact for every traveler", () => {
    expect(
      travelersComplete([
        { date_of_birth: "1990-01-01", nationality: "FR", hasEmergencyContact: true },
        { date_of_birth: "1988-05-05", nationality: "US", hasEmergencyContact: true },
      ]),
    ).toBe(true);
    expect(
      travelersComplete([
        { date_of_birth: "1990-01-01", nationality: null, hasEmergencyContact: true },
      ]),
    ).toBe(false);
    expect(travelersComplete([])).toBe(false);
  });
});

describe("daysBetweenDates", () => {
  it("counts whole calendar days across a DST change", () => {
    expect(daysBetweenDates("2027-03-20", "2027-04-03")).toBe(14);
    expect(daysBetweenDates("2027-05-15", "2027-05-14")).toBe(-1);
  });
});
