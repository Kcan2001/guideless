import "server-only";

import type { Tables } from "@guideless/types";
import { createClient } from "@/lib/supabase/server";

/**
 * Staff reads of the testimonials table itself — the full row, including the two columns the
 * public projection deliberately drops: whether the person agreed to be quoted, and where the
 * quote came from. RLS limits this to staff; the anonymous side reads `testimonials_public`.
 */

export type TestimonialRow = Tables<"testimonials"> & { tourName: string | null };

export async function listAllTestimonials(): Promise<TestimonialRow[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("testimonials")
    .select("*")
    .order("status")
    .order("position")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as Array<Tables<"testimonials">>;
  const tourIds = rows.map((r) => r.tour_id).filter((v): v is string => Boolean(v));
  const names = new Map<string, string>();
  if (tourIds.length > 0) {
    const { data: tours } = await sb
      .from("tours")
      .select("id, name")
      .in("id", [...new Set(tourIds)]);
    for (const t of tours ?? []) names.set(t.id, t.name);
  }
  return rows.map((r) => ({ ...r, tourName: r.tour_id ? (names.get(r.tour_id) ?? null) : null }));
}

/** Tours to attach a testimonial to, for the form's picker. */
export async function listTourOptions(): Promise<Array<{ id: string; name: string }>> {
  const sb = await createClient();
  const { data, error } = await sb.from("tours").select("id, name").order("name");
  if (error) throw error;
  return data ?? [];
}
