import { describe, expect, it } from "vitest";
import { add, formatMoney, money, parseMoney, percentage, subtract, sum } from "./money";

describe("money", () => {
  it("rejects non-integer amounts", () => {
    expect(() => money(10.5, "USD")).toThrow(TypeError);
  });

  it("adds and subtracts in the same currency", () => {
    expect(add(money(100, "USD"), money(250, "USD"))).toEqual(money(350, "USD"));
    expect(subtract(money(1000, "EUR"), money(1, "EUR"))).toEqual(money(999, "EUR"));
  });

  it("refuses to mix currencies", () => {
    expect(() => add(money(1, "USD"), money(1, "EUR"))).toThrow(/Currency mismatch/);
  });

  it("sums a list", () => {
    expect(sum([money(1, "GBP"), money(2, "GBP"), money(3, "GBP")], "GBP")).toEqual(
      money(6, "GBP"),
    );
    expect(sum([], "GBP")).toEqual(money(0, "GBP"));
  });

  it("computes percentages with half-up rounding (deposits, refund tiers)", () => {
    const total = money(349500, "USD"); // $3,495.00
    expect(percentage(total, 25)).toEqual(money(87375, "USD"));
    expect(percentage(total, 75)).toEqual(money(262125, "USD"));
    expect(percentage(money(1, "USD"), 50)).toEqual(money(1, "USD")); // 0.5 rounds up
    expect(percentage(total, 0)).toEqual(money(0, "USD"));
    expect(percentage(total, 100)).toEqual(total);
    expect(() => percentage(total, 101)).toThrow(RangeError);
  });

  it("formats for display", () => {
    expect(formatMoney(money(349500, "USD"))).toBe("$3,495.00");
    expect(formatMoney(money(349500, "USD"), { compact: true })).toBe("$3,495");
    expect(formatMoney(money(349550, "USD"), { compact: true })).toBe("$3,495.50");
    expect(formatMoney(money(129900, "EUR"), { locale: "de-DE" })).toMatch(/1\.299,00/);
  });

  it("parses user input into minor units without floating point drift", () => {
    expect(parseMoney("3,495.00", "USD")).toEqual(money(349500, "USD"));
    expect(parseMoney("3495", "USD")).toEqual(money(349500, "USD"));
    expect(parseMoney("$0.10", "USD")).toEqual(money(10, "USD"));
    expect(parseMoney("19.999", "USD")).toEqual(money(1999, "USD")); // truncates extra digits
    expect(() => parseMoney("abc", "USD")).toThrow(TypeError);
  });
});
