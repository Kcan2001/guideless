import type { Tables } from "@guideless/types";
import { supabase } from "@/lib/supabase";

export type Recommendation = Tables<"recommendations">;

/** Curated recommendations for a destination (spec §21). Manual in v1; no AI. */
export const exploreService = {
  async listForDestination(destinationId: string): Promise<Recommendation[]> {
    const { data, error } = await supabase
      .from("recommendations")
      .select("*")
      .eq("destination_id", destinationId)
      .eq("is_published", true)
      .order("position");
    if (error) throw error;
    return data;
  },
};
