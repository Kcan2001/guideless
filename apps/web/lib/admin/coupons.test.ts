import { describe, expect, it } from "vitest";
import { couponFormSchema } from "@guideless/validation";

/**
 * The coupon form mirrors the database constraints on `coupons` (exactly one of percent/amount,
 * a currency exactly when it is an amount, a sane window). If these drift apart, staff meet a raw
 * Postgres error instead of a sentence they can act on — so the rules are pinned here.
 */

const percent = { code: "EARLYBIRD", kind: "percent", percentOff: "20" };
const amount = { code: "GIFT100", kind: "amount", amountOff: "100.00", currency: "USD" };

describe("couponFormSchema", () => {
  it("accepts a percentage coupon", () => {
    expect(couponFormSchema.safeParse(percent).success).toBe(true);
  });

  it("accepts a fixed amount in a currency, converted to minor units", () => {
    const parsed = couponFormSchema.safeParse(amount);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.amountOff).toBe(10_000);
      expect(parsed.data.currency).toBe("USD");
    }
  });

  it("upper-cases the code so the list reads consistently", () => {
    const parsed = couponFormSchema.safeParse({ ...percent, code: "earlybird" });
    expect(parsed.success && parsed.data.code).toBe("EARLYBIRD");
  });

  it("requires a value for the kind that was chosen", () => {
    expect(couponFormSchema.safeParse({ code: "NOPCT", kind: "percent" }).success).toBe(false);
    expect(
      couponFormSchema.safeParse({ code: "NOAMT", kind: "amount", currency: "USD" }).success,
    ).toBe(false);
  });

  it("refuses an amount without a currency, matching the database check", () => {
    expect(
      couponFormSchema.safeParse({ code: "NOCUR", kind: "amount", amountOff: "50" }).success,
    ).toBe(false);
  });

  it("refuses a zero amount and an out-of-range percentage", () => {
    expect(
      couponFormSchema.safeParse({ code: "ZERO", kind: "amount", amountOff: "0", currency: "USD" })
        .success,
    ).toBe(false);
    expect(couponFormSchema.safeParse({ ...percent, percentOff: "150" }).success).toBe(false);
    expect(couponFormSchema.safeParse({ ...percent, percentOff: "0" }).success).toBe(false);
  });

  it("refuses a window that ends before it starts", () => {
    const parsed = couponFormSchema.safeParse({
      ...percent,
      validFrom: "2027-06-01",
      validUntil: "2027-05-01",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts an open-ended window", () => {
    const parsed = couponFormSchema.safeParse({ ...percent, validFrom: "", validUntil: "" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.validFrom).toBeNull();
      expect(parsed.data.validUntil).toBeNull();
    }
  });

  it("rejects codes with spaces or punctuation a traveler would mistype", () => {
    expect(couponFormSchema.safeParse({ ...percent, code: "BAD CODE" }).success).toBe(false);
    expect(couponFormSchema.safeParse({ ...percent, code: "OFF!" }).success).toBe(false);
    expect(couponFormSchema.safeParse({ ...percent, code: "SUMMER-27_A" }).success).toBe(true);
  });

  it("treats a blank maximum as unlimited rather than zero", () => {
    const parsed = couponFormSchema.safeParse({ ...percent, maxRedemptions: "" });
    expect(parsed.success && parsed.data.maxRedemptions).toBeNull();
  });
});
