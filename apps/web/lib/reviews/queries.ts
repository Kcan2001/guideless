import "server-only";

import type { Tables } from "@guideless/types";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Reading reviews. Everything public goes through the anonymous client, which RLS limits to
 * published rows, so a marketing page can be statically generated and can never accidentally
 * render something a moderator has not seen.
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
  tours: { name: string; slug: string } | null;
}

// `author_name` and `trip_end_date` are stored on the review rather than joined: anonymous
// visitors can read neither `profiles` nor `trips`, and a published byline should not change
// because someone later renamed themselves.
const SELECT =
  "id, tour_id, rating, title, body, would_repeat, published_at, author_name, trip_end_date, " +
  "tours(name, slug)";

function toReview(row: ReviewRow): PublishedReview {
  return {
    id: row.id,
    tourId: row.tour_id,
    tourName: row.tours?.name ?? "",
    tourSlug: row.tours?.slug ?? "",
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
    .from("reviews")
    .select(SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as ReviewRow[]).map(toReview);
}

export async function listReviewsForTour(tourId: string, limit = 4): Promise<PublishedReview[]> {
  const sb = createPublicClient();
  const { data, error } = await sb
    .from("reviews")
    .select(SELECT)
    .eq("status", "published")
    .eq("tour_id", tourId)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as ReviewRow[]).map(toReview);
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
