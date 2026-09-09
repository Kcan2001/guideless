import "server-only";

import type { RecommendationCategory, Tables } from "@guideless/types";
import { getMyBooking } from "@/lib/data/bookings";
import { getMyTrip } from "@/lib/data/trips";
import { localClock } from "@/lib/assistant/schedule";
import { createClient } from "@/lib/supabase/server";

export { localClock } from "@/lib/assistant/schedule";

/**
 * Everything the assistant is allowed to know about one traveler's trip.
 *
 * Assembled as the signed-in traveler, so row-level security decides what goes in. That is not an
 * implementation detail — it is the security model. The assistant runs on a context built by RLS,
 * which means there is no prompt a traveler could write that would make it describe somebody
 * else's booking, because the words for it were never in the context.
 *
 * Two other rules hold here. Nothing staff-only ever enters: no supplier cost, no internal note,
 * no other traveler's details beyond first names already visible to the group. And everything is
 * dated and zoned — the model is told the local date and time in the place the traveler is, so
 * "tonight" means tonight there.
 */

export interface AssistantPlace {
  id: string;
  title: string;
  description: string | null;
  categories: RecommendationCategory[];
  neighborhood: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  priceLevel: number | null;
  timeOfDay: string[];
}

export interface AssistantDay {
  date: string;
  dayNumber: number;
  destination: string | null;
  timezone: string;
  items: Array<{
    title: string;
    startTime: string | null;
    endTime: string | null;
    type: string;
    optional: boolean;
    locationName: string | null;
  }>;
}

export interface AssistantContext {
  bookingId: string;
  tripId: string | null;
  tourName: string;
  tripName: string;
  startDate: string;
  endDate: string;
  /** before | during | after — the assistant answers very different questions in each. */
  phase: "before" | "during" | "after";
  /** Local date and time where the traveler is, from the day's zone, not the server's. */
  localDate: string;
  localTime: string;
  timezone: string;
  today: AssistantDay | null;
  tomorrow: AssistantDay | null;
  hotel: {
    name: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  /** Where "near me" means, until the app sends a real position. */
  anchor: { latitude: number; longitude: number } | null;
  recommendations: AssistantPlace[];
  taste: Array<{ category: RecommendationCategory; weight: number }>;
  pace: string | null;
  myPlans: Array<{ id: string; title: string; planDate: string | null; startTime: string | null }>;
  freeActivities: Array<{ title: string; date: string; startTime: string | null }>;
  messagesLeftToday: number;
}

function phaseOf(start: string, end: string, today: string): "before" | "during" | "after" {
  if (today < start) return "before";
  if (today > end) return "after";
  return "during";
}

/**
 * Build the context, or null when this booking is not the traveler's — which RLS decides, not us.
 */
export async function buildAssistantContext(
  bookingId: string,
  at = new Date(),
): Promise<AssistantContext | null> {
  const booking = await getMyBooking(bookingId);
  if (!booking) return null;

  const sb = await createClient();
  const { departure, tour } = booking;

  // The trip exists only once the departure is activated; before that the departure's own dates
  // and zone are all there is, which is correct for the "before" phase.
  const { data: membership } = await sb
    .from("trip_members")
    .select("trip_id, trips(id, departure_id)")
    .eq("booking_id", bookingId)
    .is("removed_at", null)
    .maybeSingle();
  const tripId = (membership?.trip_id as string | undefined) ?? null;
  const detail = tripId ? await getMyTrip(tripId) : null;

  const startDate = detail?.trip.start_date ?? departure.start_date ?? "";
  const endDate = detail?.trip.end_date ?? departure.end_date ?? "";
  const baseZone = detail?.trip.timezone ?? departure.timezone ?? "UTC";

  const provisional = localClock(baseZone, at);
  const today = detail?.days.find((d) => d.date === provisional.date) ?? null;
  // A multi-country trip changes zone mid-week; the day's own zone beats the trip's.
  const timezone = today?.timezone ?? baseZone;
  const clock = localClock(timezone, at);
  const tomorrowDate = new Date(`${clock.date}T00:00:00Z`);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrow =
    detail?.days.find((d) => d.date === tomorrowDate.toISOString().slice(0, 10)) ?? null;

  const hotel =
    detail?.accommodations.find(
      (a) => a.check_in_date <= clock.date && a.check_out_date > clock.date,
    ) ??
    detail?.accommodations[0] ??
    null;

  const destinationIds = [
    ...new Set(
      (detail?.days ?? []).map((d) => d.destination?.id).filter((v): v is string => Boolean(v)),
    ),
  ];

  const [{ data: recs }, { data: taste }, { data: pace }, { data: plans }, { data: left }] =
    await Promise.all([
      destinationIds.length
        ? sb
            .from("recommendations")
            .select(
              "id, title, description, categories, neighborhood, address, latitude, longitude, price_level, time_of_day",
            )
            .in("destination_id", destinationIds)
            .eq("is_published", true)
            .order("position")
            .limit(60)
        : Promise.resolve({ data: [] as never[] }),
      sb.rpc("traveler_taste"),
      sb.rpc("traveler_pace", { p_booking_id: bookingId }),
      sb
        .from("traveler_plans")
        .select("id, title, plan_date, start_time")
        .order("plan_date", { nullsFirst: false })
        .limit(50),
      sb.rpc("ai_messages_left"),
    ]);

  return {
    bookingId,
    tripId,
    tourName: tour.name,
    tripName: detail?.trip.name ?? tour.name,
    startDate,
    endDate,
    phase: phaseOf(startDate, endDate, clock.date),
    localDate: clock.date,
    localTime: clock.time,
    timezone,
    today: today ? toDay(today) : null,
    tomorrow: tomorrow ? toDay(tomorrow) : null,
    hotel: hotel
      ? {
          name: hotel.name,
          address: hotel.address,
          latitude: hotel.latitude,
          longitude: hotel.longitude,
        }
      : null,
    anchor: anchorFor(hotel, today),
    recommendations: (recs ?? []).map(toPlace),
    taste: (taste ?? []) as Array<{ category: RecommendationCategory; weight: number }>,
    pace: (pace as string | null) ?? null,
    myPlans: (plans ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      planDate: p.plan_date,
      startTime: p.start_time,
    })),
    freeActivities: freeActivitiesFrom(detail?.days ?? []),
    messagesLeftToday: typeof left === "number" ? left : 0,
  };
}

