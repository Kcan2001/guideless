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

/** Tours to attach a testimonial to, for the form's picker and the share links. */
export async function listTourOptions(): Promise<
  Array<{ id: string; name: string; slug: string }>
> {
  const sb = await createClient();
  const { data, error } = await sb.from("tours").select("id, name, slug").order("name");
  if (error) throw error;
  return data ?? [];
}

export type SubmissionRow = Tables<"testimonial_submissions"> & {
  tourName: string | null;
  photos: Array<{ path: string; url: string | null }>;
};

/**
 * Submissions from /share/<tour>, newest first, with a signed URL per photo.
 *
 * The bucket is private, so a preview needs signing every time this page loads; an hour is long
 * enough to look through them and short enough that a copied URL is not a lasting handout.
 */
export async function listSubmissions(): Promise<SubmissionRow[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("testimonial_submissions")
    .select("*")
    .order("status")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  const rows = (data ?? []) as Array<Tables<"testimonial_submissions">>;
  const tourIds = rows.map((r) => r.tour_id).filter((v): v is string => Boolean(v));
  const names = new Map<string, string>();
  if (tourIds.length > 0) {
    const { data: tours } = await sb
      .from("tours")
      .select("id, name")
      .in("id", [...new Set(tourIds)]);
    for (const t of tours ?? []) names.set(t.id, t.name);
  }

  return Promise.all(
    rows.map(async (r) => {
      const paths = r.photo_paths ?? [];
      const signed =
        paths.length > 0
          ? ((await sb.storage.from("testimonial-uploads").createSignedUrls(paths, 3600)).data ??
            [])
          : [];
      return {
        ...r,
        tourName: r.tour_id ? (names.get(r.tour_id) ?? null) : null,
        photos: paths.map((path, i) => ({ path, url: signed[i]?.signedUrl ?? null })),
      };
    }),
  );
}
