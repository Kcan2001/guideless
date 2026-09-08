import "server-only";

import type { Tables } from "@guideless/types";
import { daysBetween } from "@guideless/utils";
import { DEFAULT_THRESHOLDS } from "@/lib/admin/alerts";
import { createClient } from "@/lib/supabase/server";
import type { ManifestTraveler } from "@/lib/admin/manifest";
import { roomsFor } from "@/lib/admin/manifest";

/**
 * Read models for running a departure: what is left (inventory), who is coming (manifest) and who
 * we owe money to (suppliers). Every query runs as the signed-in staff user, so RLS applies.
 *
 * These live apart from `queries.ts` only because that file is already long; the conventions are
 * identical.
 */

type Departure = Tables<"departures">;
type Tour = Tables<"tours">;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── Inventory ─────────────────────────────────────────────────────────────────

export interface Availability {
  capacity: number;
  confirmed: number;
  held: number;
  available: number;
}

export interface TierInventory {
  id: string;
  name: string;
  tier: string | null;
  capacity: number | null;
  confirmed: number;
  held: number;
  /** null when the tier has no cap. */
  remaining: number | null;
  hotelId: string | null;
  lastRateAt: string | null;
}

export interface AddOnInventory {
  id: string;
  title: string;
  kind: string;
  capacity: number | null;
  confirmed: number;
  held: number;
  remaining: number | null;
  soldOut: boolean;
  /** Last day it can be bought, from the departure date and the sales window. */
  bookableUntil: string;
  salesClosed: boolean;
}

export interface HoldRow {
  kind: "seat" | "add_on";
  label: string;
  /** Seats for a seat hold, units for an add-on hold. */
  units: number;
  expiresAt: string;
  bookingId: string;
  confirmationNumber: string;
}

export interface DepartureInventory {
  departure: Departure;
  tour: Tour;
  daysUntil: number;
  availability: Availability;
  belowMinimum: boolean;
  /**
   * Below minimum *and* close enough that it needs a decision. Under minimum a year out is
   * normal, so only this drives the sort and the warning colour — the same window the dashboard
   * alerts use, so the two screens never disagree.
   */
  needsDecision: boolean;
  tiers: TierInventory[];
  addOns: AddOnInventory[];
  holds: HoldRow[];
}

interface HeldBooking {
  id: string;
  departure_id: string;
  confirmation_number: string;
  hold_expires_at: string | null;
  booking_travelers: Array<{ traveler_id: string }> | null;
}

interface HeldAddOn {
  id: string;
  add_on_id: string;
  quantity: number;
  hold_expires_at: string | null;
  booking_id: string;
  bookings: { confirmation_number: string; departure_id: string } | null;
}

/**
 * What is left and what is at risk across every upcoming departure. Seats come from
 * `get_departure_availability`, tiers from `stay_option_availability_for` (which mirrors the rule
 * inside `quote_booking`), add-ons from `add_on_availability`. Sorted at-risk first, then soonest.
 */
