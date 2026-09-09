import "server-only";

import type { Tables } from "@guideless/types";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Reading reviews. Everything public goes through `reviews_public` (migration 0069), a view of
 * published rows that cannot select `staff_note` or `user_id` — the table itself is no longer
 * anon-readable. A marketing page can still be statically generated and can never accidentally
 * render something a moderator has not seen, or a note a moderator wrote about it.
 *
 * There is deliberately no "0 reviews" anywhere in here: when nothing is published the queries
 * return an empty array and `null` stats, and every caller is expected to render nothing at all.
 */

export interface PublishedReview {
  id: string;
  tourId: string;
  tourName: string;
  tourSlug: string;
  rating: number;
  title: string | null;
  body: string;
  wouldRepeat: boolean | null;
  publishedAt: string;
  authorName: string;
  tripEndDate: string | null;
}

export interface ReviewStats {
  count: number;
  average: number;
}

interface ReviewRow {
  id: string;
  tour_id: string;
  rating: number;
  title: string | null;
  body: string;
  would_repeat: boolean | null;
  published_at: string | null;
  author_name: string;
  trip_end_date: string | null;
}

// `author_name` and `trip_end_date` are stored on the review rather than joined: anonymous
// visitors can read neither `profiles` nor `trips`, and a published byline should not change
// because someone later renamed themselves.
const SELECT =
  "id, tour_id, rating, title, body, would_repeat, published_at, author_name, trip_end_date";

/**
 * Tour names for a set of reviews, as a second query rather than a PostgREST embed.
 * `reviews_public` is a view, and embedding through one relies on PostgREST inferring the foreign
 * key from the view's column origins. It usually manages it; this does not have to care.
 */
async function tourNames(tourIds: string[]): Promise<Map<string, { name: string; slug: string }>> {
  const out = new Map<string, { name: string; slug: string }>();
  const ids = [...new Set(tourIds)];
  if (ids.length === 0) return out;
  const sb = createPublicClient();
  const { data } = await sb.from("tours").select("id, name, slug").in("id", ids);
  for (const t of data ?? []) out.set(t.id, { name: t.name, slug: t.slug });
  return out;
}

function toReview(
  row: ReviewRow,
  tours: Map<string, { name: string; slug: string }>,
): PublishedReview {
  return {
    id: row.id,
    tourId: row.tour_id,
    tourName: tours.get(row.tour_id)?.name ?? "",
    tourSlug: tours.get(row.tour_id)?.slug ?? "",
    rating: row.rating,
    title: row.title,
    body: row.body,
    wouldRepeat: row.would_repeat,
    publishedAt: row.published_at ?? "",
    authorName: row.author_name || "A Guideless traveler",
    tripEndDate: row.trip_end_date,
  };
}

/** Every published review, newest first. Empty until real travelers have written something. */
export async function listPublishedReviews(limit = 50): Promise<PublishedReview[]> {
  const sb = createPublicClient();
  const { data, error } = await sb
    .from("reviews_public")
    .select(SELECT)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as unknown as ReviewRow[];
  const tours = await tourNames(rows.map((r) => r.tour_id));
  return rows.map((r) => toReview(r, tours));
}

export async function listReviewsForTour(tourId: string, limit = 4): Promise<PublishedReview[]> {
  const sb = createPublicClient();
  const { data, error } = await sb
    .from("reviews_public")
    .select(SELECT)
    .eq("tour_id", tourId)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as unknown as ReviewRow[];
  const tours = await tourNames(rows.map((r) => r.tour_id));
  return rows.map((r) => toReview(r, tours));
}

/**
 * Rating summary for one tour, or null when nothing is published. The view has no row for a tour
 * without published reviews, which is what keeps "0 reviews" and a zero-star average off the page.
 */
export async function getTourReviewStats(tourId: string): Promise<ReviewStats | null> {
  const sb = createPublicClient();
  const { data, error } = await sb
    .from("tour_review_stats")
    .select("review_count, average_rating")
    .eq("tour_id", tourId)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.review_count || !data.average_rating) return null;
  return { count: data.review_count, average: Number(data.average_rating) };
}

export interface ReviewableBooking {
  bookingId: string;
  tripId: string;
  tourId: string;
  tourName: string;
  tripName: string;
  endDate: string;
}

/** Trips the signed-in traveler could review right now (finished, theirs, not yet reviewed). */
export async function listReviewableBookings(): Promise<ReviewableBooking[]> {
  const sb = await createClient();
  const { data, error } = await sb.rpc("reviewable_bookings");
  if (error) {
    // A signed-out visitor simply has nothing to review; that is not an error worth throwing.
    if (error.code === "42501") return [];
    throw error;
  }
  return (data ?? []).map((r) => ({
    bookingId: r.booking_id,
    tripId: r.trip_id,
    tourId: r.tour_id,
    tourName: r.tour_name,
    tripName: r.trip_name,
    endDate: r.end_date,
  }));
}

/** The signed-in traveler's own reviews, whatever their state, so they can see it is with us. */
export async function listMyReviews(): Promise<Array<Tables<"reviews"> & { tourName: string }>> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("reviews")
    .select("*, tours(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Array<Tables<"reviews"> & { tours: { name: string } | null }>).map(
    (r) => ({ ...r, tourName: r.tours?.name ?? "" }),
  );
}
