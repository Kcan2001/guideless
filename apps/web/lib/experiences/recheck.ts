/**
 * Deciding what to do when a supplier's price has moved between the quote and the charge.
 *
 * Pure, and separate from the code that talks to a supplier, because this is a commercial policy
 * rather than an integration detail — and because the hotel engine learned that the interesting
 * cases (a rate that drifts, a rate that vanishes) are exactly the ones nobody exercises by hand.
 *
 * The rule in one line: we absorb small moves and stop for large ones. A traveler who is one click
 * from paying should not have the number change under them over a few cents of supplier drift; a
 * move big enough to sell at a loss is not something to swallow quietly either.
 */

export interface RecheckInput {
  /** What the customer is being charged, in integer minor units. */
  customerAmount: number;
  /** What it cost us when the add-on was created. */
  originalNetAmount: number;
  /** What the supplier says now. Null means the option is gone. */
  currentNetAmount: number | null;
  available: boolean;
}

export type RecheckDecision =
  | { action: "proceed"; driftAmount: number }
  | { action: "proceed_with_margin_warning"; driftAmount: number; marginAmount: number }
  | { action: "block"; reason: "withdrawn" | "sold_out" | "margin_lost"; driftAmount: number };

/**
 * How much the supplier price may rise before it stops being our problem to absorb: the larger of
 * 5 % of the original cost, or the point where our margin would go negative. Below that we sell at
 * the advertised price and take the hit, because the alternative is re-pricing somebody mid-checkout.
 */
export const ABSORB_FRACTION = 0.05;

export function decideRecheck(input: RecheckInput): RecheckDecision {
  const { customerAmount, originalNetAmount, currentNetAmount, available } = input;

  if (currentNetAmount === null) {
    return { action: "block", reason: "withdrawn", driftAmount: 0 };
  }
  if (!available) {
    return {
      action: "block",
      reason: "sold_out",
      driftAmount: currentNetAmount - originalNetAmount,
    };
  }

  const driftAmount = currentNetAmount - originalNetAmount;
  const marginAmount = customerAmount - currentNetAmount;

  // Selling below cost is never automatic. Staff can decide to; a checkout cannot decide for them.
  if (marginAmount < 0) {
    return { action: "block", reason: "margin_lost", driftAmount };
  }

  // A price that fell, or barely moved, is not worth telling anyone about.
  const absorbable = Math.max(1, Math.round(originalNetAmount * ABSORB_FRACTION));
  if (driftAmount <= absorbable) {
    return { action: "proceed", driftAmount };
  }

  // Above the threshold but still profitable: the sale goes through at the price the traveler was
  // shown, and the drift is recorded so somebody can re-price the add-on for the next person.
  return { action: "proceed_with_margin_warning", driftAmount, marginAmount };
}

/** What a traveler is told when a recheck blocks. Never mentions cost, margin, or a supplier. */
export function blockedMessage(
  reason: Extract<RecheckDecision, { action: "block" }>["reason"],
): string {
  switch (reason) {
    case "withdrawn":
      return "That extra isn't available any more. Nothing has been charged — the rest of your booking is untouched.";
    case "sold_out":
      return "That one just sold out. Nothing has been charged; we'll take it off the list.";
    default:
      // "Our margin went negative" is our problem and not a sentence to put in front of a customer.
      return "We can't sell that extra right now. Nothing has been charged — please ask us and we'll sort it out.";
  }
}
