import { describe, expect, it } from "vitest";
import { dropCountdown, dropState } from "./drops";

const NOW = new Date("2027-01-10T12:00:00Z");
const at = (iso: string) => dropState(iso, NOW);

describe("dropState", () => {
  it("treats a departure with no drop as open", () => {
    expect(dropState(null, NOW).open).toBe(true);
    expect(dropState(undefined, NOW).open).toBe(true);
  });

  it("is closed while the drop is ahead", () => {
    const s = at("2027-01-12T12:00:00Z");
    expect(s.open).toBe(false);
    expect(s.secondsUntil).toBe(172800);
    expect(s.opensAt?.toISOString()).toBe("2027-01-12T12:00:00.000Z");
  });

  it("opens the moment the drop passes", () => {
    expect(at("2027-01-10T12:00:00Z").open).toBe(true);
    expect(at("2027-01-10T11:59:59Z").open).toBe(true);
  });

  it("falls open rather than closed when the date is unreadable", () => {
    // A bad value must never lock a bookable departure; the database refuses anyway.
    expect(dropState("not-a-date", NOW).open).toBe(true);
  });
});

describe("dropCountdown", () => {
  it("uses one unit and rounds to it", () => {
    expect(dropCountdown(0)).toBe("Open now");
    expect(dropCountdown(90)).toBe("Opens in 2 minutes");
    expect(dropCountdown(60)).toBe("Opens in 1 minute");
    expect(dropCountdown(3 * 3600)).toBe("Opens in 3 hours");
    expect(dropCountdown(72 * 3600)).toBe("Opens in 3 days");
  });

  it("switches from hours to days after two days", () => {
    expect(dropCountdown(47 * 3600)).toBe("Opens in 47 hours");
    expect(dropCountdown(49 * 3600)).toBe("Opens in 2 days");
  });
});