export async function getInventory(): Promise<DepartureInventory[]> {
  const sb = await createClient();
  const nowIso = new Date().toISOString();
  const { data: departures, error } = await sb
    .from("departures")
    .select("*")
    .gte("end_date", today())
    .not("status", "in", "(draft,cancelled)")
    .order("start_date");
  if (error) throw error;
  if (!departures?.length) return [];

  const ids = departures.map((d) => d.id);
  const [{ data: tours }, seats, { data: tiers }, { data: addOns }, { data: heldBookings }] =
    await Promise.all([
      sb
        .from("tours")
        .select("*")
        .in("id", [...new Set(departures.map((d) => d.tour_id))]),
      Promise.all(
        ids.map(async (id) => {
          const { data } = await sb.rpc("get_departure_availability", { p_departure_id: id });
          const row = data?.[0];
          return [id, row ?? { capacity: 0, confirmed: 0, held: 0, available: 0 }] as const;
        }),
      ),
      sb
        .from("departure_stay_options")
        .select("id, departure_id, name, tier, capacity, hotel_id, position")
        .in("departure_id", ids)
        .eq("is_active", true)
        .order("position"),
      sb
        .from("departure_add_ons")
        .select("id, departure_id, title, kind, capacity, bookable_until_days_before, position")
        .in("departure_id", ids)
        .eq("is_active", true)
        .order("position"),
      sb
        .from("bookings")
        .select(
          "id, departure_id, confirmation_number, hold_expires_at, booking_travelers(traveler_id)",
        )
        .in("departure_id", ids)
        .eq("status", "pending_payment")
        .gt("hold_expires_at", nowIso),
    ]);

  const seatsById = new Map(seats);
  const tourById = new Map((tours ?? []).map((t) => [t.id, t]));
  const addOnIds = (addOns ?? []).map((a) => a.id);
  const hotelIds = [...new Set((tiers ?? []).map((t) => t.hotel_id))].filter(
    (id): id is string => id !== null,
  );

  const [addOnAvail, rateRows, tierAvail, heldAddOns] = await Promise.all([
    addOnIds.length
      ? sb
          .from("add_on_availability")
          .select("*")
          .in("add_on_id", addOnIds)
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
    hotelIds.length
      ? sb
          .from("hotel_rates")
          .select("hotel_id, fetched_at")
          .in("hotel_id", hotelIds)
          .order("fetched_at", { ascending: false })
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
    Promise.all(
      ids.map(async (id) => {
        const { data } = await sb.rpc("stay_option_availability_for", { p_departure_id: id });
        return data ?? [];
      }),
    ),
    addOnIds.length
      ? sb
          .from("booking_add_ons")
          .select(
            "id, add_on_id, quantity, hold_expires_at, booking_id, bookings(confirmation_number, departure_id)",
          )
          .in("add_on_id", addOnIds)
          .eq("status", "pending")
          .gt("hold_expires_at", nowIso)
          .then((r) => (r.data ?? []) as unknown as HeldAddOn[])
      : Promise.resolve([] as HeldAddOn[]),
  ]);

  const availByAddOn = new Map(addOnAvail.map((a) => [a.add_on_id, a]));
  const availByTier = new Map(tierAvail.flat().map((t) => [t.stay_option_id, t] as const));
  // Ordered newest first, so the first row per hotel is the freshest refresh.
  const lastRateByHotel = new Map<string, string>();
  for (const r of rateRows)
    if (!lastRateByHotel.has(r.hotel_id)) lastRateByHotel.set(r.hotel_id, r.fetched_at);

  const rows: DepartureInventory[] = departures.flatMap((departure) => {
    const tour = tourById.get(departure.tour_id);
    if (!tour) return [];
    const availability = seatsById.get(departure.id) ?? {
      capacity: 0,
      confirmed: 0,
      held: 0,
      available: 0,
    };

    const holds: HoldRow[] = [];
    for (const b of (heldBookings ?? []) as unknown as HeldBooking[]) {
      if (b.departure_id !== departure.id || !b.hold_expires_at) continue;
      holds.push({
        kind: "seat",
        label: "Seats",
        units: (b.booking_travelers ?? []).length,
        expiresAt: b.hold_expires_at,
        bookingId: b.id,
        confirmationNumber: b.confirmation_number,
      });
    }
    for (const ba of heldAddOns) {
      if (ba.bookings?.departure_id !== departure.id || !ba.hold_expires_at) continue;
      holds.push({
        kind: "add_on",
        label: (addOns ?? []).find((a) => a.id === ba.add_on_id)?.title ?? "Add-on",
        units: ba.quantity,
        expiresAt: ba.hold_expires_at,
        bookingId: ba.booking_id,
        confirmationNumber: ba.bookings?.confirmation_number ?? "—",
      });
    }
    holds.sort((x, y) => x.expiresAt.localeCompare(y.expiresAt));

    return [
      {
        departure,
        tour,
        daysUntil: daysBetween(today(), departure.start_date),
        availability,
        belowMinimum: availability.confirmed < departure.minimum_travelers,
        needsDecision:
          availability.confirmed < departure.minimum_travelers &&
          daysBetween(today(), departure.start_date) <= DEFAULT_THRESHOLDS.belowMinimumDays,
        tiers: (tiers ?? [])
          .filter((t) => t.departure_id === departure.id)
          .map((t) => {
            const av = availByTier.get(t.id);
            const confirmed = av?.confirmed ?? 0;
            const held = av?.held ?? 0;
            return {
              id: t.id,
              name: t.name,
              tier: t.tier,
              capacity: t.capacity,
              confirmed,
              held,
              remaining: t.capacity === null ? null : Math.max(t.capacity - confirmed - held, 0),
              hotelId: t.hotel_id,
              lastRateAt: t.hotel_id ? (lastRateByHotel.get(t.hotel_id) ?? null) : null,
            };
          }),
        addOns: (addOns ?? [])
          .filter((a) => a.departure_id === departure.id)
          .map((a) => {
            const av = availByAddOn.get(a.id);
            const confirmed = av?.confirmed ?? 0;
            const held = av?.held ?? 0;
            const remaining =
              a.capacity === null ? null : Math.max(a.capacity - confirmed - held, 0);
            const bookableUntil = addDaysIso(
              departure.start_date,
              -(a.bookable_until_days_before ?? 1),
            );
            return {
              id: a.id,
              title: a.title,
              kind: a.kind,
              capacity: a.capacity,
              confirmed,
              held,
              remaining,
              soldOut: remaining === 0,
              bookableUntil,
              salesClosed: bookableUntil < today(),
            };
          }),
        holds,
      },
    ];
  });

  // Departures needing a decision first, then everything by date.
  return rows.sort(
    (x, y) =>
      Number(y.needsDecision) - Number(x.needsDecision) ||
      x.departure.start_date.localeCompare(y.departure.start_date),
  );
}

