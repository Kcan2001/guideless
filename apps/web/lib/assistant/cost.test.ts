import { describe, expect, it } from "vitest";
import { costMicros, formatMicros, pricingFor } from "@/lib/assistant/cost";

/**
 * Money, so it gets the same treatment as every other amount in this codebase: integers, no
 * floats reaching the database, and never rounded in our favour.
 */

describe("pricing", () => {
  it("knows the model we actually run", () => {
    expect(pricingFor("claude-opus-5").inputPerMTok).toBe(5);
  });

  // Under-reporting a bill is the failure that matters: it is invisible until it isn't.
  it("prices an unknown model as the most expensive one it knows", () => {
    expect(pricingFor("claude-something-new")).toEqual(pricingFor("claude-opus-5"));
  });
});

describe("cost in micros", () => {
  it("charges input and output at their own rates", () => {
    // 1M input at $5 plus 1M output at $25 = $30 = 30,000,000 micros.
    expect(costMicros("claude-opus-5", { inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBe(
      30_000_000,
    );
  });

  it("prices a realistic turn at a fraction of a cent", () => {
    const micros = costMicros("claude-opus-5", { inputTokens: 3000, outputTokens: 250 });
    expect(micros).toBe(21_250);
    // The reason the column is micros and not cents: this is two cents, and in cents-with-rounding
    // a cheaper turn would be recorded as free.
    expect(micros / 1_000_000).toBeLessThan(0.03);
  });

  it("rounds up, because a fraction of a micro is still spend", () => {
    // One input token at $5/MTok is exactly 5 micros; a third of a token would round to 1, not 0.
    expect(costMicros("claude-opus-5", { inputTokens: 1, outputTokens: 0 })).toBe(5);
    expect(costMicros("claude-haiku-4-5", { inputTokens: 1, outputTokens: 0 })).toBe(1);
  });

  it("bills a cached read at a tenth of the input rate", () => {
    const cached = costMicros("claude-opus-5", {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 1_000_000,
    });
    expect(cached).toBe(500_000);
  });

  it("counts nothing as nothing", () => {
    expect(costMicros("claude-opus-5", { inputTokens: 0, outputTokens: 0 })).toBe(0);
  });
});

describe("formatting for staff", () => {
  it("shows dollars and cents, not micros", () => {
    expect(formatMicros(1_234_567)).toBe("$1.23");
    expect(formatMicros(0)).toBe("$0.00");
  });
});
