import "server-only";

import type { Json, TablesInsert } from "@guideless/types";

import type { NormalizedRate } from "@/lib/hotels/types";
import { asCurrency, asIsoDate } from "@/lib/hotels/normalize";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { resolveStayContexts, type StayContext } from "./catalog";
import { getHotelSupplier, getHotelSupplierId, HotelSupplierError } from "./suppliers";

/**
 * Rate refresh: for every leg of a stay option (a hotel and its own nights) ask the configured
 * supplier for rates at 1 and 2 adults, in parallel with per-call timeouts, and store the
 * normalised results in `hotel_rates`. Stored rates are what staff price from and what
 * `recheck.ts` compares against; they are never trusted at payment time.
 *
 * A single-city tier has one leg covering the whole departure, so nothing about Monaco changed
 * when Southern France gained three.
 */

export interface SupplierOutcome {
  supplier: string;
  ok: boolean;
  rates: number;
  error?: string;
}
export interface RefreshResult {
  stayOptionId: string;
  /** Every hotel this tier stays in, in itinerary order. */
  hotelIds: string[];
  /**
   * The worst thing that happened across the legs. `no_rates`: a supplier answered but had nothing
   * for those dates, which is usually a wrong mapping.
   */
  skipped?: "no_hotel" | "no_mapping" | "no_rates";
  stored: number;
  suppliers: SupplierOutcome[];
}

const OCCUPANCIES = [1, 2] as const;

function toRow(
  rate: NormalizedRate,
  ctx: StayContext,
  roomId: string | null,
  fetchedAt: string,
): TablesInsert<"hotel_rates"> {
  return {
    hotel_id: ctx.hotel.id,
    hotel_room_id: roomId,
    supplier: rate.supplier,
    supplier_rate_id: rate.supplierRateId,
    room_name: rate.roomName,
    bed_type: rate.bedType ?? null,
    occupancy_adults: rate.occupancy.adults,
    occupancy_children: rate.occupancy.children,
    check_in: rate.checkIn,
    check_out: rate.checkOut,
    currency: rate.currency,
    net_amount: rate.netAmount,
    taxes_amount: rate.taxesAmount,
    fees_amount: rate.feesAmount,
    total_amount: rate.totalAmount,
    refundable: rate.refundable,
    cancellation_policy: rate.cancellationPolicy as Json,
    breakfast_included: rate.breakfastIncluded,
    payment_type: rate.paymentType,
    supplier_commission_amount: rate.supplierCommissionAmount ?? null,
    available: rate.available,
    fetched_at: fetchedAt,
    expires_at: rate.expiresAt ?? null,
    raw: (rate.raw ?? null) as Json,
  };
}

