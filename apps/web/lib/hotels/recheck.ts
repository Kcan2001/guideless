import "server-only";

import type { NormalizedRate } from "@/lib/hotels/types";
import { bestStoredRate, resolveStayContexts, type HotelRateRow } from "./catalog";
import { getHotelSupplier, HotelSupplierError } from "./suppliers";

/**
 * Recheck before money moves (strategy §3 "Recheck"): compare the stored rate a traveler saw with a
 * live quote from the supplier. Callers decide the tolerance; `startCheckout` refuses above 5 %.
 *
 * A tier is every city it stays in, so the comparison is over the SUM of its legs. Checking only
 * the first would pass a tier whose Paris hotel had doubled, which is the whole failure this
 * function exists to prevent.
 */
export interface RecheckResult {
  /** No hotel behind this tier, or no stored rate: nothing to compare, proceed as before. */
  applicable: boolean;
  ok: boolean;
  reason?: "rate_gone" | "supplier_error" | "price_up";
  storedTotal: number | null;
  liveTotal: number | null;
  deltaPct: number | null;
  stored: HotelRateRow | null;
  live: NormalizedRate | null;
}

export async function recheckStayRate(
  stayOptionId: string,
  adults: number,
  opts: { tolerancePct?: number } = {},
): Promise<RecheckResult> {
  const tolerance = opts.tolerancePct ?? 5;
  const legs = await resolveStayContexts(stayOptionId);
  if (legs.length === 0) return notApplicable();

  const storedRates = await Promise.all(legs.map((ctx) => bestStoredRate(ctx, adults)));
  let lastLive: NormalizedRate | null = null;
  if (storedRates.some((r) => !r)) return notApplicable();

  let storedTotal = 0;
  let liveTotal = 0;
  // The first leg that is gone or errored decides the answer, and its rate is what gets reported,
  // so an operator sees the hotel that actually moved rather than a blended number.
  for (let i = 0; i < legs.length; i++) {
    const stored = storedRates[i]!;
    storedTotal += stored.total_amount;

    let live: NormalizedRate | null;
    try {
      live = await getHotelSupplier().recheckRate(stored.supplier_rate_id);
    } catch (err) {
      const message =
        err instanceof HotelSupplierError ? `${err.code}: ${err.message}` : "unexpected";
      console.error("hotel recheck failed", { stayOptionId, leg: legs[i]!.legName, message });
      return {
        applicable: true,
        ok: false,
        reason: "supplier_error",
        storedTotal: stored.total_amount,
        liveTotal: null,
        deltaPct: null,
        stored,
        live: null,
      };
    }
    if (!live || !live.available) {
      return {
        applicable: true,
        ok: false,
        reason: "rate_gone",
        storedTotal: stored.total_amount,
        liveTotal: live?.totalAmount ?? null,
        deltaPct: null,
        stored,
        live,
      };
    }
    liveTotal += live.totalAmount;
    lastLive = live;
  }

  const deltaPct = storedTotal ? ((liveTotal - storedTotal) / storedTotal) * 100 : 0;
  const ok = deltaPct <= tolerance;
  return {
    applicable: true,
    ok,
    reason: ok ? undefined : "price_up",
    storedTotal,
    liveTotal,
    deltaPct: Math.round(deltaPct * 10) / 10,
    // On a multi-city tier these are the last leg, kept so the shape does not change; the totals
    // above are what any caller should act on.
    stored: storedRates[storedRates.length - 1]!,
    live: lastLive,
  };
}

function notApplicable(): RecheckResult {
  return {
    applicable: false,
    ok: true,
    storedTotal: null,
    liveTotal: null,
    deltaPct: null,
    stored: null,
    live: null,
  };
}