// ── Manifest ──────────────────────────────────────────────────────────────────

export interface DepartureManifest {
  departure: Departure;
  tour: Tour;
  travelers: ManifestTraveler[];
  rooming: ReturnType<typeof roomsFor>;
}

interface ManifestBookingRow {
  id: string;
  confirmation_number: string;
  stay_option_id: string | null;
  departure_stay_options: { name: string } | null;
  booking_preferences: {
    dietary_requirements: string | null;
    accessibility_needs: string | null;
    airport_transfer: string;
  } | null;
  booking_travelers: Array<{
    traveler_id: string;
    room_index: number;
    is_lead: boolean;
    traveler_profiles: {
      id: string;
      first_name: string;
      last_name: string;
      preferred_name: string | null;
      email: string | null;
      phone: string | null;
      date_of_birth: string | null;
      nationality: string | null;
      dietary_requirements: string | null;
      accessibility_notes: string | null;
      user_id: string | null;
    } | null;
  }> | null;
}

const TRANSFER_LABEL: Record<string, string> = {
  group_welcome_transfer: "Group transfer",
  own_arrangement: "Own arrangement",
};

/**
 * Everyone confirmed on a departure, with the details a hotel or supplier asks for. Traveler-level
 * dietary and accessibility notes win over the booking-level ones, since they are more specific.
 */
export async function getDepartureManifest(departureId: string): Promise<DepartureManifest | null> {
  const sb = await createClient();
  const [{ data: departure }, { data: bookings }] = await Promise.all([
    sb.from("departures").select("*").eq("id", departureId).maybeSingle(),
    sb
      .from("bookings")
      .select(
        "id, confirmation_number, stay_option_id, departure_stay_options(name), booking_preferences(dietary_requirements, accessibility_needs, airport_transfer), booking_travelers(traveler_id, room_index, is_lead, traveler_profiles(id, first_name, last_name, preferred_name, email, phone, date_of_birth, nationality, dietary_requirements, accessibility_notes, user_id))",
      )
      .eq("departure_id", departureId)
      .eq("status", "confirmed")
      .order("confirmation_number"),
  ]);
  if (!departure) return null;
  const { data: tour } = await sb
    .from("tours")
    .select("*")
    .eq("id", departure.tour_id)
    .maybeSingle();
  if (!tour) return null;

  const rows = (bookings ?? []) as unknown as ManifestBookingRow[];
  const bookingIds = rows.map((b) => b.id);

  const [addOnRows, docRows] = await Promise.all([
    bookingIds.length
      ? sb
          .from("booking_add_ons")
          .select("traveler_id, booking_id, status, departure_add_ons(title)")
          .in("booking_id", bookingIds)
          .eq("status", "confirmed")
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
    sb
      .from("trips")
      .select("id")
      .eq("departure_id", departureId)
      .maybeSingle()
      .then(async ({ data: trip }) =>
        trip
          ? ((await sb.from("trip_documents").select("for_user_id").eq("trip_id", trip.id)).data ??
            [])
          : [],
      ),
  ]);

  const groupDocs = docRows.filter((d) => d.for_user_id === null).length;
  const docsByUser = new Map<string, number>();
  for (const d of docRows)
    if (d.for_user_id) docsByUser.set(d.for_user_id, (docsByUser.get(d.for_user_id) ?? 0) + 1);

  const travelers: ManifestTraveler[] = rows.flatMap((b) =>
    (b.booking_travelers ?? []).flatMap((bt) => {
      const p = bt.traveler_profiles;
      if (!p) return [];
      const addOns = addOnRows
        .filter(
          (a) =>
            a.booking_id === b.id && (a.traveler_id === null || a.traveler_id === bt.traveler_id),
        )
        .map(
          (a) => (a.departure_add_ons as unknown as { title: string } | null)?.title ?? "Add-on",
        );
      return [
        {
          travelerId: p.id,
          bookingId: b.id,
          confirmationNumber: b.confirmation_number,
          name: `${p.first_name} ${p.last_name}`,
          preferredName: p.preferred_name,
          email: p.email,
          phone: p.phone,
          dateOfBirth: p.date_of_birth,
          nationality: p.nationality,
          isLead: bt.is_lead,
          roomIndex: bt.room_index,
          stayName: b.departure_stay_options?.name ?? null,
          // The traveler's own note is more specific than the one taken at booking.
          dietary: p.dietary_requirements ?? b.booking_preferences?.dietary_requirements ?? null,
          accessibility:
            p.accessibility_notes ?? b.booking_preferences?.accessibility_needs ?? null,
          airportTransfer: b.booking_preferences
            ? (TRANSFER_LABEL[b.booking_preferences.airport_transfer] ??
              b.booking_preferences.airport_transfer)
            : null,
          addOns,
          documentCount: groupDocs + (p.user_id ? (docsByUser.get(p.user_id) ?? 0) : 0),
        },
      ];
    }),
  );

  return { departure, tour, travelers, rooming: roomsFor(travelers) };
}

