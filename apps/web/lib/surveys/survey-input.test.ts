import { describe, expect, it } from "vitest";
import { surveyAnswers, surveyFormSchema, surveyIsEmpty } from "@guideless/validation";

/**
 * The survey schemas, exercised the way a form actually posts: everything is a string, an
 * unanswered question is absent rather than empty, and nothing is required.
 *
 * These are the cases that turn into bad data rather than errors — a "" written over an answer, a
 * "no" stored as "not answered", a score arriving as text — so they are worth pinning down here
 * rather than discovering in the averages six months from now.
 */

const bookingId = "0f9e6a52-2b3c-4d5e-8f10-1a2b3c4d5e6f";

describe("post-trip survey", () => {
  it("coerces scores from the strings a radio group posts", () => {
    const parsed = surveyFormSchema.parse({
      bookingId,
      kind: "post_trip",
      overall: "5",
      accommodation: "3",
    });
    expect(parsed).toMatchObject({ overall: 5, accommodation: 3 });
  });

  it("treats an unanswered score as unanswered, not as a zero", () => {
    const parsed = surveyFormSchema.parse({ bookingId, kind: "post_trip", overall: "4" });
    expect(parsed.kind === "post_trip" && parsed.freedom).toBeUndefined();
  });

  it("refuses a score outside 1 to 5", () => {
    const result = surveyFormSchema.safeParse({ bookingId, kind: "post_trip", overall: "6" });
    expect(result.success).toBe(false);
  });

  // A checkbox cannot say "no", and here "no" is the answer that matters most.
  it("keeps 'no' distinct from 'not answered'", () => {
    const no = surveyFormSchema.parse({ bookingId, kind: "post_trip", wouldRepeat: "no" });
    const unanswered = surveyFormSchema.parse({ bookingId, kind: "post_trip", overall: "3" });
    expect(no.kind === "post_trip" && no.wouldRepeat).toBe(false);
    expect(unanswered.kind === "post_trip" && unanswered.wouldRepeat).toBeUndefined();
  });

  // A blank textarea posts "", which would otherwise overwrite a previous answer with an empty
  // string rather than leaving it alone.
  it("turns blank text into nothing at all", () => {
    const parsed = surveyFormSchema.parse({
      bookingId,
      kind: "post_trip",
      bestBit: "   ",
      worstBit: "The train was cold",
    });
    expect(parsed.kind === "post_trip" && parsed.bestBit).toBeUndefined();
    expect(parsed.kind === "post_trip" && parsed.worstBit).toBe("The train was cold");
  });

  it("has no jsonb answers of its own — everything it asks has a column", () => {
    const parsed = surveyFormSchema.parse({ bookingId, kind: "post_trip", overall: "5" });
    expect(surveyAnswers(parsed)).toEqual({});
  });
});

describe("pre-trip survey", () => {
  it("puts the questions without a column into the jsonb payload, under stable keys", () => {
    const parsed = surveyFormSchema.parse({
      bookingId,
      kind: "pre_trip",
      expectations: "Somewhere to swim every morning",
      pace: "relaxed",
      heardAbout: "instagram",
    });
    expect(surveyAnswers(parsed)).toEqual({ pace: "relaxed", heard_about: "instagram" });
    expect(parsed.expectations).toBe("Somewhere to swim every morning");
  });

  it("refuses a choice that is not on the form", () => {
    const result = surveyFormSchema.safeParse({ bookingId, kind: "pre_trip", pace: "frantic" });
    expect(result.success).toBe(false);
  });

  // Before a trip there is nothing to score, so a score posted against one is not stored.
  it("drops scores, which belong to the other survey", () => {
    const parsed = surveyFormSchema.parse({ bookingId, kind: "pre_trip", overall: "5" });
    expect(parsed).not.toHaveProperty("overall");
  });
});

describe("an empty submission", () => {
  it("is recognised before it reaches the database", () => {
    expect(surveyIsEmpty(surveyFormSchema.parse({ bookingId, kind: "pre_trip" }))).toBe(true);
    expect(surveyIsEmpty(surveyFormSchema.parse({ bookingId, kind: "post_trip" }))).toBe(true);
  });

  it("is not confused with a survey answered in one place only", () => {
    const oneScore = surveyFormSchema.parse({ bookingId, kind: "post_trip", freedom: "2" });
    const oneLine = surveyFormSchema.parse({ bookingId, kind: "pre_trip", pace: "full" });
    expect(surveyIsEmpty(oneScore)).toBe(false);
    expect(surveyIsEmpty(oneLine)).toBe(false);
  });
});
