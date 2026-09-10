import "server-only";

import type { TablesInsert } from "@guideless/types";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { bestStoredRate, resolveStayContext } from "./catalog";
import { refreshStaleRatesForDeparture } from "./search";
import { getHotelSupplierId } from "./suppliers";

/**
 * Re-derive stay-tier prices from live supplier rates when a traveler opens the Trip Builder.
 *
 * THE RULE THIS IMPLEMENTS
 * The tour page shows the price as of the last refresh and says so. The builder shows the real
 * current price. Checkout re-verifies once more before taking money. That is three honest numbers
 * at three moments, not one number pretending to be permanent — and it is the difference between
 * "the price moved under me" and "we checked, and here is what it actually costs today".
 *
 * The arithmetic is the one recorded on the tier itself (migration 20260910000600):
 *
 *     price = (room cost for the stay + fixed_cost_amount) * cost_multiple
 *
 * The cheapest tier carries the base price on the departure and everything else is a delta from
 * it, so the base is computed first and the deltas are computed against the base that results.
 *
 * GUARDRAILS, because this writes prices
 *   - Opt-in per tier (`auto_price`), and refuses without a `cost_multiple`.
 *   - A tier with no available rate keeps its existing price. Silence is never treated as free.
 *   - A move beyond `AUDIT_THRESHOLD` is still applied — the supplier is right and we are not —
 *     but it is written to `audit_logs` so a 6x race-week jump is something staff see rather than
 *     something a traveler discovers.
 *   - Prices are rounded to whole units of currency, never fractions of a cent.
 *   - **It refuses to run on the mock supplier.** `getHotelSupplier()` defaults to `mock` and
 *     falls back to it whenever a key is missing, so an unset `HOTEL_SUPPLIER` or a revoked
 *     `LITEAPI_KEY` in production would otherwise rewrite the whole catalogue from invented rates.
 *     That is the same failure as the one this system exists to prevent, one level up, and it is
 *     the single most dangerous line in this file. Do not remove the check.
 */

/** Relative move that is worth telling staff about. Race week legitimately clears this. */
const AUDIT_THRESHOLD = 0.15;

/**
 * Sanity band on the ROOM COST, not the price. Outside this the new rate is refused and logged.
 *
 * The recorded `priced_room_amount` is already the race-week figure, so a genuine week-to-week
 * move against it is small; a rate two and a half times higher, or well under half, is far more
 * likely a supplier returning a different room, a different date, or nonsense. Refusing is the
 * safe direction: the tier keeps its last verified price and a human is told.
 */
const SANE_MIN = 0.4;
const SANE_MAX = 2.5;

export interface RepricedTier {
  stayOptionId: string;
  tier: string | null;
  name: string;
  /** Room cost the new price came from, minor units. */
  roomAmount: number;
  previousAmount: number;
  newAmount: number;
  /** For the default tier this is the departure base; otherwise the delta from it. */
  isBase: boolean;
  changed: boolean;
}

export interface RepriceResult {
  departureId: string;
  repriced: RepricedTier[];
  /** Tiers that opted in but had no usable rate, so kept their existing price. */
  unpriced: string[];
}

const round = (n: number) => Math.round(n / 100) * 100;

/**
 * Refresh rates for a departure and re-derive every opted-in tier's price from them.
 *
 * Called on builder entry and awaited, because the point is that the traveler sees the verified
 * number rather than yesterday's. Callers should bound it with a timeout and fall back to stored
 * prices: a supplier outage must not stop somebody booking.
 */
