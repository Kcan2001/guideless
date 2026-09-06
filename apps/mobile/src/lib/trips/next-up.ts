import type { Tables } from "@guideless/types";
import { toLocalDate, toLocalTime } from "@guideless/utils";

/**
 * Pure "what do I need to know right now?" logic for the Trip home screen (spec §23).
 * No I/O; unit-tested in next-up.test.ts.
 */

type Trip = Pick<Tables<"trips">, "id" | "status" | "start_date" | "end_date">;
type Day = Pick<Tables<"trip_days">, "id" | "day_number" | "date" | "timezone">;
type Item = Pick<
  Tables<"trip_itinerary_items">,
  "id" | "start_time" | "end_time" | "is_optional" | "status" | "type"
>;

/** Active trip first, else the soonest upcoming, else the most recently completed. */
export function pickCurrentTrip<T extends Trip>(trips: T[], todayISO: string): T | null {
  const live = trips.filter((t) => t.status !== "cancelled");
  const active = live.find(
    (t) => t.status === "active" || (t.start_date <= todayISO && t.end_date >= todayISO),
  );
  if (active) return active;
  const upcoming = live
    .filter((t) => t.start_date > todayISO)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  if (upcoming[0]) return upcoming[0];
  const past = live
    .filter((t) => t.end_date < todayISO)
    .sort((a, b) => b.end_date.localeCompare(a.end_date));
  return past[0] ?? null;
}

export type TripPhase = "before" | "during" | "after";

export function tripPhase(trip: Trip, todayISO: string): TripPhase {
  if (todayISO < trip.start_date) return "before";
  if (todayISO > trip.end_date) return "after";
  return "during";
}

/**
 * The day to show: today (in that day's zone) during the trip, day 1 before it, the last day after.
 * Each day carries its own IANA zone, so "today" is evaluated per day.
 */
export function currentDay<D extends Day>(days: D[], now: Date): D | null {
  if (days.length === 0) return null;
  const sorted = [...days].sort((a, b) => a.day_number - b.day_number);
  const today = sorted.find((d) => toLocalDate(now, d.timezone) === d.date);
  if (today) return today;
  const first = sorted[0]!;
  if (toLocalDate(now, first.timezone) < first.date) return first;
  return sorted[sorted.length - 1]!;
}

export interface NextUp<I> {
  /** Item happening right now (started, not yet ended). */
  current: I | null;
  /** Next item that has not started yet. */
  next: I | null;
  /** Remaining optional items today (e.g. tonight's welcome drinks). */
  optionalLater: I[];
}

const hhmm = (t: string) => t.slice(0, 5);

/** Given a day's items (ordered) and the local wall clock "HH:mm", split into current / next. */
export function nextUp<I extends Item>(items: I[], nowLocal: string): NextUp<I> {
  const live = items.filter((i) => i.status !== "cancelled");
  const now = hhmm(nowLocal);
  const current =
    live.find(
      (i) => i.start_time && hhmm(i.start_time) <= now && (!i.end_time || hhmm(i.end_time) > now),
    ) ?? null;
  const next = live.find((i) => i.start_time && hhmm(i.start_time) > now) ?? null;
  const optionalLater = live.filter(
    (i) => i.is_optional && i.start_time && hhmm(i.start_time) > now && i !== next,
  );
  return { current, next, optionalLater };
}

/** Whole minutes from `nowLocal` until `startTime` (both local wall time, same day). */
export function minutesUntil(startTime: string, nowLocal: string): number {
  const [sh = 0, sm = 0] = hhmm(startTime).split(":").map(Number);
  const [nh = 0, nm = 0] = hhmm(nowLocal).split(":").map(Number);
  return sh * 60 + sm - (nh * 60 + nm);
}

/** Local wall clock for a zone, "HH:mm". */
export function localClock(now: Date, timezone: string): string {
  return toLocalTime(now, timezone);
}

/** "Good morning" / "Good afternoon" / "Good evening" for the local hour. */
export function greeting(nowLocal: string): string {
  const h = Number(hhmm(nowLocal).split(":")[0]);
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
