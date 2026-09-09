import "server-only";

import type { SurveyKind } from "@guideless/types";
import { POST_TRIP_SCORES } from "@guideless/validation";
import { createClient } from "@/lib/supabase/server";

/**
 * What staff read. Runs as the signed-in staff user, so RLS is doing the work: `trip_surveys`
 * lets any staff member read every row and lets everybody else read only their own, which means a
 * non-staff account reaching this code gets an empty screen rather than a leak.
 *
 * Surveys are operational, not marketing. Nothing here is ever rendered on a public page, and the
 * traveler's name is included on purpose: unlike a review, this is a conversation we may need to
 * follow up on.
 */

export interface SurveyStat {
  tourId: string;
  tourName: string;
  kind: SurveyKind;
  responses: number;
  scores: Array<{ label: string; value: number | null }>;
  wouldRepeat: number;
}

export interface SurveyResponse {
  id: string;
  kind: SurveyKind;
  tourName: string;
  tripName: string;
  travelerName: string;
  submittedAt: string;
  overall: number | null;
  scores: Array<{ label: string; value: number | null }>;
  bestBit: string | null;
  worstBit: string | null;
  expectations: string | null;
  wouldRepeat: boolean | null;
  answers: Record<string, string>;
}

interface StatRow {
  tour_id: string;
  kind: SurveyKind;
  responses: number;
  overall: number | null;
  accommodation: number | null;
  value_for_money: number | null;
  group_feeling: number | null;
  organisation: number | null;
  freedom: number | null;
  would_repeat: number;
}

interface ResponseRow {
  id: string;
  kind: SurveyKind;
  user_id: string;
  submitted_at: string;
  overall: number | null;
  accommodation: number | null;
  value_for_money: number | null;
  group_feeling: number | null;
  organisation: number | null;
  freedom: number | null;
  best_bit: string | null;
  worst_bit: string | null;
  expectations: string | null;
  would_repeat: boolean | null;
  answers: Record<string, string> | null;
  tours: { name: string } | null;
  trips: { name: string } | null;
}

/** The six scored questions in their shared order, so a row and a summary read the same way. */
const SCORE_COLUMNS = [
  ["overall", "overall"],
  ["accommodation", "accommodation"],
  ["value_for_money", "valueForMoney"],
  ["group_feeling", "groupFeeling"],
  ["organisation", "organisation"],
  ["freedom", "freedom"],
] as const;

function scoresOf(row: Record<string, unknown>): Array<{ label: string; value: number | null }> {
  return SCORE_COLUMNS.map(([column, field]) => {
    const raw = row[column];
    const label = POST_TRIP_SCORES.find((s) => s.field === field)?.label ?? column;
    return { label, value: raw === null || raw === undefined ? null : Number(raw) };
  });
}

/**
 * Averages per tour and kind. The view has no row for a tour nobody has answered about, and the
 * response count travels with the averages so nobody reads a 5.0 from one answer as a signal.
 */
export async function listSurveyStats(): Promise<SurveyStat[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("tour_survey_stats")
    .select(
      "tour_id, kind, responses, overall, accommodation, value_for_money, group_feeling, " +
        "organisation, freedom, would_repeat",
    );
  if (error) throw error;
  const rows = (data ?? []) as unknown as StatRow[];

  // An aggregate view has no foreign keys for PostgREST to follow, so the tour names are a
  // second query rather than an embed.
  const names = new Map<string, string>();
  if (rows.length > 0) {
    const { data: tours } = await sb
      .from("tours")
      .select("id, name")
      .in("id", [...new Set(rows.map((r) => r.tour_id))]);
    for (const t of tours ?? []) names.set(t.id, t.name);
  }

  return rows
    .map((r) => ({
      tourId: r.tour_id,
      tourName: names.get(r.tour_id) ?? "",
      kind: r.kind,
      responses: r.responses,
      scores: scoresOf(r as unknown as Record<string, unknown>),
      wouldRepeat: r.would_repeat,
    }))
    .sort((a, b) => b.responses - a.responses || a.tourName.localeCompare(b.tourName));
}

/** Recent answers in full, newest first. The free text is the reason to open this page. */
export async function listSurveyResponses(limit = 100): Promise<SurveyResponse[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("trip_surveys")
    .select(
      "id, kind, user_id, submitted_at, overall, accommodation, value_for_money, group_feeling, " +
        "organisation, freedom, best_bit, worst_bit, expectations, would_repeat, answers, " +
        "tours(name), trips(name)",
    )
    .order("submitted_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as unknown as ResponseRow[];

  // `user_id` points at auth.users, not profiles, so the name is a second query rather than an
  // embed. Staff may read every profile; a missing one is a traveler who never set a name.
  const names = new Map<string, string>();
  if (rows.length > 0) {
    const { data: profiles } = await sb
      .from("profiles")
      .select("id, display_name")
      .in("id", [...new Set(rows.map((r) => r.user_id))]);
    for (const p of profiles ?? []) names.set(p.id, p.display_name);
  }

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    tourName: r.tours?.name ?? "",
    tripName: r.trips?.name ?? "",
    travelerName: (names.get(r.user_id) ?? "").trim() || "Unnamed traveler",
    submittedAt: r.submitted_at,
    overall: r.overall,
    scores: scoresOf(r as unknown as Record<string, unknown>),
    bestBit: r.best_bit,
    worstBit: r.worst_bit,
    expectations: r.expectations,
    wouldRepeat: r.would_repeat,
    answers: r.answers ?? {},
  }));
}
