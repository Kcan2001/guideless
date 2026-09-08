import { isMissingColumnError, needsOnboarding, splitExtras } from "./extras";

describe("isMissingColumnError", () => {
  it("recognises the Postgres and PostgREST codes", () => {
    expect(isMissingColumnError({ code: "42703" })).toBe(true);
    expect(isMissingColumnError({ code: "PGRST204" })).toBe(true);
  });

  it("recognises the message when no code is given", () => {
    expect(isMissingColumnError({ message: 'column "party_type" does not exist' })).toBe(true);
    expect(
      isMissingColumnError({ message: "Could not find the 'excited_about' column of 'profiles'" }),
    ).toBe(true);
  });

  it("leaves unrelated failures alone", () => {
    expect(isMissingColumnError({ code: "23505", message: "duplicate key" })).toBe(false);
    expect(isMissingColumnError(null)).toBe(false);
  });
});

describe("splitExtras", () => {
  it("separates the columns an older database may not have", () => {
    const { base, extras } = splitExtras({
      display_name: "Kyle",
      bio: "Coffee first",
      party_type: "solo",
      traveling_from: "Santa Monica",
    });
    expect(base).toEqual({ display_name: "Kyle", bio: "Coffee first" });
    expect(extras).toEqual({ party_type: "solo", traveling_from: "Santa Monica" });
  });
});

describe("needsOnboarding", () => {
  it("prompts a traveler who has neither finished nor skipped", () => {
    expect(needsOnboarding({ onboarded_at: null })).toBe(true);
  });

  it("does not prompt once the flow has been completed or skipped", () => {
    expect(needsOnboarding({ onboarded_at: "2026-09-08T10:00:00Z" })).toBe(false);
  });

  it("stays quiet when there is no profile or the database predates the column", () => {
    expect(needsOnboarding(null)).toBe(false);
    expect(needsOnboarding({})).toBe(false);
  });
});
