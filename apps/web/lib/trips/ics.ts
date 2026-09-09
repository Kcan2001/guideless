/**
 * The trip as an iCalendar feed, so it lands in whatever calendar a traveler already uses.
 *
 * Pure and dependency-free on purpose: an .ics file is a fussy text format and the fussiness is
 * worth testing rather than trusting to a library. Notably it is CRLF-terminated, lines fold at 75
 * octets, and a handful of characters must be escaped or the whole file is rejected — usually
 * silently, with the calendar simply importing nothing.
 *
 * Times: every item carries its own IANA zone, and an event that is `10:00 Europe/Paris` must stay
 * 10:00 in Paris regardless of where the phone importing it happens to be. That is expressed with a
 * floating local time plus TZID rather than by converting to UTC, because converting bakes in an
 * offset that is wrong the moment daylight saving moves.
 */

export interface CalendarEvent {
  /** Stable across regenerations: a calendar updates rather than duplicates when this matches. */
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** Wall-clock HH:MM in `timezone`. Absent means an all-day entry. */
  startTime?: string | null;
  endTime?: string | null;
  timezone: string;
  url?: string | null;
}

/** RFC 5545 §3.3.11: backslash, semicolon and comma are escaped; newlines become literal \n. */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Fold to 75 octets per line, continuing with a single leading space.
 *
 * Counted in octets, not characters: a line of accented French place names is longer than it looks,
 * and folding mid-codepoint produces a file that some calendars reject outright.
 */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    // 74 leaves room for the leading space that marks a continuation.
    if (bytes + size > (out.length === 0 ? 75 : 74)) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  if (current) out.push(current);
  return out.map((part, i) => (i === 0 ? part : ` ${part}`)).join("\r\n");
}

const stamp = (d: Date) => `${d.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
const dateOnly = (iso: string) => iso.replace(/-/g, "");
const wall = (date: string, time: string) => `${dateOnly(date)}T${time.replace(":", "")}00`;

/** The day after `date`, because an all-day DTEND is exclusive. */
function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return dateOnly(d.toISOString().slice(0, 10));
}

function eventLines(event: CalendarEvent, now: Date): string[] {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${stamp(now)}`,
    `SUMMARY:${escapeText(event.title)}`,
  ];

  if (event.startTime) {
    lines.push(`DTSTART;TZID=${event.timezone}:${wall(event.date, event.startTime)}`);
    // A calendar entry with no end is rendered inconsistently, so give an untimed end the same
    // start rather than leaving DTEND out entirely.
    lines.push(
      `DTEND;TZID=${event.timezone}:${wall(event.date, event.endTime ?? event.startTime)}`,
    );
  } else {
    lines.push(`DTSTART;VALUE=DATE:${dateOnly(event.date)}`);
    lines.push(`DTEND;VALUE=DATE:${nextDay(event.date)}`);
  }

  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.url) lines.push(`URL:${escapeText(event.url)}`);
  lines.push("END:VEVENT");
  return lines;
}

/**
 * A complete calendar. `name` becomes the calendar's title in most clients.
 *
 * No VTIMEZONE blocks are emitted. Every client in use resolves an IANA TZID itself, and a
 * hand-written VTIMEZONE that disagrees with the real rules is worse than none at all.
 */
export function buildCalendar(
  events: CalendarEvent[],
  opts: { name: string; description?: string; now?: Date } = { name: "Your trip" },
): string {
  const now = opts.now ?? new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Guideless Travel//Trip//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(opts.name)}`,
  ];
  if (opts.description) lines.push(`X-WR-CALDESC:${escapeText(opts.description)}`);
  for (const event of events) lines.push(...eventLines(event, now));
  lines.push("END:VCALENDAR");
  // CRLF throughout, and a trailing one: RFC 5545 requires it and some clients enforce it.
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
