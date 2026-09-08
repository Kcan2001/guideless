import "server-only";

import type { NormalizedRate } from "@/lib/hotels/types";
import { bestStoredRate, resolveStayContext, type HotelRateRow } from "./catalog";
import { getHotelSupplier, HotelSupplierError } from "./suppliers";

/**
 * Recheck before money moves (strategy §3 "Recheck"): compare the stored rate a traveler saw with a
 * live quote from the supplier. Callers decide the tolerance; `startCheckout` refuses above 5 %.
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
  const ctx = await resolveStayContext(stayOptionId);
  if (!ctx) return notApplicable();
  const stored = await bestStoredRate(ctx, adults);
  if (!stored) return notApplicable();

  let live: NormalizedRate | null;
  try {
    live = await getHotelSupplier().recheckRate(stored.supplier_rate_id);
  } catch (err) {
    const message =
      err instanceof HotelSupplierError ? `${err.code}: ${err.message}` : "unexpected";
    console.error("hotel recheck failed", { stayOptionId, message });
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
  const deltaPct = stored.total_amount
    ? ((live.totalAmount - stored.total_amount) / stored.total_amount) * 100
    : 0;
  const ok = deltaPct <= tolerance;
  return {
    applicable: true,
    ok,
    reason: ok ? undefined : "price_up",
    storedTotal: stored.total_amount,
    liveTotal: live.totalAmount,
    deltaPct: Math.round(deltaPct * 10) / 10,
    stored,
    live,
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