/** One leg: one hotel, one set of nights. */
async function refreshLeg(ctx: StayContext): Promise<{
  skipped?: "no_mapping" | "no_rates";
  stored: number;
  suppliers: SupplierOutcome[];
}> {
  const supplier = getHotelSupplier();
  const supplierId = getHotelSupplierId();
  const mapping = ctx.mappings.find((m) => m.supplier === supplierId && !m.hotel_room_id);
  const roomMapping = ctx.room
    ? ctx.mappings.find((m) => m.supplier === supplierId && m.hotel_room_id === ctx.room?.id)
    : null;
  if (!mapping && !roomMapping) return { skipped: "no_mapping", stored: 0, suppliers: [] };
  const supplierHotelId = (roomMapping ?? mapping)!.supplier_hotel_id;
  const base = {
    hotelIds: [ctx.hotel.id],
    supplierHotelIds: { [ctx.hotel.id]: supplierHotelId },
    checkIn: asIsoDate(ctx.checkIn),
    checkOut: asIsoDate(ctx.checkOut),
    currency: asCurrency(ctx.currency),
    supplierHotelId,
  };

  const settled = await Promise.allSettled(
    OCCUPANCIES.map((adults) => supplier.getRates({ ...base, adults })),
  );

  const rates: NormalizedRate[] = [];
  const outcomes: SupplierOutcome[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") {
      rates.push(...r.value);
      outcomes.push({ supplier: supplierId, ok: true, rates: r.value.length });
    } else {
      const err = r.reason;
      outcomes.push({
        supplier: supplierId,
        ok: false,
        rates: 0,
        error:
          err instanceof HotelSupplierError ? `${err.code}: ${err.message}` : "unexpected error",
      });
    }
  }

  // When the tier names a room, keep only rates for that room (matched by supplier room id, else name).
  const roomFilter = ctx.room;
  const kept = roomFilter
    ? rates.filter((r) =>
        roomMapping?.supplier_room_id
          ? (r.raw as { supplierRoomId?: string } | undefined)?.supplierRoomId ===
            roomMapping.supplier_room_id
          : r.roomName.toLowerCase() === roomFilter.name.toLowerCase(),
      )
    : rates;
  const fetchedAt = new Date().toISOString();
  const rows = (kept.length ? kept : rates).map((r) =>
    toRow(r, ctx, roomFilter && kept.length ? roomFilter.id : null, fetchedAt),
  );

  if (rows.length) {
    const sb = createServiceRoleClient();
    // Replace this suppliers snapshot for these stay dates rather than relying on a conflict
    // target. Scoped to the leg dates, so refreshing Paris cannot wipe the Nice rates.
    const { error: delErr } = await sb
      .from("hotel_rates")
      .delete()
      .eq("hotel_id", ctx.hotel.id)
      .eq("supplier", supplierId)
      .eq("check_in", ctx.checkIn)
      .eq("check_out", ctx.checkOut);
    if (delErr) throw delErr;
    const { error: insErr } = await sb.from("hotel_rates").insert(rows);
    if (insErr) throw insErr;
  }
  const noRates = rows.length === 0 && outcomes.every((o) => o.ok);
  return {
    stored: rows.length,
    suppliers: outcomes,
    ...(noRates ? { skipped: "no_rates" as const } : {}),
  };
}

export async function refreshRatesForStayOption(stayOptionId: string): Promise<RefreshResult> {
  const legs = await resolveStayContexts(stayOptionId);
  if (legs.length === 0)
    return { stayOptionId, hotelIds: [], skipped: "no_hotel", stored: 0, suppliers: [] };

  // Legs are separate hotels, so they can run together.
  const perLeg = await Promise.all(legs.map((ctx) => refreshLeg(ctx)));
  const stored = perLeg.reduce((n, r) => n + r.stored, 0);
  const suppliers = perLeg.flatMap((r) => r.suppliers);
  // Report the worst outcome across the legs: a tier is only priceable when every city has a rate.
  const skipped =
    perLeg.find((r) => r.skipped === "no_mapping")?.skipped ??
    perLeg.find((r) => r.skipped === "no_rates")?.skipped;
  return {
    stayOptionId,
    hotelIds: legs.map((l) => l.hotel.id),
    stored,
    suppliers,
    ...(skipped ? { skipped } : {}),
  };
}

export async function refreshRatesForDeparture(departureId: string): Promise<RefreshResult[]> {
  const sb = createServiceRoleClient();
  // No `hotel_id is not null` filter any more: a multi-city tier links its hotels through legs,
  // and `resolveStayContexts` returns nothing for a tier with neither, which reports as `no_hotel`.
  const { data } = await sb
    .from("departure_stay_options")
    .select("id")
    .eq("departure_id", departureId)
    .eq("is_active", true);
  const results: RefreshResult[] = [];
  for (const s of (data ?? []) as Array<{ id: string }>)
    results.push(await refreshRatesForStayOption(s.id));
  return results;
}

