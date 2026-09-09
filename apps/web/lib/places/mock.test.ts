import { describe, expect, it } from "vitest";
import { placeSearchSchema } from "@guideless/validation";
import { MockPlacesProvider, distanceMeters, isOpenAt } from "@/lib/places/mock";

/**
 * The mock provider is not throwaway scaffolding — with no Google billing account it is what the
 * assistant actually runs on, so it is tested like the real thing. The behaviour that matters is
 * the one the curated table cannot do: distance, and whether somewhere is open right now.
 */

const search = (over: Partial<Parameters<typeof placeSearchSchema.parse>[0]> = {}) =>
  placeSearchSchema.parse({
    query: "ice cream",
    // Old town Nice.
    latitude: 43.6961,
    longitude: 7.2757,
    ...over,
  });

describe("distance", () => {
  it("measures a short walk in metres, not degrees", () => {
    // Two points about 150 m apart in the old town.
    const d = distanceMeters(43.6961, 7.2757, 43.697, 7.2769);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(220);
  });

  it("is zero for the same point", () => {
    expect(distanceMeters(43.6961, 7.2757, 43.6961, 7.2757)).toBe(0);
  });
});

describe("opening hours", () => {
  it("handles an ordinary daytime window", () => {
    expect(isOpenAt("09:00", "17:00", 12 * 60)).toBe(true);
    expect(isOpenAt("09:00", "17:00", 8 * 60)).toBe(false);
    expect(isOpenAt("09:00", "17:00", 17 * 60)).toBe(false);
  });

  // A bar open 17:00–02:00 is open at 01:00, which a naive from <= now < to gets wrong.
  it("handles a window that crosses midnight", () => {
    expect(isOpenAt("17:00", "02:00", 1 * 60)).toBe(true);
    expect(isOpenAt("17:00", "02:00", 23 * 60)).toBe(true);
    expect(isOpenAt("17:00", "02:00", 10 * 60)).toBe(false);
  });
});

describe("the mock provider", () => {
  const at = (iso: string) => new MockPlacesProvider(() => new Date(iso));

  it("finds the obvious answer to the obvious question", async () => {
    const results = await at("2027-05-20T14:00:00Z").search(search());
    expect(results[0]?.name).toBe("Fenocchio");
    expect(results[0]?.source).toBe("mock");
  });

  it("returns places in the destination, not on the other side of the country", async () => {
    const results = await at("2027-05-20T14:00:00Z").search(search({ query: "market" }));
    // Avignon and Paris markets exist in the fixtures and must not come back for a Nice search.
    expect(results.every((r) => (r.distanceMeters ?? 0) <= 2000)).toBe(true);
  });

  it("filters to what is actually open when asked", async () => {
    // 07:30 local in Nice is 05:30 UTC: the market is open, the bar is not.
    const early = await at("2027-05-20T05:30:00Z").search(
      search({ query: "market bar", openNow: true, radiusMeters: 3000 }),
    );
    expect(early.map((r) => r.name)).toContain("Cours Saleya Market");
    expect(early.map((r) => r.name)).not.toContain("Comptoir Central Électrique");
  });

  it("reports open and closed rather than guessing", async () => {
    const late = await at("2027-05-20T23:30:00Z").search(
      search({ query: "bar", radiusMeters: 3000 }),
    );
    const bar = late.find((r) => r.name.startsWith("Comptoir"));
    expect(bar?.openNow).toBe(true);
  });

  it("answers 'anything good around here' rather than returning nothing", async () => {
    const results = await at("2027-05-20T14:00:00Z").search(
      search({ query: "somewhere nice to sit", radiusMeters: 3000 }),
    );
    expect(results.length).toBeGreaterThan(0);
  });

  it("respects the limit, because every result is a line in a prompt", async () => {
    const results = await at("2027-05-20T14:00:00Z").search(
      search({ query: "food", radiusMeters: 5000, limit: 2 }),
    );
    expect(results).toHaveLength(2);
  });
});
