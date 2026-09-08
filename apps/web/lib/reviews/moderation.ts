import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * The moderation queue. Runs as the signed-in staff user, so RLS is doing the work: a moderator
 * sees everything, anyone else sees only their own rows and would get an empty screen.
 */

export interface ModerationReview {
  id: string;
  status: "pending" | "published" | "rejected";
  rating: number;
  title: string | null;
  body: string;
  wouldRepeat: boolean | null;
  createdAt: string;
  publishedAt: string | null;
  staffNote: string | null;
  authorName: string;
  tourName: string;
  tripName: string;
  tripEndDate: string | null;
}

export interface ModerationPhoto {
  id: string;
  status: "pending" | "published" | "rejected";
  storagePath: string;
  caption: string | null;
  createdAt: string;
  staffNote: string | null;
  authorName: string;
  tourName: string;
  tripName: string;
  signedUrl: string | null;
}

interface ReviewRow {
  id: string;
  status: "pending" | "published" | "rejected";
  rating: number;
  title: string | null;
  body: string;
  would_repeat: boolean | null;
  created_at: string;
  published_at: string | null;
  staff_note: string | null;
  author_name: string;
  tours: { name: string } | null;
  trips: { name: string; end_date: string } | null;
}

interface PhotoRow {
  id: string;
  status: "pending" | "published" | "rejected";
  storage_path: string;
  caption: string | null;
  created_at: string;
  staff_note: string | null;
  author_name: string;
  tours: { name: string } | null;
  trips: { name: string } | null;
}

const name = (v: string | null | undefined) => (v ?? "").trim() || "Unnamed traveler";

export async function listReviewsForModeration(): Promise<ModerationReview[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("reviews")
    .select(
      "id, status, rating, title, body, would_repeat, created_at, published_at, staff_note, " +
        "author_name, tours(name), trips(name, end_date)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return ((data ?? []) as unknown as ReviewRow[]).map((r) => ({
    id: r.id,
    status: r.status,
    rating: r.rating,
    title: r.title,
    body: r.body,
    wouldRepeat: r.would_repeat,
    createdAt: r.created_at,
    publishedAt: r.published_at,
    staffNote: r.staff_note,
    authorName: name(r.author_name),
    tourName: r.tours?.name ?? "",
    tripName: r.trips?.name ?? "",
    tripEndDate: r.trips?.end_date ?? null,
  }));
}

/**
 * Photos live in a private bucket, so the queue needs short-lived signed URLs to show them.
 * One failed signature must not blank the whole screen, hence the per-row null.
 */
export async function listPhotosForModeration(): Promise<ModerationPhoto[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("trip_photos")
    .select(
      "id, status, storage_path, caption, created_at, staff_note, " +
        "author_name, tours(name), trips(name)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  const rows = (data ?? []) as unknown as PhotoRow[];
  const signed = await Promise.all(
    rows.map(async (p) => {
      const { data: url } = await sb.storage
        .from("trip-media")
        .createSignedUrl(p.storage_path, 60 * 10);
      return url?.signedUrl ?? null;
    }),
  );

  return rows.map((p, i) => ({
    id: p.id,
    status: p.status,
    storagePath: p.storage_path,
    caption: p.caption,
    createdAt: p.created_at,
    staffNote: p.staff_note,
    authorName: name(p.author_name),
    tourName: p.tours?.name ?? "",
    tripName: p.trips?.name ?? "",
    signedUrl: signed[i] ?? null,
  }));
}
