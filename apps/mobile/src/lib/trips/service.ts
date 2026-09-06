import type { Tables } from "@guideless/types";
import { supabase } from "@/lib/supabase";

export type Trip = Tables<"trips">;
export type TripItem = Tables<"trip_itinerary_items">;
export type Destination = Tables<"destinations">;
export type Accommodation = Tables<"accommodations">;

export interface TripDay extends Tables<"trip_days"> {
  items: TripItem[];
  destination: Destination | null;
}

export interface TripMember extends Tables<"trip_members"> {
  profile: Tables<"profiles"> | null;
}

export interface TripDetail {
  trip: Trip;
  days: TripDay[];
  members: TripMember[];
  accommodations: Accommodation[];
  destinations: Destination[];
}

/**
 * Trip reads for the signed-in traveler. RLS limits everything to trips they are a member of;
 * components never query Supabase directly (spec §53).
 */
export const tripService = {
  async listMyTrips(): Promise<Trip[]> {
    const { data, error } = await supabase.from("trips").select("*").order("start_date");
    if (error) throw error;
    return data;
  },

  async getTrip(tripId: string): Promise<TripDetail | null> {
    const { data: trip, error } = await supabase
      .from("trips")
      .select("*")
      .eq("id", tripId)
      .maybeSingle();
    if (error) throw error;
    if (!trip) return null;

    const [{ data: days, error: dErr }, { data: members, error: mErr }, { data: accommodations }] =
      await Promise.all([
        supabase
          .from("trip_days")
          .select("*, trip_itinerary_items(*), destinations(*)")
          .eq("trip_id", tripId)
          .order("day_number")
          .order("position", { referencedTable: "trip_itinerary_items" }),
        supabase.from("trip_members").select("*").eq("trip_id", tripId).is("removed_at", null),
        supabase
          .from("accommodations")
          .select("*")
          .eq("departure_id", trip.departure_id)
          .order("check_in_date"),
      ]);
    if (dErr) throw dErr;
    if (mErr) throw mErr;

    const memberIds = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = memberIds.length
      ? await supabase.from("profiles").select("*").in("id", memberIds)
      : { data: [] as Tables<"profiles">[] };
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    const destById = new Map<string, Destination>();
    const mappedDays: TripDay[] = (days ?? []).map(
      ({ trip_itinerary_items, destinations, ...day }) => {
        if (destinations) destById.set(destinations.id, destinations);
        return { ...day, items: trip_itinerary_items, destination: destinations };
      },
    );

    return {
      trip,
      days: mappedDays,
      members: (members ?? []).map((m) => ({ ...m, profile: profileById.get(m.user_id) ?? null })),
      accommodations: accommodations ?? [],
      destinations: [...destById.values()],
    };
  },

  async getItem(itemId: string): Promise<(TripItem & { day: Tables<"trip_days"> | null }) | null> {
    const { data, error } = await supabase
      .from("trip_itinerary_items")
      .select("*, trip_days(*)")
      .eq("id", itemId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const { trip_days, ...item } = data;
    return { ...item, day: trip_days };
  },
};
