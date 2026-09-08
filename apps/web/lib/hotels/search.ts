import "server-only";

import type { Json, TablesInsert } from "@guideless/types";

import type { NormalizedRate } from "@/lib/hotels/types";
import { asCurrency, asIsoDate } from "@/lib/hotels/normalize";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { resolveStayContext, type StayContext } from "./catalog";
import { getHotelSupplier, getHotelSupplierId, HotelSupplierError } from "./suppliers";

/**
 * Rate refresh: for a stay option (hotel + departure dates) ask the configured supplier for rates
 * at 1 and 2 adults, in parallel with per-call timeouts, and store the normalised results in
 * `hotel_rates`. Stored rates are what staff price from and what `recheck.ts` compares against;
 * they are never trusted at payment time.
 */

export interface SupplierOutcome {
  supplier: string;
  ok: boolean;
  rates: number;
  error?: string;
}
export interface RefreshResult {
  stayOptionId: string;
  hotelId: string | null;
  /** `no_rates`: every supplier answered but had nothing for these dates — usually a wrong mapping. */
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

export async function refreshRatesForStayOption(stayOptionId: string): Promise<RefreshResult> {
  const ctx = await resolveStayContext(stayOptionId);
  if (!ctx) return { stayOptionId, hotelId: null, skipped: "no_hotel", stored: 0, suppliers: [] };

  const supplier = getHotelSupplier();
  const supplierId = getHotelSupplierId();
  const mapping = ctx.mappings.find((m) => m.supplier === supplierId && !m.hotel_room_id);
  const roomMapping = ctx.room
    ? ctx.mappings.find((m) => m.supplier === supplierId && m.hotel_room_id === ctx.room?.id)
    : null;
  if (!mapping && !roomMapping)
    return { stayOptionId, hotelId: ctx.hotel.id, skipped: "no_mapping", stored: 0, suppliers: [] };
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
    // Replace this supplier's snapshot for the stay dates rather than relying on a conflict target.
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
    stayOptionId,
    hotelId: ctx.hotel.id,
    stored: rows.length,
    suppliers: outcomes,
    ...(noRates ? { skipped: "no_rates" as const } : {}),
  };
}

export async function refreshRatesForDeparture(departureId: string): Promise<RefreshResult[]> {
  const sb = createServiceRoleClient();
  const { data } = await sb
    .from("departure_stay_options")
    .select("id")
    .eq("departure_id", departureId)
    .eq("is_active", true)
    .not("hotel_id", "is", null);
  const results: RefreshResult[] = [];
  for (const s of (data ?? []) as Array<{ id: string }>)
    results.push(await refreshRatesForStayOption(s.id));
  return results;
}

/** Every active, hotel-linked stay option on a departure starting within `days` days. */
export async function listStayOptionsToRefresh(days = 400): Promise<string[]> {
  const sb = createServiceRoleClient();
  const horizon = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await sb
    .from("departure_stay_options")
    .select("id, departures!inner(start_date, status)")
    .eq("is_active", true)
    .not("hotel_id", "is", null)
    .gte("departures.start_date", today)
    .lte("departures.start_date", horizon)
    .in("departures.status", ["draft", "open", "guaranteed", "full"]);
  if (error) throw error;
  return ((data ?? []) as Array<{ id: string }>).map((s) => s.id);
}
