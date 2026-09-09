import type { RecommendationCategory } from "@guideless/types";
import type { PlaceSearchInput } from "@guideless/validation";

/**
 * "What's good near me, open now" — the one thing our curated recommendations cannot answer.
 *
 * The curated table has judgement and no coverage: a handful of places per destination, chosen by
 * a person, with no idea whether any of them is open at 19:40 on a Tuesday. A places provider has
 * coverage and no judgement. The assistant needs both, and says which is which.
 *
 * The contract is deliberately the same shape as the hotel supplier one — search, a normalized
 * result, a typed error, a timeout — because it is the same problem and the second adapter is
 * where a codebase decides whether it has a pattern or a precedent.
 */

export interface Place {
  /** Provider-scoped id, stored on a traveler's plan so we can look it up again. */
  ref: string;
  name: string;
  /** Our own vocabulary, mapped from whatever the provider calls things. */
  categories: RecommendationCategory[];
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Metres from the search point, when the provider gives us enough to compute it. */
  distanceMeters: number | null;
  /** 1–4, matching `recommendations.price_level`, or null when unknown. */
  priceLevel: number | null;
  /** Provider rating out of 5, and how many people gave it. Never invented, often null. */
  rating: number | null;
  ratingCount: number | null;
  /** Null means "we don't know", which is different from "closed" and must read differently. */
  openNow: boolean | null;
  mapsUrl: string | null;
  website: string | null;
  /** Which provider said so. Rendered to the traveler: an unchecked place must look unchecked. */
  source: PlacesProviderId;
}

export type PlacesProviderId = "mock" | "google";

export interface PlacesProvider {
  readonly id: PlacesProviderId;
  search(input: PlaceSearchInput): Promise<Place[]>;
}

export type PlacesErrorCode =
  "unauthorized" | "rate_limited" | "timeout" | "unavailable" | "bad_request";

export class PlacesError extends Error {
  constructor(
    readonly code: PlacesErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PlacesError";
  }
}

/** A slow provider must not hold a traveler's question open; the assistant answers without it. */
export const PLACES_TIMEOUT_MS = 6000;

export async function withTimeout<T>(p: Promise<T>, ms = PLACES_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new PlacesError("timeout", "The place search timed out")),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
