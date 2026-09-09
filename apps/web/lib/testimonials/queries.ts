import "server-only";

import { createPublicClient } from "@/lib/supabase/public";

/**
 * Reading testimonials for public pages.
 *
 * Always through `testimonials_public` and always with the anonymous client, which is what lets a
 * statically generated tour page carry them. The view has no consent flag, no source note and no
 * rating, so there is nothing here that could be rendered by mistake.
 *
 * These are deliberately not reviews. Nothing in this module produces a count or an average, and
 * no caller should invent one: the whole point of keeping the two apart is that the star rating on
 * a tour page only ever means "people who booked this trip through us".
 *
 * They appear on tour pages and nowhere else. /reviews tells a visitor outright that it will not
 * be filled with anything but real reviews while it waits for the first one, and that promise is
 * worth more than the extra placement.
 */

export interface Testimonial {
  id: string;
  quote: string;
  authorName: string;
  tripLabel: string;
  imageUrl: string | null;
}

interface TestimonialRow {
  id: string;
  quote: string;
  author_name: string;
  trip_label: string;
  image_url: string | null;
  position: number | null;
  published_at: string | null;
}

const SELECT = "id, quote, author_name, trip_label, image_url, position, published_at";

function toTestimonial(row: TestimonialRow): Testimonial {
  return {
    id: row.id,
    quote: row.quote,
    authorName: row.author_name,
    tripLabel: row.trip_label,
    imageUrl: row.image_url,
  };
}

/** Testimonials attached to one tour. Empty is empty — callers render nothing at all. */
export async function listTestimonialsForTour(tourId: string, limit = 6): Promise<Testimonial[]> {
  const sb = createPublicClient();
  const { data, error } = await sb
    .from("testimonials_public")
    .select(SELECT)
    .eq("tour_id", tourId)
    .order("position")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as TestimonialRow[]).map(toTestimonial);
}
