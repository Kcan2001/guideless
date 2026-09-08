import "server-only";

import type { Tables } from "@guideless/types";
import { daysBetween } from "@guideless/utils";
import { listHotelsForSelect } from "@/lib/hotels/catalog";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin read models. Every query runs as the signed-in staff user, so RLS applies exactly as it
 * would for any other client — no service role here.
 */

type Departure = Tables<"departures">;
type Tour = Tables<"tours">;
type Booking = Tables<"bookings">;
type Traveler = Tables<"traveler_profiles">;
type Profile = Tables<"profiles">;

export interface Availability {
  capacity: number;
  confirmed: number;
  held: number;
  available: number;
}

export interface Issue {
  severity: "warning" | "info";
  text: string;
  href?: string;
}

export interface DepartureRow {
  departure: Departure;
  tour: Tour;
  availability: Availability;
  groupCount: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function availabilityFor(ids: string[]): Promise<Map<string, Availability>> {
  const sb = await createClient();
  const entries = await Promise.all(
    ids.map(async (id) => {
      const { data } = await sb.rpc("get_departure_availability", { p_departure_id: id });
      const row = data?.[0];
      return [id, row ?? { capacity: 0, confirmed: 0, held: 0, available: 0 }] as const;
    }),
  );
  return new Map(entries);
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export async function getDashboard() {
  const sb = await createClient();
  const [{ data: departures, error }, { data: recent, error: rErr }, { count: openSupport }] =
    await Promise.all([
      sb
        .from("departures")
        .select("*")
        .gte("end_date", today())
        .not("status", "in", "(draft,cancelled)")
        .order("start_date")
        .limit(12),
      sb.from("bookings").select("*").order("created_at", { ascending: false }).limit(8),
      sb
        .from("support_threads")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "waiting_on_staff"]),
    ]);
  if (error) throw error;
  if (rErr) throw rErr;

  const tourIds = [
    ...new Set([...departures.map((d) => d.tour_id), ...recent.map(() => "")]),
  ].filter(Boolean);
  const depIds = [
    ...new Set([...departures.map((d) => d.id), ...recent.map((b) => b.departure_id)]),
  ];
  const [{ data: tours }, { data: recentDeps }, availability, { data: groups }] = await Promise.all(
    [
      sb
        .from("tours")
        .select("*")
        .in("id", tourIds.length ? tourIds : ["00000000-0000-0000-0000-000000000000"]),
      sb
        .from("departures")
        .select("id, tour_id, start_date, end_date")
        .in("id", depIds.length ? depIds : ["00000000-0000-0000-0000-000000000000"]),
      availabilityFor(departures.map((d) => d.id)),
      sb
        .from("departure_groups")
        .select("departure_id")
        .in(
          "departure_id",
          departures.map((d) => d.id),
        ),
    ],
  );
  const tourById = new Map((tours ?? []).map((t) => [t.id, t]));
  const recentDepById = new Map((recentDeps ?? []).map((d) => [d.id, d]));
  // Tours for recent bookings may not be in the upcoming set.
  const missingTourIds = (recentDeps ?? []).map((d) => d.tour_id).filter((id) => !tourById.has(id));
  if (missingTourIds.length) {
    const { data: more } = await sb.from("tours").select("*").in("id", missingTourIds);
    for (const t of more ?? []) tourById.set(t.id, t);
  }

  const upcoming = departures.flatMap((departure) => {
    const tour = tourById.get(departure.tour_id);
    if (!tour) return [];
    return [
      {
        departure,
        tour,
        availability: availability.get(departure.id)!,
        groupCount: (groups ?? []).filter((g) => g.departure_id === departure.id).length,
        daysUntil: daysBetween(today(), departure.start_date),
      },
    ];
  });

  const issues: Issue[] = [];
  for (const row of upcoming) {
    const ds = await departureIssues(row.departure, row.availability);
    for (const i of ds) issues.push({ ...i, href: `/admin/departures/${row.departure.id}` });
  }
  if ((openSupport ?? 0) > 0) {
    issues.push({
      severity: "info",
      text: `${openSupport} open support ${openSupport === 1 ? "thread" : "threads"}`,
    });
  }

  const recentBookings = recent.flatMap((booking) => {
    const dep = recentDepById.get(booking.departure_id);
    const tour = dep ? tourById.get(dep.tour_id) : undefined;
    return tour && dep ? [{ booking, tour, departure: dep }] : [];
  });

