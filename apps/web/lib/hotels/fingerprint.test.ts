import { describe, expect, it } from "vitest";
import { rateFingerprint, withGuidelessHotel } from "./fingerprint";
import { HOTEL, rate } from "./fixtures.test-data";
import { impliesBreakfast, nights, normalizeBedType, toMinorUnits } from "./normalize";

describe("rateFingerprint", () => {
  it("is identical for the same product across suppliers once the Guideless hotel is attached", () => {
    const duffel = withGuidelessHotel(
      rate({ supplier: "duffel", supplierHotelId: "d1", roomName: "Superior  King Room" }),
      HOTEL,
    );
    const expedia = withGuidelessHotel(
      rate({
        supplier: "expedia",
        supplierHotelId: "e9",
        roomName: "superior king room",
        bedType: "1 King Bed",
      }),
      HOTEL,
    );
    expect(rateFingerprint(duffel)).toBe(rateFingerprint(expedia));
  });

  it("differs for refundable vs non-refundable, breakfast, payment type and occupancy", () => {
    const base = withGuidelessHotel(rate(), HOTEL);
    expect(
      rateFingerprint(
        withGuidelessHotel(rate({ refundable: false, cancellationPolicy: {} }), HOTEL),
      ),
    ).not.toBe(rateFingerprint(base));
    expect(rateFingerprint(withGuidelessHotel(rate({ breakfastIncluded: false }), HOTEL))).not.toBe(
      rateFingerprint(base),
    );
    expect(
      rateFingerprint(withGuidelessHotel(rate({ paymentType: "pay_at_property" }), HOTEL)),
    ).not.toBe(rateFingerprint(base));
    expect(
      rateFingerprint(withGuidelessHotel(rate({ occupancy: { adults: 1, children: 0 } }), HOTEL)),
    ).not.toBe(rateFingerprint(base));
  });

  it("uses the cancellation deadline day, not the exact time", () => {
    const a = withGuidelessHotel(
      rate({ cancellationPolicy: { deadline: "2027-05-20T10:00:00Z" } }),
      HOTEL,
    );
    const b = withGuidelessHotel(
      rate({ cancellationPolicy: { deadline: "2027-05-20T23:59:00Z" } }),
      HOTEL,
    );
    expect(rateFingerprint(a)).toBe(rateFingerprint(b));
  });

  it("falls back to the supplier hotel id when no Guideless hotel is attached", () => {
    expect(rateFingerprint(rate({ supplierHotelId: "x" }))).toContain("h:duffel:x");
  });
});

describe("normalize helpers", () => {
  it("converts major units to minor units per currency", () => {
    expect(toMinorUnits("1234.50", "USD")).toBe(123450);
    expect(toMinorUnits(0.1 + 0.2, "EUR")).toBe(30);
    expect(() => toMinorUnits("abc", "USD")).toThrow(TypeError);
  });
  it("counts nights and normalizes beds and breakfast hints", () => {
    expect(nights("2027-06-03", "2027-06-07")).toBe(4);
    expect(normalizeBedType("1 King Bed")).toBe("king");
    expect(normalizeBedType("Two Single Beds")).toBe("twin");
    expect(normalizeBedType(undefined)).toBeUndefined();
    expect(impliesBreakfast("Room only")).toBe(false);
    expect(impliesBreakfast("Bed and Breakfast")).toBe(true);
    expect(impliesBreakfast(false, "Includes breakfast")).toBe(true);
  });
});
