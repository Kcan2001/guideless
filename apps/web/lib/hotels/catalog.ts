import "server-only";

import type { Tables } from "@guideless/types";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Curated hotel catalog (strategy §3, "Guideless Hotel Catalog before the suppliers").
 * Staff read models run as the signed-in staff user (RLS); rate writes use the service role.
 */

/** Row shapes come from the generated database types (migration 20260906004400_hotels.sql). */
export type HotelRow = Tables<"hotels">;
export type HotelRoomRow = Tables<"hotel_rooms">;
export type HotelSupplierMappingRow = Tables<"hotel_supplier_mappings">;
export type HotelRateRow = Tables<"hotel_rates">;
export type PricingRuleRow = Tables<"pricing_rules">;
export type HotelBookingRow = Tables<"hotel_bookings">;

// ── Read models (staff, RLS) ─────────────────────────────────────────────────
export interface HotelListRow extends HotelRow {
  destination_name: string | null;
  mappings: HotelSupplierMappingRow[];
  stay_option_count: number;
  last_rate_fetched_at: string | null;
}

export async function listHotelsAdmin(): Promise<HotelListRow[]> {
  const sb = await createClient();
  const [
    { data: hotels, error },
    { data: destinations },
    { data: mappings },
    { data: stays },
    { data: latest },
  ] = await Promise.all([
    sb.from("hotels").select("*").order("name"),
    sb.from("destinations").select("id, name"),
    sb.from("hotel_supplier_mappings").select("*"),
    sb.from("departure_stay_options").select("id, hotel_id").not("hotel_id", "is", null),
    sb.from("hotel_rates").select("hotel_id, fetched_at").order("fetched_at", { ascending: false }),
  ]);
  if (error) throw error;
  const destName = new Map<string, string>(
    ((destinations ?? []) as Array<{ id: string; name: string }>).map((d) => [d.id, d.name]),
  );
  const lastFetched = new Map<string, string>();
  for (const r of (latest ?? []) as Array<{ hotel_id: string; fetched_at: string }>)
    if (!lastFetched.has(r.hotel_id)) lastFetched.set(r.hotel_id, r.fetched_at);
  const stayCount = new Map<string, number>();
  for (const s of (stays ?? []) as Array<{ hotel_id: string }>)
    stayCount.set(s.hotel_id, (stayCount.get(s.hotel_id) ?? 0) + 1);
  return ((hotels ?? []) as HotelRow[]).map((h) => ({
    ...h,
    destination_name: h.destination_id ? (destName.get(h.destination_id) ?? null) : null,
    mappings: ((mappings ?? []) as HotelSupplierMappingRow[]).filter((m) => m.hotel_id === h.id),
    stay_option_count: stayCount.get(h.id) ?? 0,
    last_rate_fetched_at: lastFetched.get(h.id) ?? null,
  }));
}

export interface LinkedStayOption {
  id: string;
  name: string;
  tier: string | null;
  price_delta_amount: number;
  hotel_room_id: string | null;
  departure_id: string;
  departure_start: string;
  departure_end: string;
  departure_currency: string;
  tour_name: string;
}

export async function getHotelAdmin(id: string) {
  const sb = await createClient();
  const [
    { data: hotel, error },
    { data: rooms },
    { data: mappings },
    { data: rates },
    { data: stays },
    { data: destinations },
  ] = await Promise.all([
    sb.from("hotels").select("*").eq("id", id).maybeSingle(),
    sb.from("hotel_rooms").select("*").eq("hotel_id", id).order("position"),
    sb.from("hotel_supplier_mappings").select("*").eq("hotel_id", id).order("supplier"),
    sb
      .from("hotel_rates")
      .select("*")
      .eq("hotel_id", id)
      .order("check_in")
      .order("total_amount")
      .limit(200),
    sb
      .from("departure_stay_options")
      .select(
        "id, name, tier, price_delta_amount, hotel_room_id, departure_id, departures!inner(start_date, end_date, currency, tours!inner(name))",
      )
      .eq("hotel_id", id),
    sb.from("destinations").select("id, name").order("name"),
  ]);
  if (error) throw error;
  if (!hotel) return null;
  const linked: LinkedStayOption[] = ((stays ?? []) as Array<Record<string, unknown>>).map((s) => {
    const dep = s.departures as {
      start_date: string;
      end_date: string;
      currency: string;
      tours: { name: string };
    };
    return {
      id: s.id as string,
      name: s.name as string,
      tier: (s.tier as string | null) ?? null,
      price_delta_amount: s.price_delta_amount as number,
      hotel_room_id: (s.hotel_room_id as string | null) ?? null,
      departure_id: s.departure_id as string,
      departure_start: dep.start_date,
      departure_end: dep.end_date,
      departure_currency: dep.currency,
      tour_name: dep.tours.name,
    };
  });
  return {
    hotel: hotel as HotelRow,
    rooms: (rooms ?? []) as HotelRoomRow[],
    mappings: (mappings ?? []) as HotelSupplierMappingRow[],
    rates: (rates ?? []) as HotelRateRow[],
    stayOptions: linked,
    destinations: (destinations ?? []) as Array<{ id: string; name: string }>,
  };
}