  return { upcoming, issues, recentBookings, openSupport: openSupport ?? 0 };
}

async function departureIssues(d: Departure, a: Availability): Promise<Issue[]> {
  const sb = await createClient();
  const issues: Issue[] = [];
  const days = daysBetween(today(), d.start_date);

  if (a.confirmed < d.minimum_travelers && days <= 60) {
    issues.push({
      severity: "warning",
      text: `${d.start_date}: ${a.confirmed}/${d.minimum_travelers} minimum travelers, ${days} days out`,
    });
  }
  if (a.held > 0)
    issues.push({
      severity: "info",
      text: `${d.start_date}: ${a.held} seat${a.held === 1 ? "" : "s"} on hold`,
    });

  const [{ count: pendingServices }, { data: bookings }] = await Promise.all([
    sb
      .from("supplier_services")
      .select("id", { count: "exact", head: true })
      .eq("departure_id", d.id)
      .in("status", ["requested", "pending"]),
    sb
      .from("bookings")
      .select("id, total_amount, amount_paid, status")
      .eq("departure_id", d.id)
      .eq("status", "confirmed"),
  ]);
  if ((pendingServices ?? 0) > 0) {
    issues.push({
      severity: "warning",
      text: `${d.start_date}: ${pendingServices} supplier confirmation${pendingServices === 1 ? "" : "s"} pending`,
    });
  }
  const unpaid = (bookings ?? []).filter((b) => b.amount_paid < b.total_amount);
  if (unpaid.length > 0 && d.balance_due_date && d.balance_due_date < today()) {
    issues.push({
      severity: "warning",
      text: `${d.start_date}: ${unpaid.length} booking${unpaid.length === 1 ? "" : "s"} with balance overdue`,
    });
  }
  if (bookings && bookings.length > 0) {
    const { data: travelers } = await sb
      .from("booking_travelers")
      .select("traveler_profiles(date_of_birth, nationality)")
      .in(
        "booking_id",
        bookings.map((b) => b.id),
      );
    const missing = (travelers ?? []).filter(
      (t) => !t.traveler_profiles?.date_of_birth || !t.traveler_profiles?.nationality,
    ).length;
    if (missing > 0)
      issues.push({
        severity: "warning",
        text: `${d.start_date}: ${missing} traveler${missing === 1 ? "" : "s"} missing date of birth or nationality`,
      });
  }
  return issues;
}

// ── Tours ─────────────────────────────────────────────────────────────────────
export async function listTours() {
  const sb = await createClient();
  const [{ data: tours, error }, { data: versions }, { data: departures }] = await Promise.all([
    sb.from("tours").select("*").order("name"),
    sb.from("tour_versions").select("id, tour_id, status, version_number"),
    sb.from("departures").select("id, tour_id, status").gte("end_date", today()),
  ]);
  if (error) throw error;
  return tours.map((tour) => ({
    tour,
    currentVersion: (versions ?? []).find((v) => v.id === tour.current_version_id) ?? null,
    versionCount: (versions ?? []).filter((v) => v.tour_id === tour.id).length,
    draftCount: (versions ?? []).filter((v) => v.tour_id === tour.id && v.status === "draft")
      .length,
    upcomingDepartures: (departures ?? []).filter((d) => d.tour_id === tour.id).length,
  }));
}

export async function getTourAdmin(id: string) {
  const sb = await createClient();
  const { data: tour, error } = await sb.from("tours").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!tour) return null;
  const [{ data: versions }, { data: departures }] = await Promise.all([
    sb
      .from("tour_versions")
      .select("*")
      .eq("tour_id", id)
      .order("version_number", { ascending: false }),
    sb.from("departures").select("*").eq("tour_id", id).order("start_date", { ascending: false }),
  ]);
  return { tour, versions: versions ?? [], departures: departures ?? [] };
}