type DayRow = NonNullable<Awaited<ReturnType<typeof getMyTrip>>>["days"][number];

function toDay(day: DayRow): AssistantDay {
  return {
    date: day.date,
    dayNumber: day.day_number,
    destination: day.destination?.name ?? null,
    timezone: day.timezone,
    items: day.items
      .slice()
      .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""))
      .map((i) => ({
        title: i.title,
        startTime: i.start_time,
        endTime: i.end_time,
        type: i.type,
        optional: i.is_optional,
        locationName: i.location_name,
      })),
  };
}

function toPlace(r: {
  id: string;
  title: string;
  description: string | null;
  categories: RecommendationCategory[];
  neighborhood: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  price_level: number | null;
  time_of_day: string[];
}): AssistantPlace {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    categories: r.categories,
    neighborhood: r.neighborhood,
    address: r.address,
    latitude: r.latitude,
    longitude: r.longitude,
    priceLevel: r.price_level,
    timeOfDay: r.time_of_day,
  };
}

/**
 * Where "near me" means when nobody has sent a position: the hotel, else the first located thing
 * on today's schedule. Guessing the city centre would put suggestions a bus ride away.
 */
function anchorFor(
  hotel: Tables<"accommodations"> | null | undefined,
  day: DayRow | null,
): { latitude: number; longitude: number } | null {
  if (hotel?.latitude != null && hotel.longitude != null) {
    return { latitude: hotel.latitude, longitude: hotel.longitude };
  }
  const located = day?.items.find((i) => i.latitude != null && i.longitude != null);
  if (located?.latitude != null && located.longitude != null) {
    return { latitude: located.latitude, longitude: located.longitude };
  }
  return null;
}

/** The free things everyone does — the assistant should push these before anything paid. */
function freeActivitiesFrom(
  days: DayRow[],
): Array<{ title: string; date: string; startTime: string | null }> {
  return days.flatMap((d) =>
    d.items
      .filter((i) => i.is_optional && i.responsibility === "guideless" && i.type !== "free_time")
      .map((i) => ({ title: i.title, date: d.date, startTime: i.start_time })),
  );
}
