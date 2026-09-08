import "server-only";

import type { Tables, Views } from "@guideless/types";
import { createPublicClient } from "@/lib/supabase/public";

export type StayOption = Tables<"departure_stay_options">;
export type AddOn = Tables<"departure_add_ons">;

export interface AddOnWithCounts extends AddOn {
  /** Units still available, or null when the add-on has no capacity limit. */
  available: number | null;
  /** Confirmed participants ("6 are on the boat"). */
  going: number;
  /** Last calendar day it can be bought (ISO date), from the departure dates and the sales window. */
  bookableUntil: string;
  /** Calendar day of the add-on (ISO date) when it has a day number, else null. */
  date: string | null;
}

export { stayDetails, type StayDetails } from "@/lib/data/extras-shared";

export interface DepartureExtras {
  stayOptions: StayOption[];
  addOns: AddOnWithCounts[];
  /** Per traveler saving when two share a room (minor units). */
  sharedRoomDiscountAmount: number;
  /** Days before departure the group (chat, roster) opens. */
  groupOpensDaysBefore: number;
}

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

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Everything a departure offers beyond the base trip: stay tiers and add-ons with live
 * availability and head-counts. Public data (RLS: active rows for anyone); cached with the page.
 */
export async function listDepartureExtras(departureId: string): Promise<DepartureExtras> {
  const sb = createPublicClient();
  const [{ data: departure }, { data: stays, error: sErr }, { data: addOns, error: aErr }] =
    await Promise.all([
      // departures_public predates these columns; the base table is readable for open departures.
      sb
        .from("departures")
        .select("start_date, end_date, shared_room_discount_amount, group_opens_days_before")
        .eq("id", departureId)
        .maybeSingle(),
      sb
        .from("departure_stay_options")
        .select("*")
        .eq("departure_id", departureId)
        .eq("is_active", true)
        .order("position"),
      sb
        .from("departure_add_ons")
        .select("*")
        .eq("departure_id", departureId)
        .eq("is_active", true)
        .order("position"),
    ]);
  if (sErr) throw sErr;
  if (aErr) throw aErr;
  const ids = (addOns ?? []).map((a) => a.id);
  const [{ data: availability }, { data: headcounts }] = ids.length
    ? await Promise.all([
        sb.from("add_on_availability").select("*").in("add_on_id", ids),
        sb.from("add_on_headcounts").select("*").in("add_on_id", ids),
      ])
    : [
        { data: [] as Views<"add_on_availability">[] },
        { data: [] as Views<"add_on_headcounts">[] },
      ];
  const availById = new Map((availability ?? []).map((a) => [a.add_on_id, a]));
  const goingById = new Map((headcounts ?? []).map((h) => [h.add_on_id, h.going ?? 0]));
  const start = departure?.start_date ?? null;
  const end = departure?.end_date ?? null;

  return {
    sharedRoomDiscountAmount: departure?.shared_room_discount_amount ?? 0,
    groupOpensDaysBefore: departure?.group_opens_days_before ?? 30,
    stayOptions: stays ?? [],
    addOns: (addOns ?? []).map((a) => {
      const av = availById.get(a.id);
      const date =
        a.day_number && start ? addDays(start, a.day_number - 1) : (end ?? start ?? "2099-12-31");
      return {
        ...a,
        available:
          a.capacity == null
            ? null
            : Math.max(a.capacity - (av?.confirmed ?? 0) - (av?.held ?? 0), 0),
        going: goingById.get(a.id) ?? 0,
        bookableUntil: addDays(date, -a.bookable_until_days_before),
        date: a.day_number && start ? date : null,
      };
    }),
  };
}

/** Anonymized roster for the departure page ("11 booked · 5 solo · from 4 countries"). */
export async function getRosterStats(departureId: string): Promise<RosterStats | null> {
  const sb = createPublicClient();
  const { data, error } = await sb.rpc("departure_roster_stats", { p_departure_id: departureId });
  if (error) throw error;
  if (!data || typeof data !== "object") return null;
  return data as unknown as RosterStats;
}