export async function getVersionAdmin(versionId: string) {
  const sb = await createClient();
  const { data: version, error } = await sb
    .from("tour_versions")
    .select("*")
    .eq("id", versionId)
    .maybeSingle();
  if (error) throw error;
  if (!version) return null;
  const [
    { data: tour },
    { data: route },
    { data: included },
    { data: excluded },
    { data: faqs },
    { data: days },
    { data: destinations },
  ] = await Promise.all([
    sb.from("tours").select("*").eq("id", version.tour_id).maybeSingle(),
    sb
      .from("tour_version_destinations")
      .select("*, destinations(*)")
      .eq("tour_version_id", versionId)
      .order("position"),
    sb.from("tour_included_items").select("*").eq("tour_version_id", versionId).order("position"),
    sb.from("tour_excluded_items").select("*").eq("tour_version_id", versionId).order("position"),
    sb.from("tour_faqs").select("*").eq("tour_version_id", versionId).order("position"),
    sb
      .from("tour_days")
      .select("*, tour_itinerary_items(*), destinations(*)")
      .eq("tour_version_id", versionId)
      .order("day_number")
      .order("position", { referencedTable: "tour_itinerary_items" }),
    sb.from("destinations").select("*").order("name"),
  ]);
  if (!tour) return null;
  return {
    tour,
    version,
    route: (route ?? []).flatMap((r) =>
      r.destinations
        ? [{ destination: r.destinations, position: r.position, nights: r.nights }]
        : [],
    ),
    included: included ?? [],
    excluded: excluded ?? [],
    faqs: faqs ?? [],
    days: (days ?? []).map(({ tour_itinerary_items, destinations: dest, ...day }) => ({
      ...day,
      items: tour_itinerary_items,
      destination: dest,
    })),
    destinations: destinations ?? [],
    isLocked: version.status !== "draft",
  };
}

// ── Departures ────────────────────────────────────────────────────────────────
export async function listDepartures(
  opts: { status?: string; includePast?: boolean } = {},
): Promise<DepartureRow[]> {
  const sb = await createClient();
  let q = sb.from("departures").select("*").order("start_date");
  if (opts.status) q = q.eq("status", opts.status as Departure["status"]);
  if (!opts.includePast) q = q.gte("end_date", today());
  const { data: departures, error } = await q;
  if (error) throw error;
  if (departures.length === 0) return [];
  const [{ data: tours }, availability, { data: groups }] = await Promise.all([
    sb
      .from("tours")
      .select("*")
      .in("id", [...new Set(departures.map((d) => d.tour_id))]),
    availabilityFor(departures.map((d) => d.id)),
    sb
      .from("departure_groups")
      .select("departure_id")
      .in(
        "departure_id",
        departures.map((d) => d.id),
      ),
  ]);
  const tourById = new Map((tours ?? []).map((t) => [t.id, t]));
  return departures.flatMap((departure) => {
    const tour = tourById.get(departure.tour_id);
    return tour
      ? [
          {
            departure,
            tour,
            availability: availability.get(departure.id)!,
            groupCount: (groups ?? []).filter((g) => g.departure_id === departure.id).length,
          },
        ]
      : [];
  });
}

