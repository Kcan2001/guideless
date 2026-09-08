"use server";

import { revalidatePath } from "next/cache";
import { waitlistJoinSchema, type WaitlistResult } from "@guideless/validation";
import { formToObject } from "@/lib/admin/form";
import { createClient } from "@/lib/supabase/server";

/**
 * "Tell me when this opens." Joining is public, so the same defences as the newsletter form:
 * a honeypot the browser hides, and a per-address rate limit inside `join_waitlist()`.
 */

export interface WaitlistState {
  ok: boolean;
  message: string;
}

const MESSAGES: Record<WaitlistResult, WaitlistState> = {
  joined: { ok: true, message: "You are on the list. We will write when it opens." },
  already_waiting: { ok: true, message: "You are already on the list — we updated your details." },
  rate_limited: { ok: false, message: "That is a lot of requests. Try again in an hour." },
  invalid_email: { ok: false, message: "That email address does not look right." },
  not_found: { ok: false, message: "We could not find that trip. Refresh and try again." },
};

export async function joinWaitlistAction(
  _prev: WaitlistState | null,
  fd: FormData,
): Promise<WaitlistState> {
  const parsed = waitlistJoinSchema.safeParse(formToObject(fd));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    // The honeypot is the only field a person cannot see, so name it kindly if it trips.
    if (issue?.path[0] === "company") return { ok: true, message: "You are on the list." };
    return { ok: false, message: issue?.message ?? "Check your details and try again." };
  }
  const { tourId, departureId, email, name, partySize, source } = parsed.data;

  const sb = await createClient();
  const { data, error } = await sb.rpc("join_waitlist", {
    p_tour_id: tourId,
    p_departure_id: departureId ?? undefined,
    p_email: email,
    p_name: name ?? undefined,
    p_party_size: partySize,
    p_source: source,
  });
  if (error) return { ok: false, message: "Something went wrong. Try again in a moment." };

  const result = (data as WaitlistResult | null) ?? "not_found";
  if (result === "joined") revalidatePath("/admin/waitlists");
  return MESSAGES[result] ?? MESSAGES.not_found;
}
