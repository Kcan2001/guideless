import "server-only";

import { formatMicros } from "@/lib/assistant/cost";
import { createClient } from "@/lib/supabase/server";

/**
 * What the assistant is costing, for staff.
 *
 * Counts and money only. There is no query in this file that could return a traveler's question,
 * because there is no policy that would let one through: `ai_messages` has no staff read policy at
 * all. That is the design, not an omission — the assistant is only useful if people ask it blunt
 * things, and they only do that if nobody at the company is reading.
 */

export interface AssistantSpendRow {
  bookingId: string;
  confirmationNumber: string;
  tourName: string;
  travelers: number;
  messages: number;
  costMicros: number;
  cost: string;
  lastUsed: string;
}

export interface AssistantSpendSummary {
  rows: AssistantSpendRow[];
  totalMicros: number;
  total: string;
  messages: number;
  /** Travelers who hit the daily cap today — the signal that the cap is too low, or someone is looping. */
  atLimitToday: number;
  last30Micros: number;
  last30: string;
}

interface CostRow {
  booking_id: string;
  travelers: number;
  messages: number;
  cost_micros: number;
  last_used: string;
}

export async function getAssistantSpend(): Promise<AssistantSpendSummary> {
  const sb = await createClient();

  const [{ data: costs, error }, { data: today }, { data: recent }, { data: limit }] =
    await Promise.all([
      sb
        .from("ai_cost_by_booking")
        .select("*")
        .order("cost_micros", { ascending: false })
        .limit(100),
      sb
        .from("ai_usage")
        .select("messages")
        .eq("usage_date", new Date().toISOString().slice(0, 10)),
      sb
        .from("ai_usage")
        .select("cost_micros")
        .gte("usage_date", new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)),
      sb.rpc("ai_daily_limit"),
    ]);
  if (error) throw error;

  const rows = (costs ?? []) as unknown as CostRow[];
  const bookingIds = rows.map((r) => r.booking_id);
  const names = new Map<string, { confirmation: string; tour: string }>();
  if (bookingIds.length > 0) {
    // The view is an aggregate, so PostgREST has no foreign key to follow — the labels are a
    // second query, as on the surveys screen.
    const { data: bookings } = await sb
      .from("bookings")
      .select("id, confirmation_number, tour_versions(tours(name))")
      .in("id", bookingIds);
    for (const b of (bookings ?? []) as unknown as Array<{
      id: string;
      confirmation_number: string;
      tour_versions: { tours: { name: string } | null } | null;
    }>) {
      names.set(b.id, {
        confirmation: b.confirmation_number,
        tour: b.tour_versions?.tours?.name ?? "",
      });
    }
  }

  const cap = typeof limit === "number" ? limit : 40;
  const totalMicros = rows.reduce((sum, r) => sum + r.cost_micros, 0);
  const last30Micros = (recent ?? []).reduce((sum, r) => sum + r.cost_micros, 0);

  return {
    rows: rows.map((r) => ({
      bookingId: r.booking_id,
      confirmationNumber: names.get(r.booking_id)?.confirmation ?? "—",
      tourName: names.get(r.booking_id)?.tour ?? "",
      travelers: r.travelers,
      messages: r.messages,
      costMicros: r.cost_micros,
      cost: formatMicros(r.cost_micros),
      lastUsed: r.last_used,
    })),
    totalMicros,
    total: formatMicros(totalMicros),
    messages: rows.reduce((sum, r) => sum + r.messages, 0),
    atLimitToday: (today ?? []).filter((u) => u.messages >= cap).length,
    last30Micros,
    last30: formatMicros(last30Micros),
  };
}
