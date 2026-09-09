import type { RecommendationCategory } from "@guideless/types";
import type { PlaceSearchInput } from "@guideless/validation";
import { PlacesError, withTimeout, type Place, type PlacesProvider } from "@/lib/places/types";
import { distanceMeters } from "@/lib/places/mock";

/**
 * Google Places API (New) — Text Search, biased to where the traveler is standing.
 *
 * Written against the documented v1 response shape, and deliberately defensive about it: every
 * field below is optional in practice, and a missing rating must come back as `null` rather than
 * as a zero that would read on screen as "rated 0 out of 5".
 *
 * Cost control is not incidental here. Each call is billed, so the field mask is the minimum that
 * answers the question — asking for fewer fields is literally cheaper — and the caller's `limit`
 * is passed as `maxResultCount` rather than trimmed after the fact.
 */

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

/** Only what we render. A wider mask is a larger bill for data nobody sees. */
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.types",
  "places.priceLevel",
  "places.rating",
  "places.userRatingCount",
  "places.currentOpeningHours.openNow",
  "places.googleMapsUri",
  "places.websiteUri",
].join(",");

/**
 * Google's place types are a long, flat vocabulary; ours is thirteen words a person chose. This
 * maps only what maps cleanly — an unmapped type contributes nothing rather than being forced into
 * the nearest category, because a wrong category is worse than no category when it drives a
 * suggestion.
 */
const TYPE_TO_CATEGORY: Record<string, RecommendationCategory> = {
  restaurant: "food",
  food: "food",
  bakery: "food",
  meal_takeaway: "food",
  ice_cream_shop: "food",
  cafe: "coffee",
  coffee_shop: "coffee",
  bar: "bars",
  wine_bar: "bars",
  pub: "bars",
  night_club: "nightlife",
  museum: "culture",
  art_gallery: "culture",
  historical_landmark: "culture",
  tourist_attraction: "culture",
  church: "culture",
  park: "nature",
  hiking_area: "nature",
  beach: "nature",
  garden: "nature",
  shopping_mall: "shopping",
  store: "shopping",
  market: "local",
  clothing_store: "shopping",
};

/** Google's enum → the 1–4 integer `recommendations.price_level` already uses. */
const PRICE_LEVEL: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  priceLevel?: string;
  rating?: number;
  userRatingCount?: number;
  currentOpeningHours?: { openNow?: boolean };
  googleMapsUri?: string;
  websiteUri?: string;
}

export class GooglePlacesProvider implements PlacesProvider {
  readonly id = "google" as const;

  constructor(private readonly opts: { apiKey: string; fetchImpl?: typeof fetch }) {}

  async search(input: PlaceSearchInput): Promise<Place[]> {
    const doFetch = this.opts.fetchImpl ?? fetch;
    const res = await withTimeout(
      doFetch(ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Goog-Api-Key": this.opts.apiKey,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery: input.query,
          maxResultCount: input.limit,
          openNow: input.openNow ?? undefined,
          locationBias: {
            circle: {
              center: { latitude: input.latitude, longitude: input.longitude },
              radius: input.radiusMeters,
            },
          },
        }),
      }),
    );

    if (!res.ok) throw errorFor(res.status, await safeText(res));

    const body = (await res.json()) as { places?: GooglePlace[] };
    return (body.places ?? []).map((p) => toPlace(p, input));
  }
}

function toPlace(p: GooglePlace, input: PlaceSearchInput): Place {
  const lat = p.location?.latitude ?? null;
  const lng = p.location?.longitude ?? null;
  const categories = [
    ...new Set(
      (p.types ?? [])
        .map((t) => TYPE_TO_CATEGORY[t])
        .filter((c): c is RecommendationCategory => Boolean(c)),
    ),
  ];
  return {
    ref: p.id ? `google:${p.id}` : `google:${p.displayName?.text ?? "unknown"}`,
    name: p.displayName?.text ?? "Unnamed place",
    categories,
    address: p.formattedAddress ?? null,
    latitude: lat,
    longitude: lng,
    distanceMeters:
      lat !== null && lng !== null
        ? distanceMeters(input.latitude, input.longitude, lat, lng)
        : null,
    priceLevel: p.priceLevel ? (PRICE_LEVEL[p.priceLevel] ?? null) : null,
    // A place with no ratings is not a place rated zero.
    rating: typeof p.rating === "number" ? p.rating : null,
    ratingCount: typeof p.userRatingCount === "number" ? p.userRatingCount : null,
    // Absent means Google does not publish hours for it — which must not read as "closed".
    openNow:
      typeof p.currentOpeningHours?.openNow === "boolean" ? p.currentOpeningHours.openNow : null,
    mapsUrl: p.googleMapsUri ?? null,
    website: p.websiteUri ?? null,
    source: "google",
  };
}

function errorFor(status: number, body: string): PlacesError {
  if (status === 401 || status === 403)
    return new PlacesError("unauthorized", `Places rejected the key (${status})`, status);
  if (status === 429) return new PlacesError("rate_limited", "Places rate limit reached", status);
  if (status === 400)
    return new PlacesError("bad_request", `Places rejected the query: ${body}`, status);
  return new PlacesError("unavailable", `Places is unavailable (${status})`, status);
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return "";
  }
}
