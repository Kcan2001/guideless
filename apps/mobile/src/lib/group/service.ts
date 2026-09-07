import type { Tables, Views } from "@guideless/types";
import { supabase } from "@/lib/supabase";

export interface RosterStats {
  booked: number;
  solo: number;
  pairs: number;
  groups: number;
  countries: number;
  ageMin: number | null;
  ageMax: number | null;
  capacity: number;
  spotsLeft: number;
  groupOpensOn: string;
  groupOpen: boolean;
}

export interface UpcomingBooking {
  bookingId: string;
  departureId: string;
  tourName: string;
  startDate: string;
  endDate: string;
  stats: RosterStats | null;
}

export type ItemRsvpStatus = "going" | "maybe" | "not_going";

/** "11 booked · 5 solo · 4 countries" — pure. */
export function rosterLine(s: RosterStats): string {
  const parts = [`${s.booked} booked`];
  if (s.solo > 0) parts.push(`${s.solo} solo`);
  if (s.pairs > 0) parts.push(`${s.pairs} pair${s.pairs === 1 ? "" : "s"}`);
  if (s.countries > 1) parts.push(`${s.countries} countries`);
  if (s.ageMin != null && s.ageMax != null) parts.push(`ages ${s.ageMin}–${s.ageMax}`);
  return parts.join(" · ");
}

/**
 * The group before the trip exists (roadmap M11): the signed-in customer's next confirmed
 * booking, the anonymized roster of that departure, and RSVPs on itinerary items once it does.
 */
export const groupService = {
  async upcomingBooking(): Promise<UpcomingBooking | null> {
    const today = new Date().toISOString().slice(0, 10);
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("id, departure_id")
      .eq("status", "confirmed")
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (!bookings?.length) return null;
    const { data: departures } = await supabase
      .from("departures_public")
      .select("id, start_date, end_date, tour_id")
      .in(
        "id",
        bookings.map((b) => b.departure_id),
      )
      .gte("start_date", today)
      .order("start_date");
    const dep = departures?.[0];
    if (!dep?.id || !dep.start_date || !dep.end_date) return null;
    const booking = bookings.find((b) => b.departure_id === dep.id)!;
    const [{ data: tour }, { data: stats }] = await Promise.all([
      dep.tour_id
        ? supabase.from("tours").select("name").eq("id", dep.tour_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.rpc("departure_roster_stats", { p_departure_id: dep.id }),
    ]);
    return {
      bookingId: booking.id,
      departureId: dep.id,
      tourName: tour?.name ?? "Your trip",
      startDate: dep.start_date,
      endDate: dep.end_date,
      stats: (stats as unknown as RosterStats | null) ?? null,
    };
  },

  async rosterStats(departureId: string): Promise<RosterStats | null> {
    const { data, error } = await supabase.rpc("departure_roster_stats", {
      p_departure_id: departureId,
    });
    if (error) throw error;
    return (data as unknown as RosterStats | null) ?? null;
  },

  async myBookingIdForTrip(tripId: string, userId: string): Promise<string | null> {
    const { data } = await supabase
      .from("trip_members")
      .select("booking_id")
      .eq("trip_id", tripId)
      .eq("user_id", userId)
      .maybeSingle();
    return data?.booking_id ?? null;
  },

  async rsvpCounts(itemIds: string[]): Promise<Map<string, Views<"item_rsvp_counts">>> {
    if (itemIds.length === 0) return new Map();
    const { data } = await supabase.from("item_rsvp_counts").select("*").in("item_id", itemIds);
    return new Map((data ?? []).map((r) => [r.item_id as string, r]));
  },

  async myRsvps(itemIds: string[], userId: string): Promise<Map<string, ItemRsvpStatus>> {
    if (itemIds.length === 0) return new Map();
    const { data } = await supabase
      .from("item_rsvps")
      .select("item_id, status")
      .in("item_id", itemIds)
      .eq("user_id", userId);
    return new Map((data ?? []).map((r) => [r.item_id, r.status as ItemRsvpStatus]));
  },

  async rsvp(itemId: string, userId: string, status: ItemRsvpStatus): Promise<void> {
    const { error } = await supabase
      .from("item_rsvps")
      .upsert({ item_id: itemId, user_id: userId, status }, { onConflict: "item_id,user_id" });
    if (error) throw error;
  },
};

export type Profile = Tables<"profiles">;