export async function getDepartureAdmin(id: string) {
  const sb = await createClient();
  const { data: departure, error } = await sb
    .from("departures")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!departure) return null;

  const [
    { data: tour },
    { data: version },
    availability,
    { data: groups },
    { data: bookings },
    { data: trips },
    { data: services },
    { data: suppliers },
    { data: notes },
  ] = await Promise.all([
    sb.from("tours").select("*").eq("id", departure.tour_id).maybeSingle(),
    sb.from("tour_versions").select("*").eq("id", departure.tour_version_id).maybeSingle(),
    availabilityFor([id]),
    sb.from("departure_groups").select("*").eq("departure_id", id).order("position"),
    sb.from("bookings").select("*").eq("departure_id", id).order("created_at"),
    sb
      .from("trips")
      .select("*, trip_itinerary_items(count), trip_members(count)")
      .eq("departure_id", id),
    sb
      .from("supplier_services")
      .select("*, suppliers(*)")
      .eq("departure_id", id)
      .order("created_at"),
    sb.from("suppliers").select("*").eq("is_active", true).order("name"),
    sb
      .from("departure_notes")
      .select("*")
      .eq("departure_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (!tour || !version) return null;

  const bookingIds = (bookings ?? []).map((b) => b.id);
  const customerIds = [...new Set((bookings ?? []).map((b) => b.customer_id))];
  const [{ data: bt }, { data: customers }] = await Promise.all([
    bookingIds.length
      ? sb
          .from("booking_travelers")
          .select("booking_id, is_lead, departure_group_id, traveler_profiles(*)")
          .in("booking_id", bookingIds)
      : Promise.resolve({
          data: [] as Array<{
            booking_id: string;
            is_lead: boolean;
            departure_group_id: string | null;
            traveler_profiles: Traveler | null;
          }>,
        }),
    customerIds.length
      ? sb.from("profiles").select("*").in("id", customerIds)
      : Promise.resolve({ data: [] as Profile[] }),
  ]);
  const customerById = new Map((customers ?? []).map((c) => [c.id, c]));

  const bookingRows = (bookings ?? []).map((booking) => ({
    booking,
    customer: customerById.get(booking.customer_id) ?? null,
    travelers: (bt ?? [])
      .filter((t) => t.booking_id === booking.id)
      .flatMap((t) =>
        t.traveler_profiles
          ? [{ ...t.traveler_profiles, isLead: t.is_lead, groupId: t.departure_group_id }]
          : [],
      ),
  }));

  const a = availability.get(id)!;
  const issues = await departureIssues(departure, a);

  return {
    departure,
    tour,
    version,
    availability: a,
    groups: groups ?? [],
    bookings: bookingRows,
    trips: (trips ?? []).map((t) => ({
      ...t,
      itemCount: (t.trip_itinerary_items as unknown as Array<{ count: number }>)[0]?.count ?? 0,
      memberCount: (t.trip_members as unknown as Array<{ count: number }>)[0]?.count ?? 0,
    })),
    services: (services ?? []).map((s) => ({ ...s, supplier: s.suppliers })),
    suppliers: suppliers ?? [],
    notes: notes ?? [],
    issues,
  };
}

export async function getTripAdmin(tripId: string) {
  const sb = await createClient();
  const { data: trip, error } = await sb.from("trips").select("*").eq("id", tripId).maybeSingle();
  if (error) throw error;
  if (!trip) return null;
  const [
    { data: departure },
    { data: days },
    { data: members },
    { data: notes },
    { data: destinations },
    { data: moments },
    { data: momentCounts },
  ] = await Promise.all([
    sb.from("departures").select("*").eq("id", trip.departure_id).maybeSingle(),
    sb
      .from("trip_days")
      .select("*, trip_itinerary_items(*), destinations(*)")
      .eq("trip_id", tripId)
      .order("day_number")
      .order("position", { referencedTable: "trip_itinerary_items" }),
    sb.from("trip_members").select("*").eq("trip_id", tripId),
    sb
      .from("trip_notes")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false }),
    sb.from("destinations").select("*").order("name"),
    sb.from("live_moments").select("*").eq("trip_id", tripId).order("start_at"),
    sb.from("live_moment_counts").select("*"),
  ]);
  const { data: tour } = departure
    ? await sb.from("tours").select("*").eq("id", departure.tour_id).maybeSingle()
    : { data: null };
  if (!departure || !tour) return null;
  // trip_members → auth.users; profiles is keyed by the same id but has no FK to trip_members.
  const memberIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = memberIds.length
    ? await sb.from("profiles").select("*").in("id", memberIds)
    : { data: [] as Profile[] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  return {
    trip,
    departure,
    tour,
    days: (days ?? []).map(({ trip_itinerary_items, destinations: dest, ...day }) => ({
      ...day,
      items: trip_itinerary_items,
      destination: dest,
    })),
    members: (members ?? []).map((m) => ({ ...m, profile: profileById.get(m.user_id) ?? null })),
    notes: notes ?? [],
    destinations: destinations ?? [],
    moments: (moments ?? []).map((m) => ({
      ...m,
      joined: (momentCounts ?? []).find((c) => c.moment_id === m.id)?.joined ?? 0,
    })),
  };
}

// ── Bookings ──────────────────────────────────────────────────────────────────
export async function listBookings(opts: { status?: string; q?: string } = {}) {
  const sb = await createClient();
  let query = sb.from("bookings").select("*").order("created_at", { ascending: false }).limit(200);
  if (opts.status) query = query.eq("status", opts.status as Booking["status"]);
  if (opts.q) query = query.ilike("confirmation_number", `%${opts.q.replace(/[%_]/g, "")}%`);
  const { data: bookings, error } = await query;
  if (error) throw error;
  if (bookings.length === 0) return [];
  const depIds = [...new Set(bookings.map((b) => b.departure_id))];
  const [{ data: departures }, { data: bt }, { data: customers }] = await Promise.all([
    sb.from("departures").select("id, tour_id, start_date, end_date").in("id", depIds),
    sb
      .from("booking_travelers")
      .select("booking_id")
      .in(
        "booking_id",
        bookings.map((b) => b.id),
      ),
    sb
      .from("profiles")
      .select("id, display_name")
      .in("id", [...new Set(bookings.map((b) => b.customer_id))]),
  ]);
  const { data: tours } = await sb
    .from("tours")
    .select("id, name, slug")
    .in("id", [...new Set((departures ?? []).map((d) => d.tour_id))]);
  const depById = new Map((departures ?? []).map((d) => [d.id, d]));
  const tourById = new Map((tours ?? []).map((t) => [t.id, t]));
  const custById = new Map((customers ?? []).map((c) => [c.id, c]));
  return bookings.flatMap((booking) => {
    const dep = depById.get(booking.departure_id);
    const tour = dep ? tourById.get(dep.tour_id) : undefined;
    if (!dep || !tour) return [];
    return [
      {
        booking,
        departure: dep,
        tour,
        customer: custById.get(booking.customer_id) ?? null,
        travelerCount: (bt ?? []).filter((t) => t.booking_id === booking.id).length,
      },
    ];
  });
}

export async function getBookingAdmin(id: string) {
  const sb = await createClient();
  const { data: booking, error } = await sb.from("bookings").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!booking) return null;
  const [
    { data: customer },
    { data: departure },
    { data: bt },
    { data: items },
    { data: payments },
    { data: refunds },
    { data: notes },
    { data: preferences },
    { data: cancellationRequests },
  ] = await Promise.all([
    sb.from("profiles").select("*").eq("id", booking.customer_id).maybeSingle(),
    sb.from("departures").select("*").eq("id", booking.departure_id).maybeSingle(),
    sb
      .from("booking_travelers")
      .select("is_lead, traveler_profiles(*, emergency_contacts(*))")
      .eq("booking_id", id),
    sb.from("booking_items").select("*").eq("booking_id", id),
    sb.from("payments").select("*").eq("booking_id", id).order("created_at"),
    sb.from("refunds").select("*").eq("booking_id", id).order("created_at"),
    sb
      .from("booking_notes")
      .select("*")
      .eq("booking_id", id)
      .order("created_at", { ascending: false }),
    sb.from("booking_preferences").select("*").eq("booking_id", id).maybeSingle(),
    sb
      .from("cancellation_requests")
      .select("*")
      .eq("booking_id", id)
      .order("requested_at", { ascending: false }),
  ]);
  const { data: tour } = departure
    ? await sb.from("tours").select("*").eq("id", departure.tour_id).maybeSingle()
    : { data: null };
  if (!departure || !tour) return null;
  return {
    booking,
    customer,
    departure,
    tour,
    travelers: (bt ?? []).flatMap((t) =>
      t.traveler_profiles
        ? [
            {
              ...t.traveler_profiles,
              isLead: t.is_lead,
              emergency: t.traveler_profiles.emergency_contacts,
            },
          ]
        : [],
    ),
    items: items ?? [],
    payments: payments ?? [],
    refunds: refunds ?? [],
    cancellationRequests: cancellationRequests ?? [],
    notes: notes ?? [],
    preferences,
  };
}

