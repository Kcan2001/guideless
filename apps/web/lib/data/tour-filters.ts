import { ACTIVITY_LEVELS, type ActivityLevel, type Currency, type Tables } from "@guideless/types";
import type { CancellationTier } from "@guideless/types";

/**
 * Pure filtering/parsing for the /tours listing. No server imports so it is unit-testable.
 */

export interface PublicDeparture {
  id: string;
  tourId: string;
  tourVersionId: string;
  status: Tables<"departures">["status"];
  startDate: string;
  endDate: string;
  timezone: string;
  capacity: number;
  minimumTravelers: number;
  priceAmount: number;
  depositAmount: number;
  currency: Currency;
  bookingDeadline: string | null;
  balanceDueDate: string | null;
  cancellationPolicy: CancellationTier[];
  /** Trip drop: bookable only once this moment has passed. Null means open now. */
  opensAt: string | null;
}

export interface TourListItem {
  tour: Tables<"tours">;
  version: Tables<"tour_versions">;
  destinations: Tables<"destinations">[];
  departures: PublicDeparture[];
}

export const DURATION_BUCKETS = {
  short: { label: "Up to 5 days", min: 1, max: 5 },
  medium: { label: "6 – 9 days", min: 6, max: 9 },
  long: { label: "10+ days", min: 10, max: Infinity },
} as const;
export type DurationBucket = keyof typeof DURATION_BUCKETS;

/** Max price options in minor units (USD). */
export const PRICE_CEILINGS = [250000, 350000, 500000, 750000] as const;

export interface TourFilters {
  destination?: string; // destination slug
  month?: string; // "YYYY-MM"
  duration?: DurationBucket;
  activityLevel?: ActivityLevel;
  maxPrice?: number; // minor units
}

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.length > 0 ? s : undefined;
}

export function parseTourFilters(sp: SearchParams): TourFilters {
  const filters: TourFilters = {};
  const destination = first(sp.destination);
  if (destination && /^[a-z0-9-]+$/.test(destination)) filters.destination = destination;

  const month = first(sp.month);
  if (month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) filters.month = month;

  const duration = first(sp.duration);
  if (duration && duration in DURATION_BUCKETS) filters.duration = duration as DurationBucket;

  const level = first(sp.activity);
  if (level && (ACTIVITY_LEVELS as readonly string[]).includes(level)) {
    filters.activityLevel = level as ActivityLevel;
  }

  const maxPrice = Number(first(sp.maxPrice));
  if (Number.isInteger(maxPrice) && maxPrice > 0) filters.maxPrice = maxPrice;

  return filters;
}

export function hasActiveFilters(f: TourFilters): boolean {
  return Object.values(f).some((v) => v !== undefined);
}

/** Lowest upcoming departure price, falling back to the version's marketing "from" price. */
export function tourFromPrice(item: TourListItem): { amount: number; currency: Currency } | null {
  if (item.departures.length > 0) {
    const cheapest = item.departures.reduce((a, b) => (b.priceAmount < a.priceAmount ? b : a));
    return { amount: cheapest.priceAmount, currency: cheapest.currency };
  }
  if (item.version.starting_price_amount != null && item.version.starting_price_currency) {
    return {
      amount: item.version.starting_price_amount,
      currency: item.version.starting_price_currency as Currency,
    };
  }
  return null;
}

export function filterTours(items: TourListItem[], f: TourFilters): TourListItem[] {
  return items.filter((item) => {
    if (f.destination && !item.destinations.some((d) => d.slug === f.destination)) return false;

    if (f.duration) {
      const { min, max } = DURATION_BUCKETS[f.duration];
      if (item.tour.duration_days < min || item.tour.duration_days > max) return false;
    }

    if (f.activityLevel && item.tour.activity_level !== f.activityLevel) return false;

    if (f.month && !item.departures.some((d) => d.startDate.startsWith(f.month!))) return false;

    if (f.maxPrice !== undefined) {
      const price = tourFromPrice(item);
      if (!price || price.amount > f.maxPrice) return false;
    }

    return true;
  });
}

/** Distinct "YYYY-MM" values with upcoming departures, ascending. */
export function availableMonths(items: TourListItem[]): string[] {
  const months = new Set<string>();
  for (const item of items) for (const d of item.departures) months.add(d.startDate.slice(0, 7));
  return [...months].sort();
}

/** Distinct destinations across all tours, by name. */
export function availableDestinations(items: TourListItem[]): Tables<"destinations">[] {
  const byId = new Map<string, Tables<"destinations">>();
  for (const item of items) for (const d of item.destinations) byId.set(d.id, d);
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}
