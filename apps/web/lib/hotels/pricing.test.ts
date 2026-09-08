import { describe, expect, it } from "vitest";
import { DESTINATION, HOTEL, rate } from "./fixtures.test-data";
import { applyPricingRule, markupFor, priceRate, ruleApplies, selectRule } from "./pricing";
import type { PricingRuleLike } from "./types";

const ctx = { hotelId: HOTEL, destinationId: DESTINATION, date: "2027-06-03" };

const global: PricingRuleLike & { createdAt: string } = {
  id: "g",
  minMarkupAmount: 100_00,
  percentageMarkup: 10,
  fixedMarkupAmount: 0,
  priority: 0,
  createdAt: "2026-09-01",
};
const monaco: PricingRuleLike & { createdAt: string } = {
  id: "d",
  destinationId: DESTINATION,
  minMarkupAmount: 250_00,
  percentageMarkup: 12,
  fixedMarkupAmount: 0,
  priority: 0,
  createdAt: "2026-09-02",
};
const thisHotel: PricingRuleLike & { createdAt: string } = {
  id: "h",
  hotelId: HOTEL,
  minMarkupAmount: 0,
  percentageMarkup: 0,
  fixedMarkupAmount: 150_00,
  priority: 0,
  createdAt: "2026-09-03",
};

describe("markupFor", () => {
  it("is max(min, round(total × pct) + fixed), in minor units", () => {
    expect(
      markupFor(4_000_00, {
        minMarkupAmount: 0,
        percentageMarkup: 10,
        fixedMarkupAmount: 0,
        priority: 0,
      }),
    ).toBe(400_00);
    expect(
      markupFor(4_000_00, {
        minMarkupAmount: 500_00,
        percentageMarkup: 10,
        fixedMarkupAmount: 0,
        priority: 0,
      }),
    ).toBe(500_00);
    expect(
      markupFor(4_000_00, {
        minMarkupAmount: 0,
        percentageMarkup: 2.5,
        fixedMarkupAmount: 25_00,
        priority: 0,
      }),
    ).toBe(125_00);
    expect(
      markupFor(3_333_33, {
        minMarkupAmount: 0,
        percentageMarkup: 10,
        fixedMarkupAmount: 0,
        priority: 0,
      }),
    ).toBe(333_33);
    expect(markupFor(4_000_00, null)).toBe(0);
  });
});

describe("selectRule", () => {
  it("prefers hotel over destination over global", () => {
    expect(selectRule([global, monaco, thisHotel], ctx)?.id).toBe("h");
    expect(selectRule([global, monaco], ctx)?.id).toBe("d");
    expect(selectRule([global], ctx)?.id).toBe("g");
  });

  it("ignores inactive rules, other hotels and rules outside their window", () => {
    expect(selectRule([{ ...thisHotel, isActive: false }, global], ctx)?.id).toBe("g");
    expect(selectRule([{ ...thisHotel, hotelId: "other" }, global], ctx)?.id).toBe("g");
    expect(selectRule([{ ...thisHotel, effectiveFrom: "2027-07-01" }, global], ctx)?.id).toBe("g");
    expect(selectRule([{ ...thisHotel, effectiveTo: "2027-06-02" }, global], ctx)?.id).toBe("g");
    expect(
      selectRule([{ ...thisHotel, effectiveFrom: "2027-06-01", effectiveTo: "2027-06-03" }], ctx)
        ?.id,
    ).toBe("h");
    expect(selectRule([], ctx)).toBeNull();
  });

  it("breaks ties on priority, then on the newest rule", () => {
    const a = { ...monaco, id: "a", priority: 5 };
    const b = { ...monaco, id: "b", priority: 1 };
    expect(selectRule([b, a], ctx)?.id).toBe("a");
    const older = { ...monaco, id: "old", createdAt: "2026-01-01" };
    const newer = { ...monaco, id: "new", createdAt: "2026-09-08" };
    expect(selectRule([older, newer], ctx)?.id).toBe("new");
  });

  it("ruleApplies matches the SQL semantics for destination rules without a destination context", () => {
    expect(ruleApplies(monaco, { ...ctx, destinationId: null })).toBe(false);
    expect(ruleApplies(global, { ...ctx, destinationId: null })).toBe(true);
  });
});

describe("applyPricingRule / priceRate", () => {
  it("adds the markup on top of the supplier total and records the rule", () => {
    const priced = applyPricingRule(rate({ totalAmount: 4_000_00 }), monaco);
    expect(priced.markupAmount).toBe(480_00);
    expect(priced.customerAmount).toBe(4_480_00);
    expect(priced.ruleId).toBe("d");
  });

  it("picks the rule from the rate's check-in date", () => {
    const seasonal = { ...thisHotel, effectiveFrom: "2027-06-01", effectiveTo: "2027-06-10" };
    const inSeason = priceRate(rate({ checkIn: "2027-06-03" }), [global, seasonal], {
      hotelId: HOTEL,
      destinationId: DESTINATION,
    });
    const offSeason = priceRate(
      rate({ checkIn: "2027-09-03", checkOut: "2027-09-07" }),
      [global, seasonal],
      {
        hotelId: HOTEL,
        destinationId: DESTINATION,
      },
    );
    expect(inSeason.ruleId).toBe("h");
    expect(offSeason.ruleId).toBe("g");
  });
});
