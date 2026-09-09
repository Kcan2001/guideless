/**
 * What a conversation costs, in the same integer minor units as everything else we count.
 *
 * `ai_usage.cost_micros` is millionths of a dollar rather than cents because a single assistant
 * turn costs a fraction of a cent: in cents, every row would round to zero and the admin screen
 * would show a bill of nothing while the real one grew.
 *
 * Prices are per million tokens, from the published rate card. They are a table rather than a
 * calculation so that a model change is one line, and so that a wrong number is visible in a diff
 * rather than buried in arithmetic.
 */

export interface ModelPricing {
  /** US dollars per million tokens. */
  inputPerMTok: number;
  outputPerMTok: number;
  /** Cached input is billed at a tenth; writing to cache costs a quarter more than input. */
  cacheReadPerMTok: number;
  cacheWritePerMTok: number;
}

export const PRICING: Record<string, ModelPricing> = {
  "claude-opus-5": {
    inputPerMTok: 5,
    outputPerMTok: 25,
    cacheReadPerMTok: 0.5,
    cacheWritePerMTok: 6.25,
  },
  "claude-sonnet-5": {
    inputPerMTok: 2,
    outputPerMTok: 10,
    cacheReadPerMTok: 0.2,
    cacheWritePerMTok: 2.5,
  },
  "claude-haiku-4-5": {
    inputPerMTok: 1,
    outputPerMTok: 5,
    cacheReadPerMTok: 0.1,
    cacheWritePerMTok: 1.25,
  },
};

/** An unknown model is priced as the most expensive one we know: never under-report a bill. */
export function pricingFor(model: string): ModelPricing {
  return PRICING[model] ?? PRICING["claude-opus-5"]!;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

/** Millionths of a dollar, rounded up: a fraction of a micro is still spend. */
export function costMicros(model: string, usage: TokenUsage): number {
  const p = pricingFor(model);
  const dollars =
    (usage.inputTokens / 1_000_000) * p.inputPerMTok +
    (usage.outputTokens / 1_000_000) * p.outputPerMTok +
    ((usage.cacheReadTokens ?? 0) / 1_000_000) * p.cacheReadPerMTok +
    ((usage.cacheWriteTokens ?? 0) / 1_000_000) * p.cacheWritePerMTok;
  return Math.ceil(dollars * 1_000_000);
}

/** For the admin screen. Micros are unreadable; dollars with cents are what a person checks. */
export function formatMicros(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(2)}`;
}