/** For selects on the stay-option form: every active hotel with its rooms. */
export async function listHotelsForSelect(): Promise<
  Array<{
    id: string;
    name: string;
    city: string | null;
    rooms: Array<{ id: string; name: string }>;
  }>
> {
  const sb = await createClient();
  const [{ data: hotels }, { data: rooms }] = await Promise.all([
    sb.from("hotels").select("id, name, city").eq("is_active", true).order("name"),
    sb.from("hotel_rooms").select("id, hotel_id, name").order("position"),
  ]);
  return ((hotels ?? []) as Array<{ id: string; name: string; city: string | null }>).map((h) => ({
    ...h,
    rooms: ((rooms ?? []) as Array<{ id: string; hotel_id: string; name: string }>)
      .filter((r) => r.hotel_id === h.id)
      .map((r) => ({ id: r.id, name: r.name })),
  }));
}

export async function listPricingRulesAdmin() {
  const sb = await createClient();
  const [{ data: rules, error }, { data: destinations }, { data: hotels }] = await Promise.all([
    sb.from("pricing_rules").select("*").order("priority", { ascending: false }),
    sb.from("destinations").select("id, name").order("name"),
    sb.from("hotels").select("id, name").order("name"),
  ]);
  if (error) throw error;
  return {
    rules: (rules ?? []) as PricingRuleRow[],
    destinations: (destinations ?? []) as Array<{ id: string; name: string }>,
    hotels: (hotels ?? []) as Array<{ id: string; name: string }>,
  };
}

/**
 * Staff pricing suggestion for a hotel stay: `suggest_stay_price` applies the best matching pricing
 * rule to the stored rates. Returns null when the RPC is unavailable or has nothing to say.
 */
export interface StayPriceSuggestion {
  rule_id: string | null;
  /** Keys mirror the jsonb built by public.suggest_stay_price(); amounts are minor units. */
  rates: Array<{
    rate_id: string;
    room_name: string | null;
    bed_type: string | null;
    supplier: string;
    refundable: boolean;
    breakfast_included: boolean;
    payment_type: "pay_now" | "pay_at_property";
    net_total: number;
    markup: number;
    customer_total: number;
    currency: string;
    expires_at: string | null;
  }>;
}
export async function suggestStayPrice(input: {
  hotelId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
}): Promise<StayPriceSuggestion | null> {
  const sb = await createClient();
  const { data, error } = await sb.rpc("suggest_stay_price", {
    p_hotel_id: input.hotelId,
    p_check_in: input.checkIn,
    p_check_out: input.checkOut,
    p_adults: input.adults,
  });
  if (error) {
    console.error("suggest_stay_price failed", { code: error.code, message: error.message });
    return null;
  }
  return (data as StayPriceSuggestion | null) ?? null;
}

// ── Resolution helpers used by the services (service role) ───────────────────
export interface StayContext {
  stayOptionId: string;
  hotel: HotelRow;
  room: HotelRoomRow | null;
  mappings: HotelSupplierMappingRow[];
  checkIn: string;
  checkOut: string;
  currency: string;
  departureId: string;
  /** 1-based position of this city in the itinerary. 1 for a single-city tier. */
  legPosition: number;
  /** The city as the itinerary names it, or null on a single-city tier. */
  legName: string | null;
}

/**
 * Every hotel stay behind a tier, in itinerary order.
 *
 * A tier is a list of legs, not a hotel: Southern France is three nights in Nice, two in Avignon
 * and three in Paris, and each has its own property and its own dates. A tier with no legs is a
 * single-city tier, and its anchor `hotel_id` covers the whole departure — that is the Monaco
 * shape and it returns exactly one context, so callers have one code path rather than two.
 *
 * Empty when no hotel is linked at all.
 */
