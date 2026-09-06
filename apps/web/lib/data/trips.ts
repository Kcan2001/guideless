import "server-only";

import type { Tables, Views } from "@guideless/types";
import { createClient } from "@/lib/supabase/server";

/**
 * Trip reads for the signed-in traveler on the web (spec §59: never locked out without a phone).
 * Same RLS as the mobile app: only trips the user is a member of.
 */

export type Trip = Tables<"trips">;
export type TripItem = Tables<"trip_itinerary_items">;
export interface TripDay extends Tables<"trip_days"> {
  items: TripItem[];
  destination: Tables<"destinations"> | null;
}
export interface LiveMoment extends Tables<"live_moments"> {
  joined: number;
}
export interface TripDetail {
  trip: Trip;
  days: TripDay[];
  members: Array<Tables<"trip_members"> & { profile: Tables<"profiles"> | null }>;
  accommodations: Tables<"accommodations">[];
  moments: LiveMoment[];
  rooms: Tables<"chat_rooms">[];
}

export async function listMyTrips(): Promise<Trip[]> {
  const sb = await createClient();
  const { data, error } = await sb.from("trips").select("*").order("start_date");
  if (error) throw error;
  return data;
}

export async function getMyTrip(tripId: string): Promise<TripDetail | null> {
  const sb = await createClient();
  const { data: trip, error } = await sb.from("trips").select("*").eq("id", tripId).maybeSingle();
  if (error) throw error;
  if (!trip) return null;

  const [
    { data: days, error: dErr },
    { data: members },
    { data: accommodations },
    { data: moments },
    { data: counts },
    { data: rooms },
  ] = await Promise.all([
    sb
      .from("trip_days")
      .select("*, trip_itinerary_items(*), destinations(*)")
      .eq("trip_id", tripId)
      .order("day_number")
      .order("position", { referencedTable: "trip_itinerary_items" }),
    sb.from("trip_members").select("*").eq("trip_id", tripId).is("removed_at", null),
    sb
      .from("accommodations")
      .select("*")
      .eq("departure_id", trip.departure_id)
      .order("check_in_date"),
    sb
      .from("live_moments")
      .select("*")
      .eq("trip_id", tripId)
      .in("status", ["scheduled", "live"])
      .gte("start_at", new Date(Date.now() - 6 * 3600_000).toISOString())
      .order("start_at"),
    sb.from("live_moment_counts").select("*"),
    sb.from("chat_rooms").select("*").eq("trip_id", tripId).eq("is_archived", false),
  ]);
  if (dErr) throw dErr;

  const memberIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = memberIds.length
    ? await sb.from("profiles").select("*").in("id", memberIds)
    : { data: [] as Tables<"profiles">[] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const countById = new Map(
    (counts ?? []).map((c: Views<"live_moment_counts">) => [c.moment_id, c.joined ?? 0]),
  );

  return {
    trip,
    days: (days ?? []).map(({ trip_itinerary_items, destinations, ...day }) => ({
      ...day,
      items: trip_itinerary_items,
      destination: destinations,
    })),
    members: (members ?? []).map((m) => ({ ...m, profile: profileById.get(m.user_id) ?? null })),
    accommodations: accommodations ?? [],
    moments: (moments ?? []).map((m) => ({ ...m, joined: countById.get(m.id) ?? 0 })),
    rooms: rooms ?? [],
  };
}
