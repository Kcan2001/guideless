import { describe, expect, it } from "vitest";
import {
  POST_FROM_HOUR,
  POST_UNTIL_HOUR,
  composePost,
  isPostingHour,
  localClock,
} from "@/lib/assistant/schedule";

/**
 * The most-read message on the trip, so the wording is tested rather than trusted.
 *
 * The other half is the clock. Trips run in different zones and the cron fires hourly, so the
 * window logic is what stops a group in Nice being messaged at 3am — and it is arithmetic on a
 * time zone, which is exactly the kind of thing that is wrong twice a year without a test.
 */

const activity = (over: Partial<Parameters<typeof composePost>[0][number]> = {}) => ({
  item_id: "a",
  title: "Morning swim off the old town",
  start_time: "08:00:00",
  location_name: "Castel Plage steps",
  instructions: null,
  ...over,
});

describe("the morning post", () => {
  it("leads with the fact that it is free and optional", () => {
    const text = composePost([activity()]);
    expect(text).toContain("Free today");
    expect(text).toContain("nobody has to come");
  });

  it("gives the time, the thing and where to meet", () => {
    const text = composePost([activity()]);
    expect(text).toContain("08:00");
    expect(text).toContain("Morning swim off the old town");
    expect(text).toContain("meet at Castel Plage steps");
  });

  it("does not invent a meeting point it was not given", () => {
    const text = composePost([activity({ location_name: null })]);
    expect(text).not.toContain("meet at");
  });

  it("handles an activity with no fixed time", () => {
    expect(composePost([activity({ start_time: null })])).toContain("any time");
  });

  it("includes the instructions when there are any", () => {
    const text = composePost([
      activity({ instructions: "Bring a towel; it is colder than it looks." }),
    ]);
    expect(text).toContain("colder than it looks");
  });

  it("lists several without pretending there is only one", () => {
    const text = composePost([
      activity(),
      activity({ title: "Walk up Castle Hill", start_time: "17:30:00" }),
    ]);
    expect(text).toContain("any of them");
    expect(text).toContain("Walk up Castle Hill");
  });

  // The whole tone of the product in one line: organised, never compulsory.
  it("closes by saying the day is theirs", () => {
    expect(composePost([activity()])).toContain("Your day is yours");
  });
});

describe("the posting window", () => {
  const hourIn = (zone: string, iso: string) =>
    Number(localClock(zone, new Date(iso)).time.slice(0, 2));

  it("is somebody's morning, not the server's", () => {
    // 06:00 UTC is 08:00 in Nice (summer) and 02:00 in New York.
    expect(isPostingHour("Europe/Paris", new Date("2027-05-20T06:00:00Z"))).toBe(true);
    expect(isPostingHour("America/New_York", new Date("2027-05-20T06:00:00Z"))).toBe(false);
  });

  it("does not fire in the middle of the night anywhere", () => {
    for (const zone of ["Europe/Paris", "America/New_York", "Asia/Tokyo", "Australia/Sydney"]) {
      for (let utcHour = 0; utcHour < 24; utcHour += 1) {
        const iso = `2027-05-20T${String(utcHour).padStart(2, "0")}:00:00Z`;
        const local = hourIn(zone, iso);
        if (isPostingHour(zone, new Date(iso))) {
          expect(local).toBeGreaterThanOrEqual(POST_FROM_HOUR);
          expect(local).toBeLessThan(POST_UNTIL_HOUR);
        }
      }
    }
  });

  it("opens exactly once a day per zone, over a full day of hourly runs", () => {
    let opens = 0;
    for (let utcHour = 0; utcHour < 24; utcHour += 1) {
      const iso = `2027-05-20T${String(utcHour).padStart(2, "0")}:00:00Z`;
      if (isPostingHour("Europe/Paris", new Date(iso))) opens += 1;
    }
    // Three hourly runs fall inside the window; the unique key makes the last two no-ops, which
    // is the point of claiming the day before posting.
    expect(opens).toBe(POST_UNTIL_HOUR - POST_FROM_HOUR);
  });
});
