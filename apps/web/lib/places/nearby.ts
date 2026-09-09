import "server-only";

import type { RecommendationCategory } from "@guideless/types";
import { placeSearchSchema } from "@guideless/validation";
import { distanceMeters } from "@/lib/places/mock";
import { getPlacesProvider } from "@/lib/places";
import { rankNearby, type NearbyPlace, type NearbySource } from "@/lib/places/ranking";
import type { Place } from "@/lib/places/types";
import { createClient } from "@/lib/supabase/server";

export type { NearbyPlace, NearbySource } from "@/lib/places/ranking";

/**
 * "What's good near me, right now" — the two sources merged and ranked, with the seams left visible.
 *
 * Our curated recommendations have judgement and no coverage; the places provider has coverage and
 * no judgement. Merging them is the point of the feature, and the one thing that must survive the
 * merge is which is which: a curated pick and a live search result are labelled differently
 * wherever they are rendered, and a curated pick wins a tie on purpose.
 *
 * Taste changes the order and nothing else. It never removes a place — somebody who has opened
 * three bars should not stop being shown the market — because a filter dressed as a ranking is how
 * a recommender quietly narrows into a rut.
 */

export interface NearbyResult {
  places: NearbyPlace[];
  /** True when the live lookup failed; the caller says so rather than pretending it was skipped. */
  liveUnavailable: boolean;
  provider: string;
}

const DEFAULT_RADIUS = 1500;

export async function nearbyPlaces(input: {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  query?: string;
  openNow?: boolean;
  limit?: number;
}): Promise<NearbyResult> {
  const sb = await createClient();
  const radius = input.radiusMeters ?? DEFAULT_RADIUS;
  const limit = input.limit ?? 12;

  const [{ data: taste }, { data: recs }] = await Promise.all([
    sb.rpc("traveler_taste"),
    // Curated rows have coordinates or they are useless here; the bounding box is a cheap
    // pre-filter so a destination with hundreds of rows does not all come back to be measured.
    sb
      .from("recommendations")
      .select(
        "id, title, description, categories, address, latitude, longitude, price_level, maps_url",
      )
      .eq("is_published", true)
      .not("latitude", "is", null)
      .gte("latitude", input.latitude - degreesFor(radius))
      .lte("latitude", input.latitude + degreesFor(radius))
      .limit(200),
  ]);

  const weights = new Map<string, number>(
    ((taste ?? []) as Array<{ category: RecommendationCategory; weight: number }>).map((t) => [
      t.category,
      Number(t.weight),
    ]),
  );

  const curated: NearbyPlace[] = ((recs ?? []) as CuratedRow[])
    .map((r) => {
      const distance =
        r.latitude !== null && r.longitude !== null
          ? distanceMeters(input.latitude, input.longitude, r.latitude, r.longitude)
          : null;
      return { row: r, distance };
    })
    .filter((r) => r.distance !== null && r.distance <= radius)
    .map(({ row, distance }) => ({
      id: row.id,
      name: row.title,
      source: "curated" as const,
      description: row.description,
      categories: row.categories,
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
      distanceMeters: distance,
      priceLevel: row.price_level,
      rating: null,
      // We do not know a curated place's hours, and saying so is better than implying it is open.
      openNow: null,
      mapsUrl: row.maps_url,
      matchedTaste: row.categories.filter((c) => weights.has(c)),
    }));

  let live: NearbyPlace[] = [];
  let liveUnavailable = false;
  const provider = getPlacesProvider();
  try {
    const parsed = placeSearchSchema.parse({
      query: input.query?.trim() || "things to do",
      latitude: input.latitude,
      longitude: input.longitude,
      radiusMeters: radius,
      openNow: input.openNow,
      limit: 10,
    });
    live = (await provider.search(parsed)).map(toNearby(weights));
  } catch {
    // A provider being down degrades the list to our own picks. It never empties the screen and it
    // is never hidden — the caller is told, and tells the traveler.
    liveUnavailable = true;
  }

  // A live result that is obviously the same place as a curated one is dropped, because two
  // entries for one restaurant reads as a bug and costs the curated sentence its place.
  const curatedKeys = new Set(curated.map((c) => normalize(c.name)));
  const merged = [...curated, ...live.filter((l) => !curatedKeys.has(normalize(l.name)))];

  return {
    places: rankNearby(merged, weights).slice(0, limit),
    liveUnavailable,
    provider: provider.id,
  };
}

interface CuratedRow {
  id: string;
  title: string;
  description: string | null;
  categories: RecommendationCategory[];
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  price_level: number | null;
  maps_url: string | null;
}

const toNearby =
  (weights: Map<string, number>) =>
  (p: Place): NearbyPlace => ({
    id: p.ref,
    name: p.name,
    source: "live",
    description: null,
    categories: p.categories,
    address: p.address,
    latitude: p.latitude,
    longitude: p.longitude,
    distanceMeters: p.distanceMeters,
    priceLevel: p.priceLevel,
    rating: p.rating,
    openNow: p.openNow,
    mapsUrl: p.mapsUrl,
    matchedTaste: p.categories.filter((c) => weights.has(c)),
  });

/** Degrees of latitude for a distance in metres — enough for a bounding box, not for a measurement. */
function degreesFor(meters: number): number {
  return meters / 111_320;
}

const normalize = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
