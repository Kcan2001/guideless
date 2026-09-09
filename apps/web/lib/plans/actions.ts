"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { travelerPlanFormSchema } from "@guideless/validation";
import { formToObject } from "@/lib/admin/form";
import { createClient } from "@/lib/supabase/server";

/**
 * Adding and removing a traveler's own plans by hand — the same table the assistant writes to, so
 * a plan a person typed and a plan the assistant suggested are the same kind of thing and can be
 * edited the same way. Only `source` tells them apart.
 */

function back(bookingId: string, kind: "notice" | "error_msg", message: string): never {
  const params = new URLSearchParams({ [kind]: message });
  redirect(`/account/assistant/${bookingId}?${params.toString()}#plans` as Route);
}

export async function addPlanAction(fd: FormData): Promise<void> {
  const raw = formToObject(fd);
  const bookingId = typeof raw.bookingId === "string" ? raw.bookingId : "";
  const parsed = travelerPlanFormSchema.safeParse({
    ...raw,
    latitude: raw.latitude ? Number(raw.latitude) : undefined,
    longitude: raw.longitude ? Number(raw.longitude) : undefined,
  });
  if (!parsed.success) {
    back(
      bookingId,
      "error_msg",
      parsed.error.issues[0]?.message ?? "Check the form and try again.",
    );
  }
  const plan = parsed.data;

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) back(plan.bookingId, "error_msg", "Sign in first.");

  // The trip is looked up rather than taken from the form: a booking id the traveler owns is
  // checked by RLS, a trip id posted from a browser is not.
  const { data: membership } = await sb
    .from("trip_members")
    .select("trip_id")
    .eq("booking_id", plan.bookingId)
    .is("removed_at", null)
    .maybeSingle();

  const { error } = await sb.from("traveler_plans").insert({
    user_id: user.id,
    booking_id: plan.bookingId,
    trip_id: membership?.trip_id ?? null,
    title: plan.title,
    notes: plan.notes ?? null,
    plan_date: plan.planDate ?? null,
    start_time: plan.startTime ?? null,
    end_time: plan.endTime ?? null,
    timezone: plan.timezone,
    location_name: plan.locationName ?? null,
    address: plan.address ?? null,
    latitude: plan.latitude ?? null,
    longitude: plan.longitude ?? null,
    source: "traveler",
  });
  if (error) back(plan.bookingId, "error_msg", "That could not be saved. Try again.");

  revalidatePath(`/account/assistant/${plan.bookingId}`);
  if (membership?.trip_id) revalidatePath(`/trips/${membership.trip_id}`);
  back(plan.bookingId, "notice", "Added to your plans.");
}

export async function removePlanAction(fd: FormData): Promise<void> {
  const raw = formToObject(fd);
  const planId = typeof raw.planId === "string" ? raw.planId : "";
  const bookingId = typeof raw.bookingId === "string" ? raw.bookingId : "";

  const sb = await createClient();
  // No ownership check here on purpose: the delete policy is the check, and duplicating it in
  // TypeScript would only create a second place for it to be wrong.
  const { error } = await sb.from("traveler_plans").delete().eq("id", planId);
  if (error) back(bookingId, "error_msg", "That could not be removed. Try again.");

  revalidatePath(`/account/assistant/${bookingId}`);
  back(bookingId, "notice", "Removed.");
}
