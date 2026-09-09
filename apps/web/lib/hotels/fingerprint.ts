import { freeUntilDay } from "./cancellation-policy";
import { normalizeBedType, normalizeText } from "./normalize";
import type { NormalizedRate, RateFingerprint } from "./types";

/**
 * Two rates are the same product only when every dimension a traveler would notice matches.
 * Comparing suppliers within a fingerprint is what stops a non-refundable, room-only rate from
 * "beating" a refundable rate with breakfast (docs/strategy-v3-direction.md §3).
 *
 * Mirrors the DISTINCT ON key in public.suggest_stay_price(): room name, bed type, occupancy,
 * refundable, the day free cancellation ends, breakfast, payment type.
 */
export type RateWithHotel = NormalizedRate & {
  /** Guideless hotel id resolved through hotel_supplier_mappings; lets suppliers share a key. */
  guidelessHotelId?: string;
};

export function rateFingerprint(rate: RateWithHotel): RateFingerprint {
  // Group by the day free cancellation ends, which is the first rung of the ladder.
  const deadlineDay = freeUntilDay(rate.cancellationPolicy);
  return [
    `h:${rate.guidelessHotelId ?? `${rate.supplier}:${rate.supplierHotelId}`}`,
    `r:${normalizeText(rate.roomName)}`,
    `b:${normalizeBedType(rate.bedType) ?? ""}`,
    `o:${rate.occupancy.adults}+${rate.occupancy.children}`,
    `rf:${rate.refundable ? 1 : 0}`,
    `cd:${deadlineDay}`,
    `bf:${rate.breakfastIncluded ? 1 : 0}`,
    `p:${rate.paymentType}`,
  ].join("|");
}

/** Attach the Guideless hotel id so cross-supplier rates for one hotel share a fingerprint. */
export function withGuidelessHotel<T extends NormalizedRate>(
  rate: T,
  guidelessHotelId: string,
): T & { guidelessHotelId: string } {
  return { ...rate, guidelessHotelId };
}
