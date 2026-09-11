import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  daysUntilDeparture,
  formatDate,
  formatDateRange,
  formatInZone,
  formatWallTime,
  isValidTimeZone,
  offsetMinutes,
  toLocalDate,
  toLocalTime,
  zonedToUtc,
} from "./time";

describe("time zones", () => {
  it("validates IANA zones", () => {
    expect(isValidTimeZone("Europe/Paris")).toBe(true);
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });

  it("computes zone offsets including DST", () => {
    expect(offsetMinutes(new Date("2027-05-14T12:00:00Z"), "Europe/Paris")).toBe(120); // CEST
    expect(offsetMinutes(new Date("2027-01-14T12:00:00Z"), "Europe/Paris")).toBe(60); // CET
    expect(offsetMinutes(new Date("2027-05-14T12:00:00Z"), "America/New_York")).toBe(-240);
  });

  it("converts a local itinerary time to a UTC instant", () => {
    // 14:00 in Nice (CEST, UTC+2) on 14 May 2027 is 12:00Z.
    expect(zonedToUtc("2027-05-14", "14:00", "Europe/Paris").toISOString()).toBe(
      "2027-05-14T12:00:00.000Z",
    );
    // 09:30 in New York (EDT, UTC-4) is 13:30Z.
    expect(zonedToUtc("2027-05-14", "09:30", "America/New_York").toISOString()).toBe(
      "2027-05-14T13:30:00.000Z",
    );
    // Across the spring-forward boundary in Paris (28 Mar 2027, 02:00 → 03:00).
    expect(zonedToUtc("2027-03-28", "04:00", "Europe/Paris").toISOString()).toBe(
      "2027-03-28T02:00:00.000Z",
    );
  });

  it("displays in the EVENT's zone, not the viewer's", () => {
    const trainDeparture = "2027-05-17T07:12:00Z"; // 09:12 in Avignon
    expect(toLocalTime(trainDeparture, "Europe/Paris")).toBe("09:12");
    expect(toLocalDate(trainDeparture, "Europe/Paris")).toBe("2027-05-17");
    // Same instant is still the previous evening in Los Angeles.
    expect(toLocalDate(trainDeparture, "America/Los_Angeles")).toBe("2027-05-17");
    expect(toLocalTime(trainDeparture, "America/Los_Angeles")).toBe("00:12");
    expect(toLocalDate("2027-05-17T05:00:00Z", "America/Los_Angeles")).toBe("2027-05-16");
  });

  it("formats human-readable local times", () => {
    expect(formatInZone("2027-06-08T17:30:00Z", "Europe/Paris")).toBe("Tue, Jun 8 · 7:30 PM");
    expect(formatInZone("2027-06-08T17:30:00Z", "Europe/Paris", { includeDate: false })).toBe(
      "7:30 PM",
    );
  });

  it("formats wall times and calendar dates without zone shifts", () => {
    expect(formatWallTime("10:52:00")).toBe("10:52 AM");
    expect(formatWallTime("19:00")).toBe("7:00 PM");
    expect(formatDate("2027-05-14")).toBe("May 14, 2027");
    expect(formatDate("2027-05-14", "en-US", { weekday: "long" })).toBe("Friday");
    expect(formatDateRange("2027-05-14", "2027-05-22")).toMatch(/May 14\s*[–-]\s*22, 2027/);
    expect(formatDateRange("2027-09-28", "2027-10-06")).toMatch(/Sep 28\s*[–-]\s*Oct 6, 2027/);
  });

  it("emits only ordinary spaces, so the server and the browser agree byte for byte", () => {
    // Node and the browser ship different ICU builds and disagree about the space around an
    // en-dash: Node gives U+2009 thin spaces, Chrome gives U+0020. Identical to the eye, different
    // to `===`, which is all React needs to throw a hydration mismatch — this is what made the
    // builder throw React #418 on a clean first load.
    //
    // The `\s*` in the assertions above is why it survived: that pattern matches either one, so the
    // test passed while the bug shipped. These assert the exact string.
    const exotic = /[    ]/;
    expect(formatDateRange("2027-06-02", "2027-06-07")).toBe("Jun 2 – 7, 2027");
    expect(formatDateRange("2027-06-02", "2027-06-07")).not.toMatch(exotic);
    expect(formatDateRange("2027-09-28", "2027-10-06")).not.toMatch(exotic);
    expect(formatDate("2027-06-02")).not.toMatch(exotic);
  });

  it("does calendar-day arithmetic", () => {
    expect(daysBetween("2027-05-14", "2027-05-23")).toBe(9);
    expect(daysBetween("2027-05-23", "2027-05-14")).toBe(-9);
    expect(addDays("2027-05-14", 9)).toBe("2027-05-23");
    expect(addDays("2027-12-30", 3)).toBe("2028-01-02");
  });

  it("measures days until departure in the departure's zone", () => {
    // 23:30 in New York on 13 May is already 14 May in Paris → 0 days, not 1.
    const now = new Date("2027-05-14T03:30:00Z");
    expect(daysUntilDeparture("2027-05-14", "Europe/Paris", now)).toBe(0);
    expect(daysUntilDeparture("2027-05-14", "America/New_York", now)).toBe(1);
  });
});
