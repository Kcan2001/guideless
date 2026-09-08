"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { reviewFormSchema } from "@guideless/validation";
import { formToObject } from "@/lib/admin/form";
import { createClient } from "@/lib/supabase/server";

/**
 * A traveler writing about a trip they took. Eligibility is checked by `submit_review()` in the
 * database, so this action only has to turn a refusal into a sentence a person can act on.
 */

const HINTS: Record<string, string> = {
  auth_required: "Sign in first.",
  not_eligible: "You can review a trip once it has ended.",
  already_reviewed: "You have already written about this trip. Thank you.",
};

function back(kind: "notice" | "error_msg", message: string): never {
  const params = new URLSearchParams({ [kind]: message });
  redirect(`/account?${params.toString()}#reviews` as Route);
}

export async function submitReviewAction(fd: FormData): Promise<void> {
  const parsed = reviewFormSchema.safeParse(formToObject(fd));
  if (!parsed.success) {
    back("error_msg", parsed.error.issues[0]?.message ?? "Check the form and try again.");
  }
  const { bookingId, rating, title, body, wouldRepeat } = parsed.data;

  const sb = await createClient();
  const { error } = await sb.rpc("submit_review", {
    p_booking_id: bookingId,
    p_rating: rating,
    p_body: body,
    p_title: title ?? undefined,
    p_would_repeat: wouldRepeat ?? undefined,
  });
  if (error) {
    back("error_msg", HINTS[error.hint ?? ""] ?? "Could not save that. Try again.");
  }

  revalidatePath("/account");
  revalidatePath("/reviews");
  back("notice", "Thank you. We read every review before it goes up.");
}
