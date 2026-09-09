import type { SurveyKind } from "@guideless/types";
import { surveyAnswers, type SurveyFormInput } from "@guideless/validation";
import { supabase } from "@/lib/supabase";

/**
 * Private feedback, before and after a trip. Eligibility lives in the database — `open_surveys()`
 * returns only what this traveler may answer, and `submit_trip_survey()` refuses anything else — so
 * this layer only carries the request and turns a refusal into something a person can read.
 *
 * Surveys are not reviews. Nothing answered here is ever published, and the copy in the app says so
 * plainly, because a blunt answer is the useful one and people only give it when they believe it.
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
  submittedAt: string | null;
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
}

export const surveyService = {
  /** Surveys open for this traveler right now. Empty for everyone else, so no call site needs a guard. */
  async open(): Promise<OpenSurvey[]> {
    const { data, error } = await supabase.rpc("open_surveys");
    if (error) {
      if (error.code === "42501") return [];
      throw error;
    }
    return (data ?? []).map((r) => ({
      bookingId: r.booking_id,
      tripId: r.trip_id as string | null,
      tourId: r.tour_id,
      tourName: r.tour_name,
      tripName: r.trip_name,
      startDate: r.start_date,
      endDate: r.end_date,
      kind: r.kind,
      submittedAt: (r.submitted_at as string | null) ?? null,
    }));
  },

  /** What they said last time, so the form opens filled in. Answering again edits the same row. */
  async answers(bookingId: string, kind: SurveyKind): Promise<SurveyAnswers | null> {
    const { data, error } = await supabase
      .from("trip_surveys")
      .select(
        "overall, accommodation, value_for_money, group_feeling, organisation, freedom, best_bit, worst_bit, expectations, would_repeat, answers",
      )
      .eq("booking_id", bookingId)
      .eq("kind", kind)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      overall: data.overall,
      accommodation: data.accommodation,
      valueForMoney: data.value_for_money,
      groupFeeling: data.group_feeling,
      organisation: data.organisation,
      freedom: data.freedom,
      bestBit: data.best_bit,
      worstBit: data.worst_bit,
      expectations: data.expectations,
      wouldRepeat: data.would_repeat,
      answers: (data.answers ?? {}) as Record<string, string>,
    };
  },

  async submit(input: SurveyFormInput): Promise<void> {
    const post = input.kind === "post_trip" ? input : null;
    const { error } = await supabase.rpc("submit_trip_survey", {
      p_booking_id: input.bookingId,
      p_kind: input.kind,
      p_overall: post?.overall,
      p_accommodation: post?.accommodation,
      p_value_for_money: post?.valueForMoney,
      p_group_feeling: post?.groupFeeling,
      p_organisation: post?.organisation,
      p_freedom: post?.freedom,
      p_best_bit: post?.bestBit,
      p_worst_bit: post?.worstBit,
      p_would_repeat: post?.wouldRepeat,
      p_expectations: input.expectations,
      p_answers: surveyAnswers(input),
    });
    if (error) {
      if (error.hint === "not_eligible")
        throw new Error(
          "That survey is not open any more. Nothing was lost — write to us instead.",
        );
      throw new Error("Could not send that. Try again.");
    }
  },
};
