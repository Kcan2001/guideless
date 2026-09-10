/**
 * Laying add-ons out across the days of a trip.
 *
 * The builder used to show three flat lists — race views, experiences, transfers — which asks a
 * traveler to hold the shape of a five-day weekend in their head. A race weekend is a diary, so
 * this turns the catalog into one: every day of the departure in order, with what is on offer
 * that day underneath it.
 *
 * Two rules carry the feature, and both come from the data rather than from the component:
 *
 *   * **An option can span days.** A three-day grandstand pass is chosen once and shown on all
 *     three days, marked as already covered on the days after the first. Without this a traveler
 *     reading Sunday sees no grandstand and assumes they have none.
 *   * **A conflict is a group *and* an overlapping day.** Two race views on the same day are a
 *     conflict; Saturday's yacht and Sunday's yacht are not. Anything without a `tier_group` never
 *     conflicts, which is what lets somebody take the coast boat at ten, the grandstand at three
 *     and the harbour party at nine.
 *
 * `addOnDays` mirrors the SQL function of the same name (migration 0073). The database is the
 * authority — `quote_booking()` re-checks every conflict — and this exists so the interface can
 * refuse a selection before the traveler gets a server error rather than after.
 */

export interface DayScoped {
  id: string;
  day_number: number | null;
  end_day_number: number | null;
  tier_group: string | null;
  /** "HH:MM:SS" when the option has a time; used to run a day in the order it happens. */
  start_time?: string | null;
}

/** Every day an add-on occupies, inclusive. Empty when it is not tied to a day at all. */
export function addOnDays(a: Pick<DayScoped, "day_number" | "end_day_number">): number[] {
  if (a.day_number == null) return [];
  const end = Math.max(a.end_day_number ?? a.day_number, a.day_number);
  return Array.from({ length: end - a.day_number + 1 }, (_, i) => a.day_number! + i);
}

export function spansDays(a: Pick<DayScoped, "day_number" | "end_day_number">): boolean {
  return addOnDays(a).length > 1;
}

export function daysOverlap(a: DayScoped, b: DayScoped): boolean {
  const ad = addOnDays(a);
  const bd = addOnDays(b);
  // An option with no day is not on any day, so it cannot clash with one that is.
  if (ad.length === 0 || bd.length === 0) return false;
  return ad.some((d) => bd.includes(d));
}

/** Same exclusive group and an overlapping day. This is the whole conflict rule. */
export function conflictsWith(a: DayScoped, b: DayScoped): boolean {
  if (a.id === b.id) return false;
  if (!a.tier_group || a.tier_group !== b.tier_group) return false;
  // Two options in one group with no days at all stay mutually exclusive, as they were before
  // spans existed — otherwise adding this feature would quietly loosen an unrelated rule.
  if (addOnDays(a).length === 0 && addOnDays(b).length === 0) return true;
  return daysOverlap(a, b);
}

export interface PlannedEntry<T> {
  addOn: T;
  /** The first day of the option's span — where the controls live. */
  isFirstDay: boolean;
  /** How the option reads on a later day of its span: chosen once, covered here. */
  carriedOver: boolean;
  /** Days it covers, for "Friday to Sunday" style copy. */
  days: number[];
}

export interface PlannedDay<T> {
  dayNumber: number;
  /** ISO date of this day of the departure, when the departure's start date is known. */
  date: string | null;
  title: string | null;
  destination: string | null;
  entries: Array<PlannedEntry<T>>;
}

export interface DayPlan<T> {
  days: Array<PlannedDay<T>>;
  /** Add-ons with no day at all — an extra night, insurance, anything trip-wide. */
  anytime: T[];
}

export interface TripDay {
  day_number: number;
  title?: string | null;
  destination?: string | null;
}

function isoPlusDays(startDate: string | null, offset: number): string | null {
  if (!startDate) return null;
  const d = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/**
 * Build the day-by-day plan.
 *
 * Days come from the itinerary when we have it and from the departure's length otherwise, so a
 * day with nothing on offer still appears — a gap in the diary is information ("nothing we sell
 * on Thursday"), and silently dropping the day makes the numbering lie.
 */
export function buildDayPlan<T extends DayScoped>({
  addOns,
  tripDays,
  dayCount,
  startDate,
}: {
  addOns: readonly T[];
  tripDays?: readonly TripDay[];
  dayCount?: number;
  startDate?: string | null;
}): DayPlan<T> {
  const fromAddOns = addOns.flatMap((a) => addOnDays(a));
  const highest = Math.max(
    dayCount ?? 0,
    ...(tripDays ?? []).map((d) => d.day_number),
    ...fromAddOns,
    0,
  );

  const meta = new Map<number, TripDay>();
  for (const d of tripDays ?? []) meta.set(d.day_number, d);

  const days: Array<PlannedDay<T>> = [];
  for (let n = 1; n <= highest; n += 1) {
    const entries: Array<PlannedEntry<T>> = [];
    for (const a of addOns) {
      const ds = addOnDays(a);
      if (!ds.includes(n)) continue;
      entries.push({
        addOn: a,
        isFirstDay: ds[0] === n,
        carriedOver: ds[0] !== n,
        days: ds,
      });
    }
    // A day should read in the order it happens: the ten o'clock boat before the three o'clock
    // grandstand. Anything untimed sinks to the end rather than interrupting the sequence.
    entries.sort((a, b) => {
      const at = a.addOn.start_time ?? null;
      const bt = b.addOn.start_time ?? null;
      if (at === bt) return 0;
      if (at === null) return 1;
      if (bt === null) return -1;
      return at < bt ? -1 : 1;
    });

    days.push({
      dayNumber: n,
      date: isoPlusDays(startDate ?? null, n - 1),
      title: meta.get(n)?.title ?? null,
      destination: meta.get(n)?.destination ?? null,
      entries,
    });
  }

  return { days, anytime: addOns.filter((a) => addOnDays(a).length === 0) };
}

/**
 * Which add-ons a traveler cannot take on a given day because they already hold a conflicting
 * one. Returns a map of blocked add-on id to the title of what blocks it, so the card can say
 * why rather than just going grey.
 */
export function blockedBy<T extends DayScoped & { title: string }>(
  addOns: readonly T[],
  heldIds: readonly string[],
): Map<string, string> {
  const held = addOns.filter((a) => heldIds.includes(a.id));
  const out = new Map<string, string>();
  for (const a of addOns) {
    if (heldIds.includes(a.id)) continue;
    const blocker = held.find((h) => conflictsWith(a, h));
    if (blocker) out.set(a.id, blocker.title);
  }
  return out;
}
