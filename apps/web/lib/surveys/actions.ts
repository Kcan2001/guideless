"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { surveyAnswers, surveyFormSchema, surveyIsEmpty } from "@guideless/validation";
import { formToObject } from "@/lib/admin/form";
import { createClient } from "@/lib/supabase/server";

/**
 * A traveler answering their own survey. Eligibility is checked by `submit_trip_survey()` in the
 * database — their booking, and the right side of the trip's end date — so this action only has to
 * turn a refusal into a sentence a person can act on.
 *
 * Nothing here is required. A survey that refuses to submit until it is complete is a survey people
 * abandon, so a half-answered one is saved as-is and the traveler can come back to it.
 */

const HINTS: Record<string, string> = {
  auth_required: "Sign in first.",
  not_eligible:
    "That survey is not open. The one before a trip closes when the trip does, and the one after opens the day it ends.",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * An error goes back to the form so the answers are still on screen; success goes to the account
 * page. A booking id we cannot trust has no form to go back to, so it lands on the account page
 * either way rather than on a 404.
 */
function back(bookingId: string, kind: "notice" | "error_msg", message: string): never {
  const params = new URLSearchParams({ [kind]: message });
  redirect(
    (kind === "error_msg" && UUID.test(bookingId)
      ? `/account/surveys/${bookingId}?${params.toString()}`
      : `/account?${params.toString()}#surveys`) as Route,
  );
}

export async function submitSurveyAction(fd: FormData): Promise<void> {
  const raw = formToObject(fd);
  const bookingId = typeof raw.bookingId === "string" ? raw.bookingId : "";
  const parsed = surveyFormSchema.safeParse(raw);
  if (!parsed.success) {
    back(
      bookingId,
      "error_msg",
      parsed.error.issues[0]?.message ?? "Check the form and try again.",
    );
  }
  const input = parsed.data;

  if (surveyIsEmpty(input)) {
    back(input.bookingId, "error_msg", "Nothing was filled in, so nothing was saved.");
  }

  const post = input.kind === "post_trip" ? input : null;
  const sb = await createClient();
  const { error } = await sb.rpc("submit_trip_survey", {
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
    back(
      input.bookingId,
      "error_msg",
      HINTS[error.hint ?? ""] ?? "Could not save that. Try again.",
    );
  }

  revalidatePath("/account");
  revalidatePath(`/account/surveys/${input.bookingId}`);
  back(
    input.bookingId,
    "notice",
    input.kind === "pre_trip"
      ? "Thank you. We read these before the trip, not after it."
      : "Thank you. This is the part that changes what we do next.",
  );
}
