import "server-only";

import type { ActivityLevel, Currency, Tables, Views } from "@guideless/types";
import { createPublicClient } from "@/lib/supabase/public";
import {
  filterTours,
  type PublicDeparture,
  type TourFilters,
  type TourListItem,
} from "@/lib/data/tour-filters";

export type { PublicDeparture, TourFilters, TourListItem } from "@/lib/data/tour-filters";
export { filterTours, parseTourFilters, tourFromPrice } from "@/lib/data/tour-filters";

export type Tour = Tables<"tours">;
export type TourVersion = Tables<"tour_versions">;
export type Destination = Tables<"destinations">;
export type TourDay = Tables<"tour_days">;
export type TourItineraryItem = Tables<"tour_itinerary_items">;
export type TourFaq = Tables<"tour_faqs">;
export type TourIncludedItem = Tables<"tour_included_items">;
export type TourExcludedItem = Tables<"tour_excluded_items">;
export type TourRequirement = Tables<"tour_requirements">;

export interface RouteStop {
  destination: Destination;
  position: number;
  nights: number;
}

export interface Availability {
  capacity: number;
  confirmed: number;
  held: number;
  available: number;
}

export interface DepartureWithAvailability extends PublicDeparture {
  availability: Availability;
}

export interface TourDetail {
  tour: Tour;
  version: TourVersion;
  route: RouteStop[];
  days: Array<TourDay & { items: TourItineraryItem[]; destination: Destination | null }>;
  included: TourIncludedItem[];
  excluded: TourExcludedItem[];
  /** Conditions of joining: passport, minimum age, insurance. */
  requirements: TourRequirement[];
  faqs: TourFaq[];
  departures: DepartureWithAvailability[];
}

export interface DepartureDetail {
  departure: DepartureWithAvailability;
  tour: Tour;
  version: TourVersion;
  route: RouteStop[];
  included: TourIncludedItem[];
  excluded: TourExcludedItem[];
}

const BOOKABLE_STATUSES = ["open", "guaranteed"] as const;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Views come back with every column nullable; assert the columns the view always populates. */
export function normalizeDeparture(row: Views<"departures_public">): PublicDeparture {
  const required = <T>(v: T | null, name: string): T => {
    if (v === null || v === undefined) throw new Error(`departures_public.${name} was null`);
    return v;
  };
  return {
    id: required(row.id, "id"),
    tourId: required(row.tour_id, "tour_id"),
    tourVersionId: required(row.tour_version_id, "tour_version_id"),
    status: required(row.status, "status"),
    startDate: required(row.start_date, "start_date"),
    endDate: required(row.end_date, "end_date"),
    timezone: required(row.timezone, "timezone"),
    capacity: required(row.capacity, "capacity"),
    minimumTravelers: required(row.minimum_travelers, "minimum_travelers"),
    priceAmount: required(row.price_amount, "price_amount"),
    depositAmount: required(row.deposit_amount, "deposit_amount"),
    currency: required(row.currency, "currency") as Currency,
    bookingDeadline: row.booking_deadline,
    balanceDueDate: row.balance_due_date,
    // jsonb column; shape is enforced by cancellationPolicySchema when staff edit departures.
    cancellationPolicy: (row.cancellation_policy ??
      []) as unknown as PublicDeparture["cancellationPolicy"],
    opensAt: row.opens_at,
  };
}

async function loadRoutes(versionIds: string[]): Promise<Map<string, RouteStop[]>> {
  const sb = createPublicClient();
  const { data, error } = await sb
    .from("tour_version_destinations")
    .select("tour_version_id, position, nights, destinations(*)")
    .in("tour_version_id", versionIds)
    .order("position");
  if (error) throw error;

  const byVersion = new Map<string, RouteStop[]>();
  for (const row of data) {
    if (!row.destinations) continue;
    const list = byVersion.get(row.tour_version_id) ?? [];
    list.push({ destination: row.destinations, position: row.position, nights: row.nights });
    byVersion.set(row.tour_version_id, list);
  }
  return byVersion;
}

async function loadUpcomingDepartures(tourIds: string[]): Promise<PublicDeparture[]> {
  const sb = createPublicClient();
  const { data, error } = await sb
    .from("departures_public")
    .select("*")
    .in("tour_id", tourIds)
    .in("status", [...BOOKABLE_STATUSES])
    .gte("start_date", today())
    .order("start_date");
  if (error) throw error;
  return data.map(normalizeDeparture);
}

export async function getAvailability(departureId: string): Promise<Availability> {
  const sb = createPublicClient();
  const { data, error } = await sb.rpc("get_departure_availability", {
    p_departure_id: departureId,
  });
  if (error) throw error;
  const row = data[0];
  if (!row) return { capacity: 0, confirmed: 0, held: 0, available: 0 };
  return {
    capacity: row.capacity,
    confirmed: row.confirmed,
    held: row.held,
    available: row.available,
  };
}

async function withAvailability(
  departures: PublicDeparture[],
): Promise<DepartureWithAvailability[]> {
  return Promise.all(
    departures.map(async (d) => ({ ...d, availability: await getAvailability(d.id) })),
  );
}

