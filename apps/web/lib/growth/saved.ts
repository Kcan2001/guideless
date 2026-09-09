import "server-only";

import type { Tables } from "@guideless/types";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Saved tours and "tell me when you go there" — the two halves of having something to come back to.
 *
 * Saving is private and needs an account. Alerting takes an email and does not, because the person
 * most worth reaching has usually not signed up: somebody who read a tour page, liked the idea, and
 * left. The departure waitlist already works that way and this follows it.
 */

export interface SavedTour {
  tourId: string;
  slug: string;
  name: string;
  summary: string | null;
  heroImageUrl: string | null;
  note: string | null;
  savedAt: string;
  /** The soonest departure still to run, so the list is actionable rather than a museum. */
  nextDeparture: {
    id: string;
    startDate: string;
    endDate: string;
    opensAt: string | null;
    /** Resolved here rather than in the component: reading the clock during render is impure. */
    notYetOpen: boolean;
  } | null;
}

interface SavedRow {
  tour_id: string;
  note: string | null;
  created_at: string;
  tours: {
    slug: string;
    name: string;
    summary: string | null;
    hero_image_url: string | null;
  } | null;
}

export async function listSavedTours(): Promise<SavedTour[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("saved_tours")
    .select("tour_id, note, created_at, tours(slug, name, summary, hero_image_url)")
    .order("created_at", { ascending: false });
  if (error) {
    if (error.code === "42501") return [];
    throw error;
  }

  const rows = (data ?? []) as unknown as SavedRow[];
  if (rows.length === 0) return [];

  // One query for the next departure of each saved tour, rather than one per row.
  const { data: departures } = await sb
    .from("departures")
    .select("id, tour_id, start_date, end_date, opens_at")
    .in(
      "tour_id",
      rows.map((r) => r.tour_id),
    )
    .gte("start_date", new Date().toISOString().slice(0, 10))
    .in("status", ["open", "guaranteed", "full"])
    .order("start_date");

  const now = Date.now();
  const nextByTour = new Map<string, NonNullable<SavedTour["nextDeparture"]>>();
  for (const d of departures ?? []) {
    if (!nextByTour.has(d.tour_id)) {
      nextByTour.set(d.tour_id, {
        id: d.id,
        startDate: d.start_date,
        endDate: d.end_date,
        opensAt: d.opens_at,
        notYetOpen: Boolean(d.opens_at && new Date(d.opens_at).getTime() > now),
      });
    }
  }

  return rows.map((r) => ({
    tourId: r.tour_id,
    slug: r.tours?.slug ?? "",
    name: r.tours?.name ?? "",
    summary: r.tours?.summary ?? null,
    heroImageUrl: r.tours?.hero_image_url ?? null,
    note: r.note,
    savedAt: r.created_at,
    nextDeparture: nextByTour.get(r.tour_id) ?? null,
  }));
}

/** Whether the signed-in traveler has kept this one, for the save button's initial state. */
export async function isTourSaved(tourId: string): Promise<boolean> {
  const sb = await createClient();
  const { data } = await sb
    .from("saved_tours")
    .select("tour_id")
    .eq("tour_id", tourId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * How many people have kept a tour. Read anonymously so a public page can still be cached, and a
 * count rather than a list because saving something should not be a public act.
 *
 * Returns null below a floor: "1 person saved this" is worse than silence, the same reasoning the
 * roster stats already use.
 */
export const SAVE_COUNT_FLOOR = 5;

export async function getSaveCount(tourId: string): Promise<number | null> {
  const sb = createPublicClient();
  const { data } = await sb
    .from("tour_save_counts")
    .select("saves")
    .eq("tour_id", tourId)
    .maybeSingle();
  const saves = data?.saves ?? 0;
  return saves >= SAVE_COUNT_FLOOR ? saves : null;
}

export type DestinationAlert = Tables<"destination_alerts">;

/** The alerts a signed-in traveler has asked for, so they can see and stop them. */
export async function listMyAlerts(): Promise<
  Array<DestinationAlert & { destinationName: string | null }>
> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("destination_alerts")
    .select("*, destinations(name)")
    .is("unsubscribed_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    if (error.code === "42501") return [];
    throw error;
  }
  return ((data ?? []) as Array<DestinationAlert & { destinations: { name: string } | null }>).map(
    (a) => ({ ...a, destinationName: a.destinations?.name ?? null }),
  );
}

export interface ComingUp {
  kind: "departure" | "meetup";
  id: string;
  title: string;
  slug: string | null;
  happensAt: string;
  startDate: string | null;
  endDate: string | null;
  opensAt: string | null;
  city: string | null;
  /**
   * Priced and visible but not yet bookable. Decided here, at fetch time, rather than in the page:
   * reading the clock during render is impure, and the page is revalidated every ten minutes
   * anyway, so the answer is exactly as fresh either way.
   */
  notYetOpen: boolean;
}

/**
 * Everything still to come, for somebody who is not currently planning anything. Read anonymously:
 * it is a reason to visit, not a reason to sign in.
 */
export async function listWhatsComing(limit = 30): Promise<ComingUp[]> {
  const sb = createPublicClient();
  const { data, error } = await sb
    .from("whats_coming")
    .select("*")
    .order("happens_at")
    .limit(limit);
  if (error) throw error;
  const now = Date.now();
  return (data ?? []).map((r) => ({
    kind: (r.kind ?? "departure") as ComingUp["kind"],
    id: r.id ?? "",
    title: r.title ?? "",
    slug: r.slug,
    happensAt: r.happens_at ?? "",
    startDate: r.start_date,
    endDate: r.end_date,
    opensAt: r.opens_at,
    city: r.city,
    notYetOpen: Boolean(r.opens_at && new Date(r.opens_at).getTime() > now),
  }));
}
