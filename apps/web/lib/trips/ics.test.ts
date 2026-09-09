import { describe, expect, it } from "vitest";
import { buildCalendar, escapeText, foldLine, type CalendarEvent } from "./ics";

/**
 * iCalendar is a format that fails silently: a calendar handed a malformed file usually imports
 * nothing rather than complaining. These tests exist because "it looked fine in a text editor" is
 * not evidence that Google Calendar will accept it.
 */

const NOW = new Date("2026-09-09T02:00:00Z");

const event = (over: Partial<CalendarEvent> = {}): CalendarEvent => ({
  uid: "item-1@guidelesstravel.com",
  title: "Welcome drinks",
  date: "2027-06-02",
  startTime: "20:00",
  endTime: "22:30",
  timezone: "Europe/Paris",
  ...over,
});

describe("escapeText", () => {
  it("escapes the characters that would otherwise end a property early", () => {
    expect(escapeText("Nice, France; the old town")).toBe("Nice\\, France\\; the old town");
    expect(escapeText("back\\slash")).toBe("back\\\\slash");
  });

  it("turns real newlines into the literal escape, since a raw newline ends the line", () => {
    expect(escapeText("one\ntwo")).toBe("one\\ntwo");
    expect(escapeText("one\r\ntwo")).toBe("one\\ntwo");
  });
});

describe("foldLine", () => {
  it("leaves a short line alone", () => {
    expect(foldLine("SUMMARY:Short")).toBe("SUMMARY:Short");
  });

  it("folds a long line with a leading space on continuations", () => {
    const folded = foldLine(`DESCRIPTION:${"a".repeat(200)}`);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.slice(1).every((p) => p.startsWith(" "))).toBe(true);
    // Unfolding must give the original back exactly.
    expect(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join("")).toBe(
      `DESCRIPTION:${"a".repeat(200)}`,
    );
  });

  it("counts octets, not characters, so accents do not overflow a line", () => {
    // Each of these is two bytes, so 60 of them exceed 75 octets while being only 60 characters.
    const folded = foldLine(`LOCATION:${"é".repeat(60)}`);
    const encoder = new TextEncoder();
    for (const part of folded.split("\r\n")) {
      expect(encoder.encode(part).length).toBeLessThanOrEqual(75);
    }
  });
});

describe("buildCalendar", () => {
  it("produces a well-formed calendar with CRLF endings and a trailing one", () => {
    const ics = buildCalendar([event()], { name: "Monaco Grand Prix", now: NOW });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
    // A bare newline anywhere would break stricter clients.
    expect(/[^\r]\n/.test(ics)).toBe(false);
  });

  it("keeps a timed event in the trip's own zone rather than converting to UTC", () => {
    const ics = buildCalendar([event()], { name: "Trip", now: NOW });
    // 20:00 in Paris must stay 20:00 in Paris, whatever the importing device is set to. Converting
    // to UTC would bake in an offset that is wrong the moment daylight saving moves.
    expect(ics).toContain("DTSTART;TZID=Europe/Paris:20270602T200000");
    expect(ics).toContain("DTEND;TZID=Europe/Paris:20270602T223000");
    expect(ics).not.toContain("20270602T180000Z");
  });

  it("writes an untimed item as a whole day, with an exclusive end", () => {
    const ics = buildCalendar([event({ startTime: null, endTime: null })], {
      name: "Trip",
      now: NOW,
    });
    expect(ics).toContain("DTSTART;VALUE=DATE:20270602");
    // All-day DTEND is exclusive, so a one-day event ends on the next date.
    expect(ics).toContain("DTEND;VALUE=DATE:20270603");
  });

  it("gives an event with no end the same end as its start", () => {
    const ics = buildCalendar([event({ endTime: null })], { name: "Trip", now: NOW });
    expect(ics).toContain("DTEND;TZID=Europe/Paris:20270602T200000");
  });

  it("carries a stable uid, so re-importing updates rather than duplicates", () => {
    const first = buildCalendar([event()], { name: "Trip", now: NOW });
    const second = buildCalendar([event()], {
      name: "Trip",
      now: new Date("2026-10-01T00:00:00Z"),
    });
    expect(first).toContain("UID:item-1@guidelesstravel.com");
    expect(second).toContain("UID:item-1@guidelesstravel.com");
  });

  it("escapes free text inside a description without breaking the file", () => {
    const ics = buildCalendar(
      [event({ description: "Meet at the bar, 8 pm; bring nothing.", location: "Port Lympia" })],
      { name: "Trip", now: NOW },
    );
    expect(ics).toContain("Meet at the bar\\, 8 pm\\; bring nothing.");
    expect(ics).toContain("LOCATION:Port Lympia");
  });

  it("holds every event it was given", () => {
    const ics = buildCalendar([event(), event({ uid: "item-2", title: "Race" })], {
      name: "Trip",
      now: NOW,
    });
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics.match(/END:VEVENT/g)).toHaveLength(2);
  });

  it("is valid with no events at all, which is what an unstarted trip looks like", () => {
    const ics = buildCalendar([], { name: "Trip", now: NOW });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});