// ── Customers / travelers ─────────────────────────────────────────────────────
export async function listTravelers(q?: string) {
  const sb = await createClient();
  let query = sb.from("traveler_profiles").select("*").order("last_name").limit(300);
  if (q) {
    const safe = q.replace(/[%_,]/g, "");
    query = query.or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%`);
  }
  const { data: travelers, error } = await query;
  if (error) throw error;
  if (travelers.length === 0) return [];
  const { data: bt } = await sb
    .from("booking_travelers")
    .select("traveler_id, bookings(status)")
    .in(
      "traveler_id",
      travelers.map((t) => t.id),
    );
  return travelers.map((t) => ({
    ...t,
    bookings: (bt ?? [])
      .filter((b) => b.traveler_id === t.id)
      .map((b) => b.bookings?.status ?? "draft"),
  }));
}

// ── Stay options, add-ons, manifests, rooms (roadmap M9–M10) ──────────────────

export async function listDepartureExtrasAdmin(departureId: string) {
  const sb = await createClient();
  const [
    { data: stays },
    { data: addOns },
    { data: availability },
    { data: headcounts },
    { data: destinations },
  ] = await Promise.all([
    sb.from("departure_stay_options").select("*").eq("departure_id", departureId).order("position"),
    sb.from("departure_add_ons").select("*").eq("departure_id", departureId).order("position"),
    sb.from("add_on_availability").select("*"),
    sb.from("add_on_headcounts").select("*"),
    sb.from("destinations").select("id, name").order("name"),
  ]);
  const availById = new Map((availability ?? []).map((a) => [a.add_on_id, a]));
  const goingById = new Map((headcounts ?? []).map((h) => [h.add_on_id, h.going ?? 0]));
  const stayTaken = new Map<string, number>();
  if ((stays ?? []).length) {
    const { data: taken } = await sb
      .from("bookings")
      .select("stay_option_id, status, booking_travelers(traveler_id)")
      .eq("departure_id", departureId)
      .in("status", ["confirmed", "pending_payment"]);
    for (const b of taken ?? []) {
      if (!b.stay_option_id) continue;
      stayTaken.set(
        b.stay_option_id,
        (stayTaken.get(b.stay_option_id) ?? 0) + (b.booking_travelers?.length ?? 0),
      );
    }
  }
  // Curated hotels for the stay-option form; empty until migration 0044 exists on this database.
  const hotels = await listHotelsForSelect().catch(() => []);
  return {
    hotels,
    stays: (stays ?? []).map((st) => ({ ...st, taken: stayTaken.get(st.id) ?? 0 })),
    addOns: (addOns ?? []).map((a) => ({
      ...a,
      confirmed: availById.get(a.id)?.confirmed ?? 0,
      held: availById.get(a.id)?.held ?? 0,
      going: goingById.get(a.id) ?? 0,
    })),
    destinations: destinations ?? [],
  };
}

export interface ManifestRow {
  id: string;
  status: string;
  quantity: number;
  total_amount: number;
  currency: string;
  created_at: string;
  confirmation_number: string;
  booking_id: string;
  traveler_name: string | null;
  dietary_requirements: string | null;
  accessibility_notes: string | null;
  customer_email: string | null;
}

/** Who is on an add-on: one row per booking_add_ons row, with the traveler's needs for the supplier. */
export async function getAddOnManifest(departureId: string, addOnId: string) {
  const sb = await createClient();
  const [{ data: addOn }, { data: departure }, { data: rows }] = await Promise.all([
    sb
      .from("departure_add_ons")
      .select("*")
      .eq("id", addOnId)
      .eq("departure_id", departureId)
      .maybeSingle(),
    sb.from("departures").select("*").eq("id", departureId).maybeSingle(),
    sb
      .from("booking_add_ons")
      .select(
        "id, status, quantity, total_amount, currency, created_at, booking_id, bookings(confirmation_number, customer_id), traveler_profiles(first_name, last_name, preferred_name, dietary_requirements, accessibility_notes, email)",
      )
      .eq("add_on_id", addOnId)
      .order("created_at"),
  ]);
  if (!addOn || !departure) return null;
  const { data: tour } = await sb
    .from("tours")
    .select("name")
    .eq("id", departure.tour_id)
    .maybeSingle();
  const manifest: ManifestRow[] = (rows ?? []).map((r) => {
    const t = r.traveler_profiles as unknown as {
      first_name: string;
      last_name: string;
      preferred_name: string | null;
      dietary_requirements: string | null;
      accessibility_notes: string | null;
      email: string | null;
    } | null;
    const b = r.bookings as unknown as { confirmation_number: string; customer_id: string } | null;
    return {
      id: r.id,
      status: r.status,
      quantity: r.quantity,
      total_amount: r.total_amount,
      currency: r.currency,
      created_at: r.created_at,
      confirmation_number: b?.confirmation_number ?? "—",
      booking_id: r.booking_id,
      traveler_name: t
        ? `${t.first_name} ${t.last_name}${t.preferred_name ? ` (${t.preferred_name})` : ""}`
        : null,
      dietary_requirements: t?.dietary_requirements ?? null,
      accessibility_notes: t?.accessibility_notes ?? null,
      customer_email: t?.email ?? null,
    };
  });
  return { addOn, departure, tourName: tour?.name ?? "", manifest };
}

/** Room layout for a trip: travelers grouped by booking and room, with the chosen stay option. */
export async function getTripRooms(tripId: string) {
  const sb = await createClient();
  const { data: trip } = await sb
    .from("trips")
    .select("departure_id")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) return [];
  const { data: bookings } = await sb
    .from("bookings")
    .select(
      "id, confirmation_number, status, stay_option_id, departure_stay_options(name), booking_travelers(room_index, is_lead, traveler_profiles(first_name, last_name, room_preference))",
    )
    .eq("departure_id", trip.departure_id)
    .eq("status", "confirmed")
    .order("created_at");
  return (bookings ?? []).map((b) => {
    const rooms = new Map<number, string[]>();
    for (const bt of b.booking_travelers ?? []) {
      const tp = bt.traveler_profiles as unknown as {
        first_name: string;
        last_name: string;
      } | null;
      const name = tp ? `${tp.first_name} ${tp.last_name}` : "Traveler";
      rooms.set(bt.room_index, [...(rooms.get(bt.room_index) ?? []), name]);
    }
    const stay = b.departure_stay_options as unknown as { name: string } | null;
    return {
      bookingId: b.id,
      confirmationNumber: b.confirmation_number,
      stayName: stay?.name ?? null,
      rooms: [...rooms.entries()]
        .sort(([a], [c]) => a - c)
        .map(([index, names]) => ({ index, names })),
    };
  });
}

// ── Support inbox ─────────────────────────────────────────────────────────────
export type SupportThread = Tables<"support_threads">;
export type SupportMessage = Tables<"support_messages">;
export type SupportAttachment = Tables<"support_attachments">;

export type SupportFilter = "needs_reply" | "open" | "resolved" | "all";

export interface SupportThreadRow extends SupportThread {
  customer: Profile | null;
  tripName: string | null;
  lastMessage: Pick<SupportMessage, "body" | "created_at" | "is_from_staff"> | null;
  /** Most recent customer message, for "waiting since". */
  lastCustomerAt: string | null;
  assignee: Profile | null;
}

const NEEDS_REPLY_STATUSES: SupportThread["status"][] = ["open", "waiting_on_staff"];

/**
 * Staff view of support threads (RLS: is_support_staff). Filters run in SQL; the last message and
 * the customer's last message are pulled in one extra query and folded per thread.
 */
export async function listSupportThreads(opts: {
  filter?: SupportFilter;
  priority?: string | null;
  tripId?: string | null;
  assignedTo?: string | null;
}): Promise<SupportThreadRow[]> {
  const sb = await createClient();
  let q = sb
    .from("support_threads")
    .select("*")
    .order("last_message_at", { ascending: false })
    .limit(200);
  const filter = opts.filter ?? "needs_reply";
  if (filter === "needs_reply") q = q.in("status", NEEDS_REPLY_STATUSES);
  else if (filter === "open")
    q = q.in("status", ["open", "waiting_on_staff", "waiting_on_customer"]);
  else if (filter === "resolved") q = q.in("status", ["resolved", "closed"]);
  if (opts.priority) q = q.eq("priority", opts.priority);
  if (opts.tripId) q = q.eq("trip_id", opts.tripId);
  if (opts.assignedTo) q = q.eq("assigned_to", opts.assignedTo);
  const { data: threads, error } = await q;
  if (error) throw error;
  if (!threads || threads.length === 0) return [];

  const threadIds = threads.map((t) => t.id);
  const userIds = [
    ...new Set(
      threads.flatMap((t) => [t.customer_id, t.assigned_to]).filter((x): x is string => !!x),
    ),
  ];
  const tripIds = [...new Set(threads.map((t) => t.trip_id).filter((x): x is string => !!x))];
  const [{ data: messages }, { data: profiles }, { data: trips }] = await Promise.all([
    sb
      .from("support_messages")
      .select("thread_id, body, created_at, is_from_staff, is_internal_note")
      .in("thread_id", threadIds)
      .eq("is_internal_note", false)
      .order("created_at", { ascending: false }),
    sb.from("profiles").select("*").in("id", userIds),
    tripIds.length
      ? sb.from("trips").select("id, name").in("id", tripIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const tripById = new Map((trips ?? []).map((t) => [t.id, t.name]));
  const lastByThread = new Map<string, SupportThreadRow["lastMessage"]>();
  const lastCustomerByThread = new Map<string, string>();
  for (const m of messages ?? []) {
    if (!lastByThread.has(m.thread_id)) {
      lastByThread.set(m.thread_id, {
        body: m.body,
        created_at: m.created_at,
        is_from_staff: m.is_from_staff,
      });
    }
    if (!m.is_from_staff && !lastCustomerByThread.has(m.thread_id)) {
      lastCustomerByThread.set(m.thread_id, m.created_at);
    }
  }
  return threads.map((t) => ({
    ...t,
    customer: profileById.get(t.customer_id) ?? null,
    assignee: t.assigned_to ? (profileById.get(t.assigned_to) ?? null) : null,
    tripName: t.trip_id ? (tripById.get(t.trip_id) ?? null) : null,
    lastMessage: lastByThread.get(t.id) ?? null,
    lastCustomerAt: lastCustomerByThread.get(t.id) ?? null,
  }));
}

export interface SupportAttachmentWithUrl extends SupportAttachment {
  url: string | null;
}

export interface SupportMessageAdmin extends SupportMessage {
  sender: Profile | null;
  attachments: SupportAttachmentWithUrl[];
}

export async function getSupportThreadAdmin(threadId: string) {
  const sb = await createClient();
  const { data: thread, error } = await sb
    .from("support_threads")
    .select("*")
    .eq("id", threadId)
    .maybeSingle();
  if (error) throw error;
  if (!thread) return null;

  const [{ data: messages, error: mErr }, { data: trip }, { data: booking }] = await Promise.all([
    sb.from("support_messages").select("*").eq("thread_id", threadId).order("created_at"),
    thread.trip_id
      ? sb
          .from("trips")
          .select("id, name, departure_id, timezone")
          .eq("id", thread.trip_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    thread.booking_id
      ? sb
          .from("bookings")
          .select("id, confirmation_number, status, departure_id")
          .eq("id", thread.booking_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (mErr) throw mErr;
  const messageIds = (messages ?? []).map((m) => m.id);
  const senderIds = [
    ...new Set(
      [thread.customer_id, thread.assigned_to, ...(messages ?? []).map((m) => m.sender_id)].filter(
        (x): x is string => !!x,
      ),
    ),
  ];
  const [{ data: attachments }, { data: profiles }] = await Promise.all([
    messageIds.length
      ? sb.from("support_attachments").select("*").in("message_id", messageIds)
      : Promise.resolve({ data: [] as SupportAttachment[] }),
    sb.from("profiles").select("*").in("id", senderIds),
  ]);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  // Short-lived signed URLs; staff read is allowed by the bucket policy.
  const withUrls: SupportAttachmentWithUrl[] = await Promise.all(
    (attachments ?? []).map(async (a) => {
      const { data } = await sb.storage.from(a.bucket).createSignedUrl(a.storage_path, 600);
      return { ...a, url: data?.signedUrl ?? null };
    }),
  );
  const attachmentsByMessage = new Map<string, SupportAttachmentWithUrl[]>();
  for (const a of withUrls) {
    const list = attachmentsByMessage.get(a.message_id) ?? [];
    list.push(a);
    attachmentsByMessage.set(a.message_id, list);
  }

  // Itinerary item named in the context, if any, so staff see where the traveler was.
  const ctx = (thread.context ?? {}) as {
    itineraryItemId?: string;
    latitude?: number;
    longitude?: number;
    appVersion?: string;
  };
  const { data: contextItem } = ctx.itineraryItemId
    ? await sb
        .from("trip_itinerary_items")
        .select("id, title, type, location_name")
        .eq("id", ctx.itineraryItemId)
        .maybeSingle()
    : { data: null };

  return {
    thread,
    customer: profileById.get(thread.customer_id) ?? null,
    assignee: thread.assigned_to ? (profileById.get(thread.assigned_to) ?? null) : null,
    trip,
    booking,
    context: ctx,
    contextItem,
    messages: (messages ?? []).map((m): SupportMessageAdmin => ({
      ...m,
      sender: m.sender_id ? (profileById.get(m.sender_id) ?? null) : null,
      attachments: attachmentsByMessage.get(m.id) ?? [],
    })),
  };
}

// ── Trip documents ────────────────────────────────────────────────────────────
export type TripDocument = Tables<"trip_documents">;

export interface TripDocumentAdmin extends TripDocument {
  url: string | null;
  uploader: Profile | null;
  forUser: Profile | null;
}

export async function listTripDocumentsAdmin(tripId: string): Promise<TripDocumentAdmin[]> {
  const sb = await createClient();
  const { data: docs, error } = await sb
    .from("trip_documents")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!docs || docs.length === 0) return [];
  const userIds = [
    ...new Set(docs.flatMap((d) => [d.uploaded_by, d.for_user_id]).filter((x): x is string => !!x)),
  ];
  const { data: profiles } = userIds.length
    ? await sb.from("profiles").select("*").in("id", userIds)
    : { data: [] as Profile[] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  return Promise.all(
    docs.map(async (d) => {
      const { data } = await sb.storage.from(d.bucket).createSignedUrl(d.storage_path, 600);
      return {
        ...d,
        url: data?.signedUrl ?? null,
        uploader: d.uploaded_by ? (profileById.get(d.uploaded_by) ?? null) : null,
        forUser: d.for_user_id ? (profileById.get(d.for_user_id) ?? null) : null,
      };
    }),
  );
}