// ── Suppliers ─────────────────────────────────────────────────────────────────

export interface SupplierRow {
  supplier: Tables<"suppliers">;
  primaryContact: { name: string; email: string | null; phone: string | null } | null;
  servicesTotal: number;
  servicesUnconfirmed: number;
  /** Upcoming departures this supplier is booked on, soonest first. */
  departures: Array<{ id: string; startDate: string; tourName: string }>;
}

/** The global supplier list. Costs stay out of this view; they live on the departure screen. */
export async function listSuppliers(): Promise<SupplierRow[]> {
  const sb = await createClient();
  const [{ data: suppliers, error }, { data: contacts }, { data: services }] = await Promise.all([
    sb.from("suppliers").select("*").order("name"),
    sb.from("supplier_contacts").select("supplier_id, name, email, phone, is_primary"),
    sb.from("supplier_services").select("supplier_id, status, departure_id"),
  ]);
  if (error) throw error;
  if (!suppliers?.length) return [];

  const depIds = [...new Set((services ?? []).map((s) => s.departure_id))].filter(
    (id): id is string => id !== null,
  );
  const { data: departures } = depIds.length
    ? await sb
        .from("departures")
        .select("id, start_date, tour_id")
        .in("id", depIds)
        .gte("end_date", today())
        .order("start_date")
    : { data: [] };
  const { data: tours } = departures?.length
    ? await sb
        .from("tours")
        .select("id, name")
        .in("id", [...new Set(departures.map((d) => d.tour_id))])
    : { data: [] };
  const tourName = new Map((tours ?? []).map((t) => [t.id, t.name]));
  const depById = new Map((departures ?? []).map((d) => [d.id, d]));

  return suppliers.map((supplier) => {
    const mine = (services ?? []).filter((s) => s.supplier_id === supplier.id);
    const contact =
      (contacts ?? []).find((c) => c.supplier_id === supplier.id && c.is_primary) ??
      (contacts ?? []).find((c) => c.supplier_id === supplier.id) ??
      null;
    const upcoming = [
      ...new Map(
        mine
          .flatMap((s) => (s.departure_id ? [depById.get(s.departure_id)] : []))
          .flatMap((d) =>
            d
              ? [
                  [
                    d.id,
                    { id: d.id, startDate: d.start_date, tourName: tourName.get(d.tour_id) ?? "" },
                  ] as const,
                ]
              : [],
          ),
      ).values(),
    ].sort((a, b) => a.startDate.localeCompare(b.startDate));
    return {
      supplier,
      primaryContact: contact
        ? { name: contact.name, email: contact.email, phone: contact.phone }
        : null,
      servicesTotal: mine.length,
      servicesUnconfirmed: mine.filter((s) => s.status === "requested" || s.status === "pending")
        .length,
      departures: upcoming,
    };
  });
}
