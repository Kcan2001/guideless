import { describe, expect, it } from "vitest";
import { rankNearby, type NearbyPlace } from "@/lib/places/ranking";

/**
 * How the nearby list is ordered.
 *
 * Ranking is the part of a recommender that quietly becomes policy, so it is pure, small and
 * tested rather than tuned by feel. The properties worth pinning down are the ones a traveler
 * would notice and complain about: near beats far, closed sinks, our own pick wins a tie, and
 * taste never removes anything from the list.
 */

const place = (over: Partial<NearbyPlace> = {}): NearbyPlace => ({
  id: over.id ?? "p",
  name: over.name ?? "Somewhere",
  source: "live",
  description: null,
  categories: [],
  address: null,
  latitude: null,
  longitude: null,
  distanceMeters: 400,
  priceLevel: null,
  rating: null,
  openNow: null,
  mapsUrl: null,
  matchedTaste: [],
  ...over,
});

const weights = new Map<string, number>([["food", 5]]);

describe("nearby ranking", () => {
  it("puts what is close above what is far", () => {
    const ranked = rankNearby(
      [place({ id: "far", distanceMeters: 1800 }), place({ id: "near", distanceMeters: 120 })],
      new Map(),
    );
    expect(ranked[0]?.id).toBe("near");
  });

  it("sinks somewhere that is closed, without hiding it", () => {
    const ranked = rankNearby(
      [
        place({ id: "closed", distanceMeters: 100, openNow: false }),
        place({ id: "open", distanceMeters: 600, openNow: true }),
      ],
      new Map(),
    );
    expect(ranked[0]?.id).toBe("open");
    expect(ranked.map((p) => p.id)).toContain("closed");
  });

  // "Hours unknown" is not "closed" and must not be penalised like it.
  it("does not treat unknown hours as closed", () => {
    const ranked = rankNearby(
      [
        place({ id: "unknown", distanceMeters: 300, openNow: null }),
        place({ id: "closed", distanceMeters: 300, openNow: false }),
      ],
      new Map(),
    );
    expect(ranked[0]?.id).toBe("unknown");
  });

  it("gives our own pick the benefit of a tie", () => {
    const ranked = rankNearby(
      [
        place({ id: "live", source: "live", distanceMeters: 300 }),
        place({ id: "ours", source: "curated", distanceMeters: 300 }),
      ],
      new Map(),
    );
    expect(ranked[0]?.id).toBe("ours");
  });

  it("lets taste break a tie between equals", () => {
    const ranked = rankNearby(
      [
        place({ id: "plain", distanceMeters: 300 }),
        place({ id: "liked", distanceMeters: 300, categories: ["food"], matchedTaste: ["food"] }),
      ],
      weights,
    );
    expect(ranked[0]?.id).toBe("liked");
  });

  // The failure mode of a recommender: it narrows until you only ever see one kind of thing.
  it("never removes anything for not matching taste", () => {
    const ranked = rankNearby(
      [
        place({ id: "market", distanceMeters: 200 }),
        place({ id: "bar", distanceMeters: 900, categories: ["food"], matchedTaste: ["food"] }),
      ],
      weights,
    );
    expect(ranked).toHaveLength(2);
    expect(ranked.map((p) => p.id)).toContain("market");
  });

  // Distance is the question that was asked, so taste must not drag somewhere across a city.
  it("does not let taste beat a long walk", () => {
    const ranked = rankNearby(
      [
        place({ id: "close", distanceMeters: 50 }),
        place({ id: "loved", distanceMeters: 1900, categories: ["food"], matchedTaste: ["food"] }),
      ],
      weights,
    );
    expect(ranked[0]?.id).toBe("close");
  });

  it("copes with a place whose distance is unknown", () => {
    const ranked = rankNearby(
      [
        place({ id: "somewhere", distanceMeters: null }),
        place({ id: "here", distanceMeters: 100 }),
      ],
      new Map(),
    );
    expect(ranked[0]?.id).toBe("here");
  });
});
