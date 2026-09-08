import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * The conversion funnel, counted from our own tables rather than an analytics vendor.
 *
 * What that buys: these numbers reconcile against bookings and payments, need no extra service,
 * and cannot be lost to an ad blocker. What it costs: everything before a traveler signs in and
 * opens the builder is invisible here — visits, trip-page views and bounces live in GA4 and
 * PostHog. The page says so rather than implying this is the whole story.
 *
 * Stages, each a real row we can point at:
 *   started    builder_drafts        a saved configuration (signed in; anonymous drafts stay local)
 *   booked     bookings              a booking row exists (draft or pending_payment)
 *   confirmed  bookings.status       payment cleared the webhook
 *   paid       bookings.payment_status = 'paid'
 *
 * A booking is counted at the furthest stage it reached, so the stages nest and a drop-off is a
 * real loss rather than a double count.
 */

export interface FunnelStage {
  key: "started" | "booked" | "confirmed" | "paid";
  label: string;
  hint: string;
  count: number;
}

export interface FunnelWeek {
  /** Monday of the week, ISO date. */
  weekStart: string;
  started: number;
  booked: number;
  confirmed: number;
  paid: number;
}

export interface FunnelDeparture {
  departureId: string;
  tourName: string;
  startDate: string;
  started: number;
  booked: number;
  confirmed: number;
  paid: number;
}

export interface FunnelReport {
  since: string;
  days: number;
  stages: FunnelStage[];
  weeks: FunnelWeek[];
  departures: FunnelDeparture[];
  /** True when nothing at all has happened in the window — the page says so instead of drawing zeros. */
  empty: boolean;
}

function mondayOf(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

export async function getFunnel(days = 90): Promise<FunnelReport> {
  const sb = await createClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const [{ data: drafts }, { data: bookings }, { data: departures }] = await Promise.all([
    sb.from("builder_drafts").select("departure_id, updated_at").gte("updated_at", since),
    sb
      .from("bookings")
      .select("id, departure_id, status, payment_status, created_at")
      .gte("created_at", since),
    sb.from("departures").select("id, start_date, tour_versions(tours(name))"),
  ]);

  const draftRows = drafts ?? [];
  const bookingRows = bookings ?? [];

  // A cancelled or refunded booking still counts as "booking created" — it is a loss, not an absence.
  const isConfirmed = (b: { status: string }) => ["confirmed", "completed"].includes(b.status);
  const isPaid = (b: { payment_status: string }) => b.payment_status === "paid";

  const stages: FunnelStage[] = [
    {
      key: "started",
      label: "Started building",
      hint: "A saved configuration in the builder",
      count: draftRows.length,
    },
    {
      key: "booked",
      label: "Booking created",
      hint: "Reached checkout and a booking row exists",
      count: bookingRows.length,
    },
    {
      key: "confirmed",
      label: "Confirmed",
      hint: "Payment cleared the Stripe webhook",
      count: bookingRows.filter(isConfirmed).length,
    },
    {
      key: "paid",
      label: "Paid in full",
      hint: "Balance settled, not just the deposit",
      count: bookingRows.filter(isPaid).length,
    },
  ];

  // ── By week ────────────────────────────────────────────────────────────────
  const weekMap = new Map<string, FunnelWeek>();
  const week = (iso: string): FunnelWeek => {
    const key = mondayOf(iso);
    const existing = weekMap.get(key);
    if (existing) return existing;
    const fresh: FunnelWeek = { weekStart: key, started: 0, booked: 0, confirmed: 0, paid: 0 };
    weekMap.set(key, fresh);
    return fresh;
  };
  for (const d of draftRows) week(d.updated_at).started += 1;
  for (const b of bookingRows) {
    const w = week(b.created_at);
    w.booked += 1;
    if (isConfirmed(b)) w.confirmed += 1;
    if (isPaid(b)) w.paid += 1;
  }
  const weeks = [...weekMap.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  // ── By departure ───────────────────────────────────────────────────────────
  type DepartureMeta = { startDate: string; tourName: string };
  const meta = new Map<string, DepartureMeta>();
  for (const d of departures ?? []) {
    const versions = d.tour_versions as { tours: { name: string } | null } | null;
    meta.set(d.id, {
      startDate: d.start_date,
      tourName: versions?.tours?.name ?? "Unknown trip",
    });
  }

  const byDeparture = new Map<string, FunnelDeparture>();
  const departureRow = (id: string): FunnelDeparture => {
    const existing = byDeparture.get(id);
    if (existing) return existing;
    const m = meta.get(id);
    const fresh: FunnelDeparture = {
      departureId: id,
      tourName: m?.tourName ?? "Unknown trip",
      startDate: m?.startDate ?? "",
      started: 0,
      booked: 0,
      confirmed: 0,
      paid: 0,
    };
    byDeparture.set(id, fresh);
    return fresh;
  };
  for (const d of draftRows) departureRow(d.departure_id).started += 1;
  for (const b of bookingRows) {
    const row = departureRow(b.departure_id);
    row.booked += 1;
    if (isConfirmed(b)) row.confirmed += 1;
    if (isPaid(b)) row.paid += 1;
  }

  const departureRows = [...byDeparture.values()].sort(
    (a, b) => b.started + b.booked - (a.started + a.booked),
  );

  return {
    since,
    days,
    stages,
    weeks,
    departures: departureRows,
    empty: draftRows.length === 0 && bookingRows.length === 0,
  };
}

/** Percentage of the previous stage that survived, for the drop-off column. */
export function stageRate(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round((current / previous) * 100);
}
