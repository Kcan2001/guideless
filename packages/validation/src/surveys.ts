import { z } from "zod";
import { SURVEY_KINDS } from "@guideless/types";
import { uuidSchema } from "./common";

/**
 * Private feedback, before and after a trip (migrations 0057–0058). `submit_trip_survey()` is the
 * real gate — it refuses a booking that is not yours and a post-trip survey on a trip that has not
 * ended — so these schemas exist to give a person a sentence instead of a Postgres error, and to
 * keep web and mobile asking the same questions in the same words.
 *
 * The two kinds ask genuinely different things, which is why this is a discriminated union rather
 * than one schema with everything optional. Before a trip there is nothing to score: the only
 * useful questions are what somebody is hoping for and what they think they booked. After it,
 * scoring is most of the value and the prose is the part that changes the product.
 */

export const surveyKindSchema = z.enum(SURVEY_KINDS);

/** Blank optional text arrives from a form as "", which is not the same as "not answered". */
const optionalText = (max: number, message?: string) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max, message).optional(),
  );

/**
 * Every score is optional on purpose: the table allows nulls because a survey that refuses to
 * submit until it is complete is a survey people abandon. An unanswered radio group posts nothing.
 */
const optionalScore = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce
    .number()
    .int("Scores are whole numbers")
    .min(1, "Scores run from 1 to 5")
    .max(5, "Scores run from 1 to 5")
    .optional(),
);

/** A tri-state: yes, no, or not answered. A checkbox cannot express "no", and here "no" matters. */
const optionalBoolean = z.preprocess(
  (v) =>
    v === undefined || v === null || v === ""
      ? undefined
      : v === "yes" || v === "true" || v === "on" || v === true,
  z.boolean().optional(),
);

const TEXT_MAX = 2000;

/**
 * The pace someone believes they booked. This is the specific mismatch the survey exists to catch:
 * a traveler who books a "relaxed" week expecting a spa and finds a wine cellar. Values are stable
 * strings because they are compared across departures long after the wording on the form changes.
 */
export const SURVEY_PACE_OPTIONS = [
  { value: "relaxed", label: "Slow — long lunches, little planned" },
  { value: "balanced", label: "Balanced — something each day, time to myself" },
  { value: "full", label: "Full — out from morning to night" },
] as const;
export type SurveyPace = (typeof SURVEY_PACE_OPTIONS)[number]["value"];

/** Where somebody found us. Asked before the trip, while the answer is still recent and true. */
export const SURVEY_HEARD_ABOUT_OPTIONS = [
  { value: "friend", label: "A friend or someone who travelled with us" },
  { value: "instagram", label: "Instagram" },
  { value: "search", label: "A search engine" },
  { value: "pinterest", label: "Pinterest" },
  { value: "press", label: "An article or a newsletter" },
  { value: "other", label: "Somewhere else" },
] as const;
export type SurveyHeardAbout = (typeof SURVEY_HEARD_ABOUT_OPTIONS)[number]["value"];

const optionalChoice = <T extends readonly { value: string }[]>(options: T) =>
  z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.enum(options.map((o) => o.value) as [string, ...string[]]).optional(),
  );

export const preTripSurveySchema = z.object({
  bookingId: uuidSchema,
  kind: z.literal("pre_trip"),
  expectations: optionalText(TEXT_MAX, "Keep it under 2,000 characters"),
  pace: optionalChoice(SURVEY_PACE_OPTIONS),
  heardAbout: optionalChoice(SURVEY_HEARD_ABOUT_OPTIONS),
});
export type PreTripSurveyInput = z.infer<typeof preTripSurveySchema>;

export const postTripSurveySchema = z.object({
  bookingId: uuidSchema,
  kind: z.literal("post_trip"),
  overall: optionalScore,
  accommodation: optionalScore,
  valueForMoney: optionalScore,
  groupFeeling: optionalScore,
  organisation: optionalScore,
  freedom: optionalScore,
  bestBit: optionalText(TEXT_MAX, "Keep it under 2,000 characters"),
  worstBit: optionalText(TEXT_MAX, "Keep it under 2,000 characters"),
  expectations: optionalText(TEXT_MAX, "Keep it under 2,000 characters"),
  wouldRepeat: optionalBoolean,
});
export type PostTripSurveyInput = z.infer<typeof postTripSurveySchema>;

export const surveyFormSchema = z.discriminatedUnion("kind", [
  preTripSurveySchema,
  postTripSurveySchema,
]);
export type SurveyFormInput = z.infer<typeof surveyFormSchema>;

/**
 * The scored questions, in the order they are asked, with the wording shared by web and mobile.
 * Kept here rather than in either app so the two never drift into asking subtly different things
 * and then averaging the answers together.
 */
export const POST_TRIP_SCORES = [
  {
    field: "overall",
    column: "p_overall",
    label: "The trip overall",
  },
  {
    field: "accommodation",
    column: "p_accommodation",
    label: "Where you stayed",
  },
  {
    field: "valueForMoney",
    column: "p_value_for_money",
    label: "What it cost for what you got",
  },
  {
    field: "groupFeeling",
    column: "p_group_feeling",
    label: "The group",
  },
  {
    field: "organisation",
    column: "p_organisation",
    label: "How well it was organised",
  },
  {
    field: "freedom",
    column: "p_freedom",
    label: "How free your days felt",
  },
] as const satisfies ReadonlyArray<{
  field: keyof PostTripSurveyInput;
  column: string;
  label: string;
}>;

export const SCORE_ENDS = { low: "Poor", high: "Excellent" } as const;

/**
 * The jsonb `answers` payload for a submission. Only the questions that have no column of their
 * own go here; everything typed stays typed. Keys are stable, values are the option ids above.
 */
export function surveyAnswers(input: SurveyFormInput): Record<string, string> {
  if (input.kind !== "pre_trip") return {};
  const answers: Record<string, string> = {};
  if (input.pace) answers.pace = input.pace;
  if (input.heardAbout) answers.heard_about = input.heardAbout;
  return answers;
}

/** Whether anything at all was said. Submitting an entirely blank survey is not worth a round trip. */
export function surveyIsEmpty(input: SurveyFormInput): boolean {
  if (input.kind === "pre_trip") {
    return !input.expectations && !input.pace && !input.heardAbout;
  }
  return (
    POST_TRIP_SCORES.every((s) => input[s.field] === undefined) &&
    !input.bestBit &&
    !input.worstBit &&
    !input.expectations &&
    input.wouldRepeat === undefined
  );
}
