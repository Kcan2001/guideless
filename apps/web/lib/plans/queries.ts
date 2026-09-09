import "server-only";

import type { Tables } from "@guideless/types";
import { createClient } from "@/lib/supabase/server";

/**
 * A traveler's own plans. Read as them, so row-level security is the only filter that matters —
 * there is no staff path into this table at all, by design.
 */

export type TravelerPlan = Tables<"traveler_plans">;

export async function listMyPlans(
  opts: { tripId?: string; bookingId?: string } = {},
): Promise<TravelerPlan[]> {
  const sb = await createClient();
  let query = sb
    .from("traveler_plans")
    .select("*")
    .order("plan_date", { nullsFirst: false })
    .order("start_time", { nullsFirst: false });
  if (opts.tripId) query = query.eq("trip_id", opts.tripId);
  if (opts.bookingId) query = query.eq("booking_id", opts.bookingId);

  const { data, error } = await query;
  if (error) {
    // A signed-out visitor has no plans; that is not an error worth throwing at a page.
    if (error.code === "42501") return [];
    throw error;
  }
  return data;
}
