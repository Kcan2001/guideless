import { rateFingerprint, type RateWithHotel } from "./fingerprint";
import type { HotelSupplierId, PricedRate, RateFingerprint } from "./types";

/**
 * Rate comparison (docs/strategy-v3-direction.md §3): group equivalent products, find the best
 * supplier per product, and score offers on more than price. Pure functions over normalized rates.
 */

export function groupByFingerprint<T extends RateWithHotel>(
  rates: readonly T[],
): Map<RateFingerprint, T[]> {
  const groups = new Map<RateFingerprint, T[]>();
  for (const rate of rates) {
    if (!rate.available) continue;
    const key = rateFingerprint(rate);
    const bucket = groups.get(key);
    if (bucket) bucket.push(rate);
    else groups.set(key, [rate]);
  }
  return groups;
}

/** Within each equivalent product, the supplier with the lowest total cost to Guideless. */
export function bestBySupplier<T extends RateWithHotel>(rates: readonly T[]): T[] {
  const out: T[] = [];
  for (const bucket of groupByFingerprint(rates).values()) {
    out.push(bucket.reduce((best, r) => (r.totalAmount < best.totalAmount ? r : best)));
  }
  return out.sort((a, b) => a.totalAmount - b.totalAmount);
}

export interface ScoreWeights {
  /** Points per 1% the rate is cheaper than the most expensive candidate (0–100 range). */
  price: number;
  /** Flat bonus for free cancellation. */
  refundable: number;
  /** Flat bonus for breakfast. */
  breakfast: number;
  /** Bonus scaled by supplier reliability 0–1. */
  reliability: number;
  /** Points per 1% margin when the rate carries a markup (PricedRate). */
  margin: number;
  /** Reliability per supplier, 0–1. Manual contracts are the most reliable by definition. */
  supplierReliability: Record<HotelSupplierId, number>;
}

/**
 * Defaults: price still dominates (a 10% cheaper rate earns 10 points), but free cancellation is
 * worth about a 12% price difference and breakfast about 6% — the trade-offs Guideless makes on a
 * traveler's behalf. Reliability defaults reflect maturity of each integration, not a judgement of
 * the supplier; adjust as booking failure data arrives.
 */
export const DEFAULT_WEIGHTS: ScoreWeights = {
  price: 1,
  refundable: 12,
  breakfast: 6,
  reliability: 5,
  margin: 0.5,
  supplierReliability: { manual: 1, duffel: 0.9, expedia: 0.85, hotelbeds: 0.75 },
};

/**
 * Score one rate against the candidates it competes with. Higher is better. `candidates` sets the
 * price range; a rate scored alone gets the full price points.
 */
export function scoreRate(
  rate: RateWithHotel | PricedRate,
  candidates: readonly RateWithHotel[],
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): number {
  const max = Math.max(rate.totalAmount, ...candidates.map((c) => c.totalAmount));
  const priceScore = max > 0 ? ((max - rate.totalAmount) / max) * 100 * weights.price : 0;
  const refundScore = rate.refundable ? weights.refundable : 0;
  const breakfastScore = rate.breakfastIncluded ? weights.breakfast : 0;
  const reliabilityScore =
    (weights.supplierReliability[rate.supplier] ?? 0.5) * weights.reliability;
  const marginScore =
    "markupAmount" in rate && rate.customerAmount > 0
      ? (rate.markupAmount / rate.customerAmount) * 100 * weights.margin
      : 0;
  return round2(priceScore + refundScore + breakfastScore + reliabilityScore + marginScore);
}

export interface Offer<T extends RateWithHotel> {
  rate: T;
  score: number;
  fingerprint: RateFingerprint;
  /** Other suppliers' rates for the same product, cheapest first. */
  alternatives: T[];
}

/**
 * The offer Guideless would put in front of a traveler for one hotel and stay: the best supplier
 * per product is chosen on cost, then products are ranked on the weighted score, so a slightly
 * dearer refundable rate with breakfast can win over the cheapest non-refundable one.
 */
export function pickOffer<T extends RateWithHotel>(
  rates: readonly T[],
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): Offer<T> | null {
  const groups = groupByFingerprint(rates);
  if (groups.size === 0) return null;
  const winners: Offer<T>[] = [];
  const all = [...groups.values()].flat();
  for (const [fingerprint, bucket] of groups) {
    const sorted = [...bucket].sort((a, b) => a.totalAmount - b.totalAmount);
    const rate = sorted[0];
    if (!rate) continue;
    winners.push({
      rate,
      fingerprint,
      score: scoreRate(rate, all, weights),
      alternatives: sorted.slice(1),
    });
  }
  winners.sort((a, b) => b.score - a.score || a.rate.totalAmount - b.rate.totalAmount);
  return winners[0] ?? null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
