"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  cancellationRequestSchema,
  emergencyContactUpdateSchema,
  travelerUpdateSchema,
  uuidSchema,
} from "@guideless/validation";
import { formToObject } from "@/lib/admin/form";
import { RATE_LIMITED_MESSAGE, withinRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * Customer self-service on /account (spec §85 "Complete profile", docs/pricing.md → Cancellations).
 * Every write goes through the customer's own session so RLS decides: travelers they own, the
 * emergency contact of a traveler they own, and cancellation requests via security-definer RPCs.
 * Outcomes land back on /account as a one-line message.
 */

function back(status: "ok" | "error", message: string, anchor?: string): never {
  const q = new URLSearchParams({ [status === "ok" ? "notice" : "error_msg"]: message });
  redirect(`/account?${q}${anchor ? `#${anchor}` : ""}` as Route);
}

export async function updateTraveler(fd: FormData): Promise<void> {
  const travelerId = uuidSchema.safeParse(fd.get("travelerId"));
  if (!travelerId.success) back("error", "That traveler link didn't look right.");
  const anchor = `traveler-${travelerId.data}`;
  const parsed = travelerUpdateSchema.safeParse(formToObject(fd));
  if (!parsed.success) {
    back("error", parsed.error.issues[0]?.message ?? "Please check the traveler details.", anchor);
  }
  const t = parsed.data;
  const sb = await createClient();
  const { data, error } = await sb
    .from("traveler_profiles")
    .update({
      preferred_name: t.preferredName ?? null,
      email: t.email ?? null,
      phone: t.phone ?? null,
      date_of_birth: t.dateOfBirth,
      nationality: t.nationality,
      dietary_requirements: t.dietaryRequirements ?? null,
      accessibility_notes: t.accessibilityNotes ?? null,
    })
    .eq("id", travelerId.data)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    console.error("traveler update failed", error);
    back("error", "We couldn't save those details. Please try again.", anchor);
  }
  revalidatePath("/account");
  back("ok", "Traveler details saved.", anchor);
}

export async function updateEmergencyContact(fd: FormData): Promise<void> {
  const travelerId = uuidSchema.safeParse(fd.get("travelerId"));
  if (!travelerId.success) back("error", "That traveler link didn't look right.");
  const anchor = `traveler-${travelerId.data}`;
  const parsed = emergencyContactUpdateSchema.safeParse(formToObject(fd));
  if (!parsed.success) {
    back("error", parsed.error.issues[0]?.message ?? "Please check the emergency contact.", anchor);
  }
  const c = parsed.data;
  const sb = await createClient();
  // One primary contact per traveler: update it if present, otherwise create it.
  const { data: existing } = await sb
    .from("emergency_contacts")
    .select("id")
    .eq("traveler_id", travelerId.data)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();
  const payload = {
    traveler_id: travelerId.data,
    name: c.name,
    relationship: c.relationship,
    phone: c.phone,
    email: c.email ?? null,
    is_primary: true,
  };
  const { error } = existing
    ? await sb.from("emergency_contacts").update(payload).eq("id", existing.id)
    : await sb.from("emergency_contacts").insert(payload);
  if (error) {
    console.error("emergency contact update failed", error);
    back("error", "We couldn't save the emergency contact. Please try again.", anchor);
  }
  revalidatePath("/account");
  back("ok", "Emergency contact saved.", anchor);
}

const CANCEL_HINTS: Record<string, string> = {
  auth_required: "Please sign in again.",
  not_found: "We couldn't find that booking.",
  not_cancellable: "Only confirmed bookings can be cancelled here. Email us and we'll help.",
  started: "This trip has already started. Talk to support in the app and we'll sort it out.",
  already_requested: "A cancellation request is already open for this booking.",
  reason: "Tell us briefly why you're cancelling.",
};

export async function requestCancellation(fd: FormData): Promise<void> {
  const parsed = cancellationRequestSchema.safeParse({
    bookingId: fd.get("bookingId"),
    reason: fd.get("reason"),
  });
  if (!parsed.success) back("error", parsed.error.issues[0]?.message ?? "Please check the form.");
  const anchor = `booking-${parsed.data.bookingId}`;
  if (!(await withinRateLimit("cancellation", 10, 3600)))
    back("error", RATE_LIMITED_MESSAGE, anchor);
  const sb = await createClient();
  const { error } = await sb.rpc("request_cancellation", {
    p_booking_id: parsed.data.bookingId,
    p_reason: parsed.data.reason,
  });
  if (error) {
    const hint = (error as { hint?: string }).hint ?? "";
    back(
      "error",
      CANCEL_HINTS[hint] ?? "We couldn't submit the request. Please try again or email us.",
      anchor,
    );
  }
  revalidatePath("/account");
  back(
    "ok",
    "Cancellation requested. We'll confirm within two business days; nothing changes until then.",
    anchor,
  );
}

export async function withdrawCancellation(fd: FormData): Promise<void> {
  const requestId = uuidSchema.safeParse(fd.get("requestId"));
  if (!requestId.success) back("error", "That request link didn't look right.");
  const sb = await createClient();
  const { data, error } = await sb.rpc("withdraw_cancellation_request", {
    p_request_id: requestId.data,
  });
  if (error || data !== true) back("error", "That request is no longer pending.");
  revalidatePath("/account");
  back("ok", "Cancellation request withdrawn. Your booking stands as it was.");
}
