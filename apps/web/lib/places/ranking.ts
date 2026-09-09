import type { RecommendationCategory } from "@guideless/types";

/**
 * How the nearby list is ordered — pure, so it can be read and tested rather than tuned by feel.
 *
 * Ranking is the part of a recommender that quietly becomes policy, so the weights are small
 * integers with reasons rather than coefficients somebody fitted once:
 *
 *   closeness   dominates, because the question asked was "near me". Zero at 2 km, ten underfoot.
 *   open        nudges up; closed pushes down hard. Unknown hours are neutral — "we don't know"
 *               is not "closed", and treating it as closed buries everything we have no data for.
 *   taste       nudges. It never removes anything: a filter dressed as a ranking is how a
 *               recommender narrows into a rut, and somebody who opened three bars should still
 *               be shown the morning market.
 *   ours        a deliberate thumb on the scale, because a person chose it and an API did not.
 */

export type NearbySource = "curated" | "live";

export interface NearbyPlace {
  id: string;
  name: string;
  source: NearbySource;
  description: string | null;
  categories: RecommendationCategory[];
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceMeters: number | null;
  priceLevel: number | null;
  rating: number | null;
  openNow: boolean | null;
  mapsUrl: string | null;
  matchedTaste: RecommendationCategory[];
}

/** An unknown distance is treated as far away rather than as zero. */
const ASSUMED_FAR_METERS = 5000;

export function scoreNearby(place: NearbyPlace, weights: Map<string, number>): number {
  const distance = place.distanceMeters ?? ASSUMED_FAR_METERS;
  const closeness = Math.max(0, 10 - distance / 200);
  const taste = place.matchedTaste.reduce((sum, c) => sum + (weights.get(c) ?? 0), 0);
  const open = place.openNow === true ? 3 : place.openNow === false ? -4 : 0;
  const ours = place.source === "curated" ? 4 : 0;
  return closeness + taste + open + ours;
}

/** Highest first. Stable on a tie, so the same query does not shuffle between refreshes. */
export function rankNearby(places: NearbyPlace[], weights: Map<string, number>): NearbyPlace[] {
  return places
    .map((place, index) => ({ place, index, score: scoreNearby(place, weights) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((r) => r.place);
}
