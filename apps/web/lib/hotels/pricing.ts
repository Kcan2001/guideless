import type { ISODate } from "@guideless/types";
import type { NormalizedRate, PricedRate, PricingRuleLike } from "./types";

/**
 * Guideless markup on a supplier net rate. Mirrors public.suggest_stay_price() exactly so an admin
 * preview in the browser and the number the database proposes never disagree:
 *
 *   markup = max(min_markup_amount, round(total × percentage / 100) + fixed_markup_amount)
 *
 * Rule selection: a hotel rule beats a destination rule beats a global rule; ties go to the higher
 * priority, then the newest rule. Inactive rules and rules outside their effective window (judged
 * on the check-in date) are ignored. The customer-facing price stays the tier's price_delta;
 * these helpers only propose it.
 */

export interface RuleContext {
  hotelId: string;
  destinationId: string | null;
  /** Check-in date the rule must be effective on. */
  date: ISODate;
}

export function ruleApplies(rule: PricingRuleLike, ctx: RuleContext): boolean {
  if (rule.isActive === false) return false;
  if (rule.hotelId) {
    if (rule.hotelId !== ctx.hotelId) return false;
  } else if (rule.destinationId) {
    if (!ctx.destinationId || rule.destinationId !== ctx.destinationId) return false;
  }
  if (rule.effectiveFrom && rule.effectiveFrom > ctx.date) return false;
  if (rule.effectiveTo && rule.effectiveTo < ctx.date) return false;
  return true;
}

/** 2 = hotel-specific, 1 = destination-wide, 0 = global. */
export function ruleSpecificity(rule: PricingRuleLike): 0 | 1 | 2 {
  if (rule.hotelId) return 2;
  if (rule.destinationId) return 1;
  return 0;
}

export function selectRule<T extends PricingRuleLike & { createdAt?: string }>(
  rules: readonly T[],
  ctx: RuleContext,
): T | null {
  const applicable = rules.filter((r) => ruleApplies(r, ctx));
  if (applicable.length === 0) return null;
  return applicable.reduce((best, r) => {
    const s = ruleSpecificity(r) - ruleSpecificity(best);
    if (s !== 0) return s > 0 ? r : best;
    if (r.priority !== best.priority) return r.priority > best.priority ? r : best;
    return (r.createdAt ?? "") > (best.createdAt ?? "") ? r : best;
  });
}

export function markupFor(totalAmount: number, rule: PricingRuleLike | null): number {
  if (!rule) return 0;
  const percent = Math.round((totalAmount * rule.percentageMarkup) / 100);
  return Math.max(rule.minMarkupAmount, percent + rule.fixedMarkupAmount);
}

export function applyPricingRule<T extends NormalizedRate>(
  rate: T,
  rule: PricingRuleLike | null,
): T & PricedRate {
  const markupAmount = markupFor(rate.totalAmount, rule);
  return {
    ...rate,
    markupAmount,
    customerAmount: rate.totalAmount + markupAmount,
    ruleId: rule?.id,
  };
}

/** Convenience: pick the rule for the rate's context and apply it. */
export function priceRate<T extends NormalizedRate>(
  rate: T,
  rules: readonly PricingRuleLike[],
  ctx: Omit<RuleContext, "date">,
): T & PricedRate {
  return applyPricingRule(rate, selectRule(rules, { ...ctx, date: rate.checkIn }));
}
