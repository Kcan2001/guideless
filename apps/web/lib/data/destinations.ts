import "server-only";

import type { Tables } from "@guideless/types";
import { createPublicClient } from "@/lib/supabase/public";
import { listPublishedTours, type TourListItem } from "@/lib/data/tours";

export type Destination = Tables<"destinations">;
export type Recommendation = Tables<"recommendations">;

export interface DestinationDetail {
  destination: Destination;
  tours: TourListItem[];
  recommendations: Recommendation[];
}

export async function listPublishedDestinations(): Promise<Destination[]> {
  const sb = createPublicClient();
  const { data, error } = await sb
    .from("destinations")
    .select("*")
    .eq("is_published", true)
    .order("name");
  if (error) throw error;
  return data;
}

export async function getDestinationBySlug(slug: string): Promise<DestinationDetail | null> {
  const sb = createPublicClient();
  const { data: destination, error } = await sb
    .from("destinations")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw error;
  if (!destination) return null;

  const [{ data: recommendations, error: rErr }, tours] = await Promise.all([
    sb
      .from("recommendations")
      .select("*")
      .eq("destination_id", destination.id)
      .eq("is_published", true)
      .order("position"),
    listPublishedTours({ destination: slug }),
  ]);
  if (rErr) throw rErr;

  return { destination, tours, recommendations };
}

export async function listDestinationSlugs(): Promise<string[]> {
  const sb = createPublicClient();
  const { data, error } = await sb.from("destinations").select("slug").eq("is_published", true);
  if (error) throw error;
  return data.map((d) => d.slug);
}