/** All published tours with their current published version, route and upcoming departures. */
export async function listPublishedTours(filters?: TourFilters): Promise<TourListItem[]> {
  const sb = createPublicClient();
  const { data: tours, error } = await sb
    .from("tours")
    .select("*")
    .eq("is_published", true)
    .not("current_version_id", "is", null)
    .order("name");
  if (error) throw error;
  if (tours.length === 0) return [];

  const versionIds = tours.map((t) => t.current_version_id).filter((id): id is string => !!id);
  const [{ data: versions, error: vErr }, routes, departures] = await Promise.all([
    sb.from("tour_versions").select("*").in("id", versionIds).eq("status", "published"),
    loadRoutes(versionIds),
    loadUpcomingDepartures(tours.map((t) => t.id)),
  ]);
  if (vErr) throw vErr;

  const versionById = new Map(versions.map((v) => [v.id, v]));
  const items: TourListItem[] = [];
  for (const tour of tours) {
    const version = tour.current_version_id ? versionById.get(tour.current_version_id) : undefined;
    if (!version) continue;
    items.push({
      tour,
      version,
      destinations: (routes.get(version.id) ?? []).map((r) => r.destination),
      departures: departures.filter((d) => d.tourId === tour.id),
    });
  }
  return filters ? filterTours(items, filters) : items;
}

export async function getTourBySlug(slug: string): Promise<TourDetail | null> {
  const sb = createPublicClient();
  const { data: tour, error } = await sb
    .from("tours")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw error;
  if (!tour?.current_version_id) return null;
  const versionId = tour.current_version_id;

  const [
    { data: version, error: vErr },
    routes,
    { data: days, error: dErr },
    { data: included, error: iErr },
    { data: excluded, error: eErr },
    { data: faqs, error: fErr },
    { data: requirements, error: rErr },
    departures,
  ] = await Promise.all([
    sb
      .from("tour_versions")
      .select("*")
      .eq("id", versionId)
      .eq("status", "published")
      .maybeSingle(),
    loadRoutes([versionId]),
    sb
      .from("tour_days")
      .select("*, tour_itinerary_items(*), destinations(*)")
      .eq("tour_version_id", versionId)
      .order("day_number")
      .order("position", { referencedTable: "tour_itinerary_items" }),
    sb.from("tour_included_items").select("*").eq("tour_version_id", versionId).order("position"),
    sb.from("tour_excluded_items").select("*").eq("tour_version_id", versionId).order("position"),
    sb.from("tour_faqs").select("*").eq("tour_version_id", versionId).order("position"),
    sb.from("tour_requirements").select("*").eq("tour_version_id", versionId).order("position"),
    loadUpcomingDepartures([tour.id]),
  ]);
  if (vErr) throw vErr;
  if (dErr) throw dErr;
  if (iErr) throw iErr;
  if (eErr) throw eErr;
  if (fErr) throw fErr;
  if (rErr) throw rErr;
  if (!version) return null;

  return {
    tour,
    version,
    route: routes.get(versionId) ?? [],
    days: days.map(({ tour_itinerary_items, destinations, ...day }) => ({
      ...day,
      items: tour_itinerary_items,
      destination: destinations,
    })),
    included,
    excluded,
    requirements,
    faqs,
    departures: await withAvailability(departures),
  };
}

export async function getDepartureById(id: string): Promise<DepartureDetail | null> {
  const sb = createPublicClient();
  const { data: row, error } = await sb
    .from("departures_public")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;
  const departure = normalizeDeparture(row);

  const [{ data: tour, error: tErr }, { data: version, error: vErr }, routes, availability] =
    await Promise.all([
      sb.from("tours").select("*").eq("id", departure.tourId).maybeSingle(),
      sb.from("tour_versions").select("*").eq("id", departure.tourVersionId).maybeSingle(),
      loadRoutes([departure.tourVersionId]),
      getAvailability(departure.id),
    ]);
  if (tErr) throw tErr;
  if (vErr) throw vErr;
  if (!tour || !version) return null;

  const [{ data: included, error: iErr }, { data: excluded, error: eErr }] = await Promise.all([
    sb.from("tour_included_items").select("*").eq("tour_version_id", version.id).order("position"),
    sb.from("tour_excluded_items").select("*").eq("tour_version_id", version.id).order("position"),
  ]);
  if (iErr) throw iErr;
  if (eErr) throw eErr;

  return {
    departure: { ...departure, availability },
    tour,
    version,
    route: routes.get(version.id) ?? [],
    included,
    excluded,
  };
}

/** Slugs for generateStaticParams / sitemap. */
export async function listTourSlugs(): Promise<string[]> {
  const sb = createPublicClient();
  const { data, error } = await sb
    .from("tours")
    .select("slug")
    .eq("is_published", true)
    .not("current_version_id", "is", null);
  if (error) throw error;
  return data.map((t) => t.slug);
}

export async function listUpcomingDepartureRefs(): Promise<
  Array<{ id: string; tourSlug: string }>
> {
  const sb = createPublicClient();
  const { data, error } = await sb
    .from("departures_public")
    .select("id, tour_id")
    .in("status", [...BOOKABLE_STATUSES])
    .gte("start_date", today());
  if (error) throw error;
  const tourIds = [...new Set(data.map((d) => d.tour_id).filter((x): x is string => !!x))];
  if (tourIds.length === 0) return [];
  const { data: tours, error: tErr } = await sb.from("tours").select("id, slug").in("id", tourIds);
  if (tErr) throw tErr;
  const slugById = new Map(tours.map((t) => [t.id, t.slug]));
  return data.flatMap((d) => {
    const slug = d.tour_id ? slugById.get(d.tour_id) : undefined;
    return d.id && slug ? [{ id: d.id, tourSlug: slug }] : [];
  });
}

export type { ActivityLevel };
