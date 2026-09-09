import "server-only";

import type { SurveyKind } from "@guideless/types";
import { createClient } from "@/lib/supabase/server";

/**
 * Reading surveys. Everything here runs as the signed-in traveler, so row-level security is the
 * boundary: `open_surveys()` returns their bookings and nobody else's, and a direct select on
 * `trip_surveys` can only ever see their own answers.
 *
 * Surveys are private. Nothing in this module is used by a public page, and nothing in it should
 * be: reviews are the public surface and they live in `lib/reviews`.
 */

export interface OpenSurvey {
  bookingId: string;
  tripId: string | null;
  tourId: string;
  tourName: string;
  tripName: string;
  startDate: string;
  endDate: string;
  kind: SurveyKind;
  /** When they last answered, or null if they have not. Answering again edits the same row. */
  submittedAt: string | null;
}

/** The generated RPC row types a `returns table` column as non-null; several of these are not. */
interface OpenSurveyRow {
  booking_id: string;
  trip_id: string | null;
  tour_id: string;
  tour_name: string;
  trip_name: string;
  start_date: string;
  end_date: string;
  kind: SurveyKind;
  submitted_at: string | null;
}

function toSurvey(row: OpenSurveyRow): OpenSurvey {
  return {
    bookingId: row.booking_id,
    tripId: row.trip_id,
    tourId: row.tour_id,
    tourName: row.tour_name,
    tripName: row.trip_name,
    startDate: row.start_date,
    endDate: row.end_date,
    kind: row.kind,
    submittedAt: row.submitted_at,
  };
}

/**
 * Surveys the traveler may answer right now — at most one per booking, because the pre-trip survey
 * closes on the day the post-trip one opens. Empty for a signed-out visitor rather than an error,
 * so a page can call this without a guard.
 */
export async function listOpenSurveys(): Promise<OpenSurvey[]> {
  const sb = await createClient();
  const { data, error } = await sb.rpc("open_surveys");
  if (error) {
    if (error.code === "42501") return [];
    throw error;
  }
  return ((data ?? []) as unknown as OpenSurveyRow[]).map(toSurvey);
}

export async function getOpenSurvey(bookingId: string): Promise<OpenSurvey | null> {
  const all = await listOpenSurveys();
  return all.find((s) => s.bookingId === bookingId) ?? null;
}

/** Only the ones they have not answered — the prompts worth showing unasked. */
export async function listUnansweredSurveys(): Promise<OpenSurvey[]> {
  return (await listOpenSurveys()).filter((s) => s.submittedAt === null);
}

export interface SurveyAnswers {
  overall: number | null;
  accommodation: number | null;
  valueForMoney: number | null;
  groupFeeling: number | null;
  organisation: number | null;
  freedom: number | null;
  bestBit: string | null;
  worstBit: string | null;
  expectations: string | null;
  wouldRepeat: boolean | null;
  answers: Record<string, string>;
  submittedAt: string;
}

/**
 * What they said last time, so the form opens filled in rather than blank. Editing is the point:
 * `submit_trip_survey` upserts, and somebody who mistyped a score should be able to see and fix it.
 */
export async function getSurveyAnswers(
  bookingId: string,
  kind: SurveyKind,
): Promise<SurveyAnswers | null> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("trip_surveys")
    .select(
      "overall, accommodation, value_for_money, group_feeling, organisation, freedom, " +
        "best_bit, worst_bit, expectations, would_repeat, answers, submitted_at",
    )
    .eq("booking_id", bookingId)
    .eq("kind", kind)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as AnswerRow;
  return {
    overall: row.overall,
    accommodation: row.accommodation,
    valueForMoney: row.value_for_money,
    groupFeeling: row.group_feeling,
    organisation: row.organisation,
    freedom: row.freedom,
    bestBit: row.best_bit,
    worstBit: row.worst_bit,
    expectations: row.expectations,
    wouldRepeat: row.would_repeat,
    answers: row.answers ?? {},
    submittedAt: row.submitted_at,
  };
}

/** A column list built by concatenation is opaque to the generated select types, so name it here. */
interface AnswerRow {
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
  submitted_at: string;
}