export async function resolveStayContexts(stayOptionId: string): Promise<StayContext[]> {
  const sb = createServiceRoleClient();
  const [{ data: stay }, { data: legs }] = await Promise.all([
    sb
      .from("departure_stay_options")
      .select("id, hotel_id, hotel_room_id, departure_id")
      .eq("id", stayOptionId)
      .maybeSingle(),
    sb
      .from("departure_stay_legs")
      .select("hotel_id, hotel_room_id, position, check_in, check_out, destinations(name)")
      .eq("stay_option_id", stayOptionId)
      .order("position"),
  ]);
  if (!stay) return [];

  const { data: departure } = await sb
    .from("departures")
    .select("start_date, end_date, currency")
    .eq("id", stay.departure_id)
    .maybeSingle();
  if (!departure) return [];

  type LegSpec = {
    hotelId: string;
    roomId: string | null;
    position: number;
    legName: string | null;
    checkIn: string;
    checkOut: string;
  };
  const specs: LegSpec[] = (legs ?? []).length
    ? (legs ?? []).map((l) => ({
        hotelId: l.hotel_id as string,
        roomId: (l.hotel_room_id as string | null) ?? null,
        position: l.position as number,
        legName:
          (l.destinations as { name: string } | { name: string }[] | null) == null
            ? null
            : Array.isArray(l.destinations)
              ? ((l.destinations[0]?.name as string | undefined) ?? null)
              : ((l.destinations as { name: string }).name ?? null),
        checkIn: l.check_in as string,
        checkOut: l.check_out as string,
      }))
    : stay.hotel_id
      ? [
          {
            hotelId: stay.hotel_id as string,
            roomId: (stay.hotel_room_id as string | null) ?? null,
            position: 1,
            legName: null,
            checkIn: departure.start_date as string,
            checkOut: departure.end_date as string,
          },
        ]
      : [];
  if (specs.length === 0) return [];

  const hotelIds = [...new Set(specs.map((s) => s.hotelId))];
  const roomIds = specs.map((s) => s.roomId).filter((id): id is string => Boolean(id));
  const [{ data: hotels }, { data: rooms }, { data: mappings }] = await Promise.all([
    sb.from("hotels").select("*").in("id", hotelIds),
    roomIds.length
      ? sb.from("hotel_rooms").select("*").in("id", roomIds)
      : Promise.resolve({ data: [] as HotelRoomRow[] }),
    sb.from("hotel_supplier_mappings").select("*").in("hotel_id", hotelIds),
  ]);
  const hotelById = new Map(((hotels ?? []) as HotelRow[]).map((h) => [h.id, h]));
  const roomById = new Map(((rooms ?? []) as HotelRoomRow[]).map((r) => [r.id, r]));
  const mappingsByHotel = new Map<string, HotelSupplierMappingRow[]>();
  for (const m of (mappings ?? []) as HotelSupplierMappingRow[]) {
    const list = mappingsByHotel.get(m.hotel_id) ?? [];
    list.push(m);
    mappingsByHotel.set(m.hotel_id, list);
  }

  return specs.flatMap((spec) => {
    const hotel = hotelById.get(spec.hotelId);
    if (!hotel) return [];
    return [
      {
        stayOptionId,
        hotel,
        room: spec.roomId ? (roomById.get(spec.roomId) ?? null) : null,
        mappings: mappingsByHotel.get(spec.hotelId) ?? [],
        checkIn: spec.checkIn,
        checkOut: spec.checkOut,
        currency: departure.currency as string,
        departureId: stay.departure_id as string,
        legPosition: spec.position,
        legName: spec.legName,
      },
    ];
  });
}

/** Cheapest stored, available rate for a hotel stay and occupancy (room-scoped when the tier names one). */
export async function bestStoredRate(
  ctx: StayContext,
  adults: number,
  /**
   * Constrain the rate to what the tier actually promises.
   *
   * Without this it returns the cheapest rate at the hotel, full stop — which quietly prices a
   * breakfast-included tier off a room-only rate. It was doing exactly that in production: the
   * Classic tier promises breakfast and was costed at $2,028 when the cheapest rate that actually
   * includes breakfast is $2,471. A $442 hole per traveler, on a tier where eighteen qualifying
   * rates were sitting in the same table.
   */
  { requireBreakfast = false }: { requireBreakfast?: boolean } = {},
): Promise<HotelRateRow | null> {
  const sb = createServiceRoleClient();
  let q = sb
    .from("hotel_rates")
    .select("*")
    .eq("hotel_id", ctx.hotel.id)
    .eq("check_in", ctx.checkIn)
    .eq("check_out", ctx.checkOut)
    .eq("occupancy_adults", adults)
    .eq("available", true)
    .order("total_amount", { ascending: true })
    .limit(1);
  if (ctx.room) q = q.eq("hotel_room_id", ctx.room.id);
  if (requireBreakfast) q = q.eq("breakfast_included", true);
  const { data } = await q.maybeSingle();
  return (data as HotelRateRow | null) ?? null;
}
