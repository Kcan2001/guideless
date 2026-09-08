import type { CancellationTier } from "@guideless/types";

/**
 * What a customer gets back if they cancel today, from the departure's published tiers.
 * Mirrors `refund_percentage_for()` in the database (the authoritative copy runs there when the
 * request is submitted); this one only previews. Pure and unit-tested.
 */
export function refundPercentageFor(policy: CancellationTier[], daysBefore: number): number {
  const d = Math.max(daysBefore, 0);
  const tier = [...policy]
    .filter((t) => t.daysBeforeDeparture <= d)
    .sort((a, b) => b.daysBeforeDeparture - a.daysBeforeDeparture)[0];
  return tier?.refundPercentage ?? 0;
}

export interface RefundPreview {
  daysBefore: number;
  refundPercentage: number;
  /** Minor units the customer has paid toward the base trip and stay (excludes add-ons). */
  basePaid: number;
  /** Minor units refundable on the base trip at today's tier. */
  baseRefund: number;
  addOns: {
    id: string;
    title: string;
    total: number;
    refundable: boolean;
    /** Null when the extra was never refundable after purchase. */
    cancellableUntil: string | null;
  }[];
  addOnsRefund: number;
  totalRefund: number;
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Add-ons refund in full until their own deadline (`cancellable_until_days_before` before the
 * add-on's date, or the trip end when undated); a null deadline means the extra was never
 * refundable after purchase, which is how event tickets work. The base trip follows the tiers on
 * what was paid toward it, which is everything paid minus confirmed add-ons (add-ons are always
 * paid in full).
 */
export function previewRefund(input: {
  todayISO: string;
  startDate: string;
  endDate: string;
  policy: CancellationTier[];
  amountPaid: number;
  addOns: {
    id: string;
    title: string;
    total: number;
    status: string;
    dayNumber: number | null;
    /** Null: non-refundable from purchase, so there is no date at which it can still go back. */
    cancellableUntilDaysBefore: number | null;
  }[];
}): RefundPreview {
  const daysBefore = Math.round(
    (Date.parse(`${input.startDate}T00:00:00Z`) - Date.parse(`${input.todayISO}T00:00:00Z`)) /
      86_400_000,
  );
  const pct = refundPercentageFor(input.policy, daysBefore);
  const confirmed = input.addOns.filter((a) => a.status === "confirmed");
  const addOnsTotal = confirmed.reduce((s, a) => s + a.total, 0);
  const basePaid = Math.max(input.amountPaid - addOnsTotal, 0);
  const baseRefund = Math.round((basePaid * pct) / 100);
  const addOns = confirmed.map((a) => {
    const date = a.dayNumber ? addDaysISO(input.startDate, a.dayNumber - 1) : input.endDate;
    if (a.cancellableUntilDaysBefore === null) {
      return {
        id: a.id,
        title: a.title,
        total: a.total,
        refundable: false,
        cancellableUntil: null,
      };
    }
    const cancellableUntil = addDaysISO(date, -a.cancellableUntilDaysBefore);
    return {
      id: a.id,
      title: a.title,
      total: a.total,
      refundable: input.todayISO <= cancellableUntil,
      cancellableUntil,
    };
  });
  const addOnsRefund = addOns.filter((a) => a.refundable).reduce((s, a) => s + a.total, 0);
  return {
    daysBefore,
    refundPercentage: pct,
    basePaid,
    baseRefund,
    addOns,
    addOnsRefund,
    totalRefund: baseRefund + addOnsRefund,
  };
}