/** Every active stay option on a departure starting within `days` days. */
export async function listStayOptionsToRefresh(days = 400): Promise<string[]> {
  const sb = createServiceRoleClient();
  const horizon = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await sb
    .from("departure_stay_options")
    .select("id, departures!inner(start_date, status)")
    .eq("is_active", true)
    .gte("departures.start_date", today)
    .lte("departures.start_date", horizon)
    .in("departures.status", ["draft", "open", "guaranteed", "full"]);
  if (error) throw error;
  return ((data ?? []) as Array<{ id: string }>).map((s) => s.id);
}

/**
 * Refresh the supplier rates behind one departure's stay tiers, but only the stale ones.
 *
 * Called when a traveler opens the Trip Builder, so the cost data behind the tiers they are about
 * to choose between is current rather than up to six hours old from the last cron run.
 *
 * Three things this deliberately is not:
 *
 * 1. **Not a re-price.** What a traveler sees is `departure_stay_options.price_delta_amount`, set
 *    by staff from researched cost. Nothing here changes it. Prices must not move under someone
 *    mid-session, and the real safety net is already downstream: `startCheckout` re-checks the rate
 *    before any seat hold and refuses a move over 5%. This keeps our *cost* picture fresh so that
 *    drift is visible before it becomes a loss, which is exactly the failure that put a $19,626
 *    room on sale for $4,450.
 *
 * 2. **Not on every page view.** LiteAPI, like every bedbank, cares about look-to-book ratio, and a
 *    builder page can be reloaded a dozen times in a session. A tier is only refetched when its
 *    freshest stored rate is older than `maxAgeMinutes`, so a busy departure costs one round of
 *    calls per window however many people are looking at it.
 *
 * 3. **Not blocking.** The caller runs this inside `after()`, so a slow or down supplier delays
 *    nobody's page. Every failure is swallowed and reported in the result rather than thrown.
 */
export async function refreshStaleRatesForDeparture(
  departureId: string,
  { maxAgeMinutes = 30 }: { maxAgeMinutes?: number } = {},
): Promise<{ checked: number; refreshed: number; skipped: number; results: RefreshResult[] }> {
  const sb = createServiceRoleClient();
  const { data: options, error } = await sb
    .from("departure_stay_options")
    .select("id")
    .eq("departure_id", departureId)
    .eq("is_active", true);
  if (error || !options?.length) return { checked: 0, refreshed: 0, skipped: 0, results: [] };

  const cutoff = new Date(Date.now() - maxAgeMinutes * 60_000).toISOString();

  // One freshness probe per leg, scoped to that leg dates. A tier is stale if ANY of its cities is
  // stale; a tier with no hotels at all is never stale, because there is nothing to fetch.
  const staleness = await Promise.all(
    options.map(async (o) => {
      const legs = await resolveStayContexts(o.id);
      if (legs.length === 0) return { id: o.id, linked: false, stale: false };
      const fetched = await Promise.all(
        legs.map(async (ctx) => {
          const { data } = await sb
            .from("hotel_rates")
            .select("fetched_at")
            .eq("hotel_id", ctx.hotel.id)
            .eq("check_in", ctx.checkIn)
            .eq("check_out", ctx.checkOut)
            .order("fetched_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          return data?.fetched_at ?? null;
        }),
      );
      return { id: o.id, linked: true, stale: fetched.some((f) => !f || f < cutoff) };
    }),
  );
  const linked = staleness.filter((s) => s.linked);

  const stale = staleness.filter((s) => s.stale);
  const results = await Promise.all(
    stale.map(async (s) => {
      try {
        return await refreshRatesForStayOption(s.id);
      } catch (err) {
        return {
          stayOptionId: s.id,
          hotelIds: [],
          stored: 0,
          suppliers: [
            {
              supplier: getHotelSupplierId(),
              ok: false,
              rates: 0,
              error: err instanceof Error ? err.message : "unexpected error",
            },
          ],
        } satisfies RefreshResult;
      }
    }),
  );

  return {
    checked: linked.length,
    refreshed: results.filter((r) => r.stored > 0).length,
    skipped: linked.length - stale.length,
    results,
  };
}