export async function repriceDepartureFromLiveRates(
  departureId: string,
  { maxAgeMinutes = 30 }: { maxAgeMinutes?: number } = {},
): Promise<RepriceResult> {
  // A real supplier or nothing. The mock returns deterministic invented rates, and writing prices
  // from those would be worse than never repricing at all.
  const supplierId = getHotelSupplierId();
  if (supplierId === "manual") {
    return { departureId, repriced: [], unpriced: ["mock supplier: repricing skipped"] };
  }

  const sb = createServiceRoleClient();

  // Fresh rates first. This is throttled on `fetched_at`, so a departure being looked at by twenty
  // people in an hour costs one round of supplier calls, not twenty.
  await refreshStaleRatesForDeparture(departureId, { maxAgeMinutes });

  const { data: options } = await sb
    .from("departure_stay_options")
    .select(
      "id, name, tier, position, is_default, auto_price, cost_multiple, fixed_cost_amount, price_delta_amount, priced_room_amount, hotel_id, details",
    )
    .eq("departure_id", departureId)
    .eq("is_active", true)
    .eq("auto_price", true)
    .not("hotel_id", "is", null)
    .order("position");

  const result: RepriceResult = { departureId, repriced: [], unpriced: [] };
  if (!options?.length) return result;

  const { data: departure } = await sb
    .from("departures")
    .select("price_amount")
    .eq("id", departureId)
    .maybeSingle();
  if (!departure) return result;

  // One room cost per tier, at single occupancy: the base price is per traveler in their own room,
  // and the shared-room discount is applied separately from the same room cost.
  const costs = new Map<string, number>();
  await Promise.all(
    options.map(async (o) => {
      const ctx = await resolveStayContext(o.id);
      if (!ctx) return;
      // Price the room we actually sell. A tier that says "Breakfast: Included" must not be costed
      // from a room-only rate — that is a hole the size of the breakfast, and it was live.
      const requireBreakfast = /^included/i.test(
        String((o.details as { breakfast?: string } | null)?.breakfast ?? ""),
      );
      const rate = await bestStoredRate(ctx, 1, { requireBreakfast });
      if (rate?.total_amount == null) return;
      costs.set(o.id, rate.total_amount);
    }),
  );

  const priceFor = (o: (typeof options)[number]) => {
    const room = costs.get(o.id);
    if (room == null || o.cost_multiple == null) return null;
    return round((room + o.fixed_cost_amount) * Number(o.cost_multiple));
  };

  // The default tier sets the base everything else is measured from.
  const base = options.find((o) => o.is_default) ?? null;
  const newBase = base ? priceFor(base) : null;
  const effectiveBase = newBase ?? departure.price_amount;

  const writes: Array<PromiseLike<unknown>> = [];
  const audits: TablesInsert<"audit_logs">[] = [];

  for (const o of options) {
    const room = costs.get(o.id);
    const target = priceFor(o);
    if (room == null || target == null) {
      result.unpriced.push(o.name);
      continue;
    }
    // A rate far outside the band we last verified is treated as a data problem, not a price move.
    if (o.priced_room_amount && o.priced_room_amount > 0) {
      const ratio = room / o.priced_room_amount;
      if (ratio < SANE_MIN || ratio > SANE_MAX) {
        result.unpriced.push(`${o.name} (rate outside sanity band: ${ratio.toFixed(2)}x)`);
        audits.push({
          action: "supplier_changed",
          entity_type: "departure_stay_option",
          entity_id: o.id,
          metadata: {
            reason: "live_reprice_rejected_out_of_band",
            departure_id: departureId,
            tier: o.tier,
            room_amount: room,
            previous_room_amount: o.priced_room_amount,
            ratio: Number(ratio.toFixed(3)),
          },
        });
        continue;
      }
    }
    const isBase = !!o.is_default;
    const previous = isBase ? departure.price_amount : o.price_delta_amount;
    const next = isBase ? target : Math.max(target - effectiveBase, 0);
    const changed = next !== previous;

    result.repriced.push({
      stayOptionId: o.id,
      tier: o.tier,
      name: o.name,
      roomAmount: room,
      previousAmount: previous,
      newAmount: next,
      isBase,
      changed,
    });

    if (!changed) {
      // Still record that we checked, so "priced from a live rate on …" stays truthful.
      writes.push(
        sb
          .from("departure_stay_options")
          .update({ priced_room_amount: room, priced_at: new Date().toISOString() })
          .eq("id", o.id),
      );
      continue;
    }

    if (isBase) {
      writes.push(sb.from("departures").update({ price_amount: next }).eq("id", departureId));
    }
    writes.push(
      sb
        .from("departure_stay_options")
        .update({
          ...(isBase ? {} : { price_delta_amount: next }),
          priced_room_amount: room,
          priced_at: new Date().toISOString(),
        })
        .eq("id", o.id),
    );

    const move = previous > 0 ? Math.abs(next - previous) / previous : 1;
    if (move >= AUDIT_THRESHOLD) {
      audits.push({
        action: "supplier_changed",
        entity_type: "departure_stay_option",
        entity_id: o.id,
        metadata: {
          reason: "live_reprice",
          departure_id: departureId,
          tier: o.tier,
          room_amount: room,
          previous_room_amount: o.priced_room_amount,
          previous_amount: previous,
          new_amount: next,
          move_percent: Math.round(move * 100),
        },
      });
    }
  }

  await Promise.allSettled(writes);
  if (audits.length) await sb.from("audit_logs").insert(audits);
  return result;
}
