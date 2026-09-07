import "server-only";

import type { Tables } from "@guideless/types";
import { createClient } from "@/lib/supabase/server";

export type BookingAddOn = Tables<"booking_add_ons"> & {
  add_on: Pick<
    Tables<"departure_add_ons">,
    "id" | "title" | "kind" | "day_number" | "start_time" | "location_name"
  > | null;
  traveler: Pick<
    Tables<"traveler_profiles">,
    "id" | "first_name" | "last_name" | "preferred_name"
  > | null;
};

/** The signed-in customer's add-ons for the given bookings (RLS scopes rows to their bookings). */
export async function listMyBookingAddOns(bookingIds: string[]): Promise<BookingAddOn[]> {
  if (bookingIds.length === 0) return [];
  const sb = await createClient();
  const { data, error } = await sb
    .from("booking_add_ons")
    .select(
      "*, add_on:departure_add_ons(id, title, kind, day_number, start_time, location_name), traveler:traveler_profiles(id, first_name, last_name, preferred_name)",
    )
    .in("booking_id", bookingIds)
    .in("status", ["pending", "confirmed"])
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as unknown as BookingAddOn[];
}

export interface ReferralSummary {
  code: string | null;
  /** Earned, less redeemed, per currency. */
  balances: { currency: string; amount: number }[];
  /** Friends whose bookings were confirmed with this code. */
  earnedCount: number;
  pendingCount: number;
}

export async function getMyReferral(): Promise<ReferralSummary> {
  const sb = await createClient();
  const [{ data: code }, { data: credits }, { data: referrals }] = await Promise.all([
    sb.from("referral_codes").select("code").maybeSingle(),
    sb.from("account_credits").select("amount, currency"),
    sb.from("referrals").select("status, referred_user_id"),
  ]);
  const byCurrency = new Map<string, number>();
  for (const c of credits ?? [])
    byCurrency.set(c.currency, (byCurrency.get(c.currency) ?? 0) + c.amount);
  const {
    data: { user },
  } = await sb.auth.getUser();
  const mine = (referrals ?? []).filter((r) => r.referred_user_id !== user?.id);
  return {
    code: code?.code ?? null,
    balances: [...byCurrency.entries()]
      .filter(([, amount]) => amount !== 0)
      .map(([currency, amount]) => ({ currency, amount })),
    earnedCount: mine.filter((r) => r.status === "earned").length,
    pendingCount: mine.filter((r) => r.status === "pending").length,
  };
}
