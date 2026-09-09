import type { Tables } from "@guideless/types";
import { supabase } from "@/lib/supabase";

/**
 * A traveler's own plans, read and written straight through Supabase — unlike the assistant, this
 * needs no server of ours, because row-level security is the entire rule: they are the only person
 * who can see or change them.
 */

export type TravelerPlan = Tables<"traveler_plans">;

export const planService = {
  async forTrip(tripId: string): Promise<TravelerPlan[]> {
    const { data, error } = await supabase
      .from("traveler_plans")
      .select("*")
      .eq("trip_id", tripId)
      .order("plan_date", { nullsFirst: false })
      .order("start_time", { nullsFirst: false });
    if (error) throw error;
    return data;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("traveler_plans").delete().eq("id", id);
    if (error) throw new Error("Could not remove that. Try again.");
  },
};

/** The ones that belong to a given day, for merging into the Today screen. */
export function plansForDate(plans: TravelerPlan[], date: string): TravelerPlan[] {
  return plans
    .filter((p) => p.plan_date === date)
    .sort((a, b) => (a.start_time ?? "99").localeCompare(b.start_time ?? "99"));
}
