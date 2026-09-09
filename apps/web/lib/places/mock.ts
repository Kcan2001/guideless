import type { RecommendationCategory } from "@guideless/types";
import type { PlaceSearchInput } from "@guideless/validation";
import type { Place, PlacesProvider } from "@/lib/places/types";
import fixtures from "./__fixtures__/mock-places.json";

/**
 * Deterministic places provider backed by __fixtures__/mock-places.json.
 *
 * It exists so the assistant is fully testable — and shippable — before anybody enables Google
 * Cloud billing. The fixtures are real places at real coordinates in the destinations we actually
 * sell, so "what's near me" returns something a person could walk to and distance ordering is
 * meaningful rather than random.
 *
 * `openNow` is computed from the fixture's opening window against the search time, including
 * windows that cross midnight, because "is it open now" is the one thing the curated table cannot
 * answer and therefore the one behaviour worth exercising properly in tests.
 */

interface MockPlace {
  ref: string;
  name: string;
  categories: string[];
  address: string;
  latitude: number;
  longitude: number;
  priceLevel: number | null;
  rating: number;
  ratingCount: number;
  opens: string;
  closes: string;
  keywords: string[];
}

const PLACES = (fixtures as { places: MockPlace[]; timezone: string }).places;
/** The fixtures are all in France and Monaco, which share a zone. Hours are local to it. */
const FIXTURE_ZONE = (fixtures as { timezone: string }).timezone;

/** Metres between two points. Equirectangular: at city scale the error is centimetres. */
export function distanceMeters(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x = toRad(bLon - aLon) * Math.cos(toRad((aLat + bLat) / 2));
  const y = toRad(bLat - aLat);
  return Math.round(Math.sqrt(x * x + y * y) * R);
}

const minutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/**
 * Minutes past local midnight in a zone. Opening hours are wall-clock in the place, so comparing
 * them against UTC would have every French café opening two hours late in summer.
 */
export function localMinutes(at: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return (get("hour") % 24) * 60 + get("minute");
}

/** Handles a window that crosses midnight — a bar open 17:00–02:00 is open at 01:00. */
export function isOpenAt(opens: string, closes: string, nowMinutes: number): boolean {
  const from = minutes(opens);
  const to = minutes(closes);
  return from <= to ? nowMinutes >= from && nowMinutes < to : nowMinutes >= from || nowMinutes < to;
}

function score(place: MockPlace, query: string): number {
  const q = query.toLowerCase();
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  let hits = 0;
  for (const word of words) {
    if (place.name.toLowerCase().includes(word)) hits += 3;
    if (place.keywords.some((k) => k.includes(word) || word.includes(k))) hits += 2;
    if (place.categories.some((c) => c.includes(word))) hits += 1;
  }
  return hits;
}

export class MockPlacesProvider implements PlacesProvider {
  readonly id = "mock" as const;

  /** `now` is injectable so a test can ask what is open at 01:00 without waiting until 01:00. */
  constructor(private readonly now: () => Date = () => new Date()) {}

  search(input: PlaceSearchInput): Promise<Place[]> {
    const nowMinutes = localMinutes(this.now(), FIXTURE_ZONE);

    const results = PLACES.map((p) => ({
      place: p,
      distance: distanceMeters(input.latitude, input.longitude, p.latitude, p.longitude),
      relevance: score(p, input.query),
    }))
      .filter((r) => r.distance <= input.radiusMeters)
      // A query that matches nothing still returns what is nearby: "anything good around here?"
      // is a real question, and an empty list is a worse answer than a walkable market.
      .filter((r) => r.relevance > 0 || PLACES.every((p) => score(p, input.query) === 0))
      .filter((r) => !input.openNow || isOpenAt(r.place.opens, r.place.closes, nowMinutes))
      .sort((a, b) => b.relevance - a.relevance || a.distance - b.distance)
      .slice(0, input.limit);

    return Promise.resolve(
      results.map(({ place, distance }) => ({
        ref: place.ref,
        name: place.name,
        categories: place.categories as RecommendationCategory[],
        address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
        distanceMeters: distance,
        priceLevel: place.priceLevel,
        rating: place.rating,
        ratingCount: place.ratingCount,
        openNow: isOpenAt(place.opens, place.closes, nowMinutes),
        mapsUrl: `https://maps.google.com/?q=${encodeURIComponent(`${place.name}, ${place.address}`)}`,
        website: null,
        source: "mock" as const,
      })),
    );
  }
}
