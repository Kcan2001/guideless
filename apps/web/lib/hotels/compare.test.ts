import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEIGHTS,
  bestBySupplier,
  groupByFingerprint,
  pickOffer,
  scoreRate,
} from "./compare";
import { withGuidelessHotel } from "./fingerprint";
import { HOTEL, rate } from "./fixtures.test-data";
import { applyPricingRule } from "./pricing";

const same = (overrides: Parameters<typeof rate>[0]) => withGuidelessHotel(rate(overrides), HOTEL);

describe("groupByFingerprint / bestBySupplier", () => {
  it("compares only equivalent rates and picks the cheapest supplier within each product", () => {
    const rates = [
      same({ supplier: "duffel", totalAmount: 4_000_00 }),
      same({ supplier: "expedia", totalAmount: 3_950_00 }),
      same({ supplier: "hotelbeds", totalAmount: 3_700_00 }),
      // Cheaper, but a different product: non-refundable, no breakfast.
      same({
        supplier: "hotelbeds",
        totalAmount: 3_100_00,
        refundable: false,
        cancellationPolicy: {},
        breakfastIncluded: false,
      }),
      same({ supplier: "duffel", totalAmount: 3_000_00, available: false }),
    ];
    const groups = groupByFingerprint(rates);
    expect(groups.size).toBe(2);
    const best = bestBySupplier(rates);
    expect(best.map((r) => [r.supplier, r.totalAmount])).toEqual([
      ["hotelbeds", 3_100_00],
      ["hotelbeds", 3_700_00],
    ]);
  });
});

describe("scoreRate", () => {
  it("rewards free cancellation and breakfast enough to beat a slightly cheaper bare rate", () => {
    const flexible = same({ supplier: "duffel", totalAmount: 4_000_00 });
    const bare = same({
      supplier: "hotelbeds",
      totalAmount: 3_800_00,
      refundable: false,
      cancellationPolicy: {},
      breakfastIncluded: false,
    });
    const all = [flexible, bare];
    expect(scoreRate(flexible, all)).toBeGreaterThan(scoreRate(bare, all));
  });

  it("lets price win when the gap is large", () => {
    const flexible = same({ supplier: "duffel", totalAmount: 4_000_00 });
    const bare = same({
      supplier: "hotelbeds",
      totalAmount: 2_800_00,
      refundable: false,
      cancellationPolicy: {},
      breakfastIncluded: false,
    });
    const all = [flexible, bare];
    expect(scoreRate(bare, all)).toBeGreaterThan(scoreRate(flexible, all));
  });

  it("adds margin points only for priced rates", () => {
    const r = same({ totalAmount: 4_000_00 });
    const priced = applyPricingRule(r, {
      minMarkupAmount: 0,
      percentageMarkup: 10,
      fixedMarkupAmount: 0,
      priority: 0,
    });
    expect(scoreRate(priced, [r])).toBeGreaterThan(scoreRate(r, [r]));
  });

  it("uses documented default weights", () => {
    expect(DEFAULT_WEIGHTS.refundable).toBe(12);
    expect(DEFAULT_WEIGHTS.supplierReliability.manual).toBe(1);
  });
});

describe("pickOffer", () => {
  it("returns null with nothing available", () => {
    expect(pickOffer([same({ available: false })])).toBeNull();
  });

  it("chooses the best-scored product with the cheapest supplier and lists alternatives", () => {
    const rates = [
      same({ supplier: "duffel", supplierRateId: "d-flex", totalAmount: 4_000_00 }),
      same({ supplier: "expedia", supplierRateId: "e-flex", totalAmount: 3_950_00 }),
      same({
        supplier: "hotelbeds",
        supplierRateId: "h-bare",
        totalAmount: 3_800_00,
        refundable: false,
        cancellationPolicy: {},
        breakfastIncluded: false,
      }),
    ];
    const offer = pickOffer(rates);
    expect(offer?.rate.supplierRateId).toBe("e-flex");
    expect(offer?.alternatives.map((r) => r.supplierRateId)).toEqual(["d-flex"]);
  });
});
