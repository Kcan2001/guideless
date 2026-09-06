"use server";

import { revalidatePath } from "next/cache";
import { itineraryItemSchema, noteSchema, uuidSchema } from "@guideless/validation";
import { OPS_ROLES, requireStaff } from "@/lib/auth/staff";
import { dbErrorMessage, flash, parseForm } from "@/lib/admin/form";
import { createClient } from "@/lib/supabase/server";

function id(fd: FormData, key: string): string {
  const parsed = uuidSchema.safeParse(fd.get(key));
  if (!parsed.success) throw new Error(`Missing or invalid ${key}`);
  return parsed.data;
}

function back(departureId: string, tripId: string, hash = "") {
  return `/admin/departures/${departureId}/trips/${tripId}${hash}`;
}

/** Live (snapshot) itinerary edits. Audited by the itinerary_changed trigger. */
export async function addTripItemAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const departureId = id(fd, "departureId");
  const tripId = id(fd, "tripId");
  const dayId = id(fd, "dayId");
  const to = back(departureId, tripId, `#day-${dayId}`);
  const parsed = parseForm(itineraryItemSchema, fd);
  if (!parsed.ok) flash(to, "error", parsed.error);
  const i = parsed.data;
  const sb = await createClient();
  const { error } = await sb.from("trip_itinerary_items").insert({
    trip_id: tripId,
    trip_day_id: dayId,
    position: i.position,
    type: i.type,
    status: i.status ?? "planned",
    title: i.title,
    description: i.description ?? null,
    start_time: i.startTime,
    end_time: i.endTime,
    timezone: i.timezone,
    location_name: i.locationName ?? null,
    address: i.address ?? null,
    instructions: i.instructions ?? null,
    responsibility: i.responsibility,
    is_optional: i.isOptional,
    visibility: i.visibility,
  });
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath(to);
  flash(to, "ok", "Item added to the live itinerary.");
}

export async function updateTripItemAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const departureId = id(fd, "departureId");
  const tripId = id(fd, "tripId");
  const itemId = id(fd, "itemId");
  const to = back(departureId, tripId, `#item-${itemId}`);
  const parsed = parseForm(itineraryItemSchema, fd);
  if (!parsed.ok) flash(to, "error", parsed.error);
  const i = parsed.data;
  const sb = await createClient();
  const { error } = await sb
    .from("trip_itinerary_items")
    .update({
      position: i.position,
      type: i.type,
      status: i.status ?? "changed",
      title: i.title,
      description: i.description ?? null,
      start_time: i.startTime,
      end_time: i.endTime,
      timezone: i.timezone,
      location_name: i.locationName ?? null,
      address: i.address ?? null,
      instructions: i.instructions ?? null,
      responsibility: i.responsibility,
      is_optional: i.isOptional,
      visibility: i.visibility,
    })
    .eq("id", itemId);
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath(to);
  flash(to, "ok", "Live item saved. Travelers see the change immediately.");
}

export async function deleteTripItemAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const departureId = id(fd, "departureId");
  const tripId = id(fd, "tripId");
  const itemId = id(fd, "itemId");
  const to = back(departureId, tripId);
  const sb = await createClient();
  const { error } = await sb.from("trip_itinerary_items").delete().eq("id", itemId);
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath(to);
  flash(to, "ok", "Item removed from the live itinerary.");
}

export async function addTripNoteAction(fd: FormData): Promise<void> {
  const ctx = await requireStaff();
  const departureId = id(fd, "departureId");
  const tripId = id(fd, "tripId");
  const to = back(departureId, tripId, "#notes");
  const parsed = parseForm(noteSchema, fd);
  if (!parsed.ok) flash(to, "error", parsed.error);
  const sb = await createClient();
  const { error } = await sb
    .from("trip_notes")
    .insert({ trip_id: tripId, body: parsed.data.body, created_by: ctx.user.id });
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath(to);
  flash(to, "ok", "Staff note added.");
}

export async function setTripStatusAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const departureId = id(fd, "departureId");
  const tripId = id(fd, "tripId");
  const to = back(departureId, tripId);
  const status = fd.get("status");
  const allowed = ["upcoming", "active", "completed", "cancelled"] as const;
  if (typeof status !== "string" || !(allowed as readonly string[]).includes(status))
    flash(to, "error", "Invalid status.");
  const sb = await createClient();
  const { error } = await sb
    .from("trips")
    .update({ status: status as (typeof allowed)[number] })
    .eq("id", tripId);
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath(to);
  revalidatePath(`/admin/departures/${departureId}`);
  flash(to, "ok", `Trip marked ${status}.`);
}
