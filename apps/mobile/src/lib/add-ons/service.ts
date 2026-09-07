import type { Views } from "@guideless/types";
import { addDays, type AddOnParticipant, type AddOnView } from "@/lib/add-ons/helpers";
import { supabase } from "@/lib/supabase";

export * from "@/lib/add-ons/helpers";

/** Where the web app lives; add-on purchases happen there. */
export const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://guidelesstours.com";

/**
 * Optional add-ons for the trip's departure: the catalog is public (RLS: active rows), head-counts
 * are an aggregate view, and who-from-your-group comes from a member-only RPC.
 */
export const addOnsService = {
  async listForTrip(input: {
    tripId: string;
    departureId: string;
    startDate: string;
    endDate: string;
    userId: string | null;
  }): Promise<AddOnView[]> {
    const [{ data: addOns, error }, { data: counts }, participants, mine] = await Promise.all([
      supabase
        .from("departure_add_ons")
        .select("*")
        .eq("departure_id", input.departureId)
        .eq("is_active", true)
        .order("position"),
      supabase.from("add_on_headcounts").select("*"),
      supabase
        .rpc("trip_add_on_participants", { p_trip_id: input.tripId })
        .then((r) => (r.data ?? []) as AddOnParticipant[]),
      input.userId ? addOnsService.myAddOnIds() : Promise.resolve(new Set<string>()),
    ]);
    if (error) throw error;
    const countById = new Map(
      (counts ?? []).map((c: Views<"add_on_headcounts">) => [c.add_on_id, c.going ?? 0]),
    );
    return (addOns ?? []).map((a) => {
      const date = a.day_number ? addDays(input.startDate, a.day_number - 1) : input.endDate;
      return {
        ...a,
        going: countById.get(a.id) ?? 0,
        participants: participants.filter((p) => p.add_on_id === a.id),
        mine: mine.has(a.id),
        date,
        bookableUntil: addDays(date, -a.bookable_until_days_before),
      };
    });
  },

  /** Add-ons held (pending or confirmed) on any of the signed-in customer's bookings. */
  async myAddOnIds(): Promise<Set<string>> {
    const { data } = await supabase
      .from("booking_add_ons")
      .select("add_on_id, status")
      .in("status", ["pending", "confirmed"]);
    return new Set((data ?? []).map((r) => r.add_on_id));
  },
};
