import "server-only";

import type { Tables } from "@guideless/types";
import { daysBetween } from "@guideless/utils";
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
