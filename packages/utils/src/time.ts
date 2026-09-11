import type { ISODate, ISOTimestamp, TimeZone } from "@guideless/types";

/**
 * Time-zone helpers. Travel software must be time-zone aware:
 *  - store instants in UTC,
 *  - store the event's IANA zone alongside it,
 *  - display in the EVENT's zone, never the phone's zone.
 *
 * Dependency-free (Intl only) so it runs identically in Next.js, Expo and Deno edge functions.
 */

export function isValidTimeZone(tz: string): tz is TimeZone {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

interface ZonedParts {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function partsInZone(instant: Date, timeZone: TimeZone): ZonedParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const p of dtf.formatToParts(instant)) map[p.type] = p.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/** Offset of `timeZone` from UTC at `instant`, in minutes (e.g. Europe/Paris in May → 120). */
export function offsetMinutes(instant: Date, timeZone: TimeZone): number {
  const p = partsInZone(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/**
 * Combine a local calendar date + "HH:mm" in a zone into a UTC instant.
 * zonedToUtc("2027-05-14", "14:00", "Europe/Paris") → 2027-05-14T12:00:00.000Z
 */
export function zonedToUtc(date: ISODate, time: string, timeZone: TimeZone): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  // First guess: treat the wall time as UTC, then correct by the zone offset at that instant.
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const offset1 = offsetMinutes(guess, timeZone);
  const candidate = new Date(guess.getTime() - offset1 * 60_000);
  // Re-check in case we crossed a DST boundary.
  const offset2 = offsetMinutes(candidate, timeZone);
  return offset1 === offset2 ? candidate : new Date(guess.getTime() - offset2 * 60_000);
}

/** Local calendar date ("YYYY-MM-DD") of an instant in a zone. */
export function toLocalDate(instant: Date | ISOTimestamp, timeZone: TimeZone): ISODate {
  const p = partsInZone(new Date(instant), timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Local wall time ("HH:mm") of an instant in a zone. */
export function toLocalTime(instant: Date | ISOTimestamp, timeZone: TimeZone): string {
  const p = partsInZone(new Date(instant), timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Human display in the event's zone: "Tue, Jun 9 · 7:30 PM". */
export function formatInZone(
  instant: Date | ISOTimestamp,
  timeZone: TimeZone,
  options: { locale?: string; includeDate?: boolean; includeZone?: boolean } = {},
): string {
  const { locale = "en-US", includeDate = true, includeZone = false } = options;
  const d = new Date(instant);
  const time = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    ...(includeZone ? { timeZoneName: "short" } : {}),
  }).format(d);
  if (!includeDate) return time;
  const date = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
  return `${date} · ${time}`;
}

/** Whole calendar days from `from` to `to` (both "YYYY-MM-DD"). Positive when `to` is later. */
export function daysBetween(from: ISODate, to: ISODate): number {
  const a = Date.UTC(...splitDate(from));
  const b = Date.UTC(...splitDate(to));
  return Math.round((b - a) / 86_400_000);
}

/** Add calendar days to a "YYYY-MM-DD" date. */
export function addDays(date: ISODate, days: number): ISODate {
  const [y, m, d] = splitDate(date);
  const t = new Date(Date.UTC(y, m, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Days until a departure date, measured in the departure's local zone as of `now`. */
export function daysUntilDeparture(
  departureDate: ISODate,
  timeZone: TimeZone,
  now: Date = new Date(),
): number {
  return daysBetween(toLocalDate(now, timeZone), departureDate);
}

/** "10:52:00" or "10:52" → "10:52 AM" (locale-aware, no zone conversion — wall time is already local). */
export function formatWallTime(time: string, locale = "en-US"): string {
  const [h = 0, m = 0] = time.split(":").map(Number);
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, 0, 1, h, m)));
}

/** "2027-05-14" → "May 14, 2027" (or per `options`). Calendar dates never shift with zones. */
export function formatDate(
  date: ISODate,
  locale = "en-US",
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" },
): string {
  const [y, m, d] = splitDate(date);
  return normalizeSpaces(
    new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(
      new Date(Date.UTC(y, m, d)),
    ),
  );
}

/**
 * Collapse the exotic spaces `Intl` emits into ordinary ones.
 *
 * Node and the browser ship different ICU builds, and they disagree about which space goes around
 * an en-dash. For the same range, Node returns "Jun 2 – 7, 2027" (thin spaces) and Chrome
 * returns "Jun 2 – 7, 2027" (ordinary ones). They are identical to the eye and different to
 * `===`, which is all React needs to throw a hydration mismatch — every client component rendering
 * a date range hydrated dirty, and the builder threw React #418 on a clean first load.
 *
 * Normalising here rather than at each call site means any formatter added later inherits the fix.
 * U+2009 thin space, U+202F narrow no-break space, U+00A0 no-break space, U+2007 figure space.
 */
function normalizeSpaces(formatted: string): string {
  return formatted.replace(/[    ]/g, " ");
}

/** "2027-05-14", "2027-05-22" → "May 14 – 22, 2027"; crosses months/years gracefully. */
export function formatDateRange(start: ISODate, end: ISODate, locale = "en-US"): string {
  const [sy, sm, sd] = splitDate(start);
  const [ey, em, ed] = splitDate(end);
  return normalizeSpaces(
    new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).formatRange(new Date(Date.UTC(sy, sm, sd)), new Date(Date.UTC(ey, em, ed))),
  );
}

function splitDate(date: ISODate): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return [y, m - 1, d];
}
