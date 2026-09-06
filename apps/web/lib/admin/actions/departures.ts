"use server";

import { revalidatePath } from "next/cache";
import {
  departureFormSchema,
  noteSchema,
  supplierFormSchema,
  supplierServiceFormSchema,
  uuidSchema,
} from "@guideless/validation";
import { OPS_ROLES, requireStaff } from "@/lib/auth/staff";
import { dbErrorMessage, flash, parseForm, returnTo } from "@/lib/admin/form";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

function id(fd: FormData, key: string): string {
  const parsed = uuidSchema.safeParse(fd.get(key));
  if (!parsed.success) throw new Error(`Missing or invalid ${key}`);
  return parsed.data;
}

function revalidateDeparture(departureId: string, tourSlug?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/departures");
  revalidatePath(`/admin/departures/${departureId}`);
  revalidatePath("/tours");
  if (tourSlug) revalidatePath(`/tours/${tourSlug}`);
}

export async function createDepartureAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const parsed = parseForm(departureFormSchema, fd);
  if (!parsed.ok) flash("/admin/departures/new", "error", parsed.error);
  const d = parsed.data;
  const sb = await createClient();
  const { data: tour } = await sb
    .from("tours")
    .select("id, slug, current_version_id")
    .eq("id", d.tourId)
    .maybeSingle();
  if (!tour?.current_version_id)
    flash("/admin/departures/new", "error", "That tour has no published version yet.");
  const { data: created, error } = await sb
    .from("departures")
    .insert({
      tour_id: d.tourId,
      tour_version_id: tour.current_version_id,
      status: d.status,
      start_date: d.startDate,
      end_date: d.endDate,
      timezone: d.timezone,
      capacity: d.capacity,
      minimum_travelers: d.minimumTravelers,
      price_amount: d.price,
      deposit_amount: d.deposit,
      currency: d.currency,
      booking_deadline: d.bookingDeadline,
      balance_due_date: d.balanceDueDate,
      ...(d.cancellationPolicy ? { cancellation_policy: d.cancellationPolicy } : {}),
    })
    .select("id")
    .single();
  if (error) flash("/admin/departures/new", "error", dbErrorMessage(error));
  revalidateDeparture(created.id, tour.slug);
  flash(
    `/admin/departures/${created.id}`,
    "ok",
    "Departure created (pinned to the tour's current published version).",
  );
}

export async function updateDepartureAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const departureId = id(fd, "departureId");
  const back = returnTo(fd, `/admin/departures/${departureId}`);
  const parsed = parseForm(departureFormSchema, fd);
  if (!parsed.ok) flash(back, "error", parsed.error);
  const d = parsed.data;
  const sb = await createClient();
  const { error } = await sb
    .from("departures")
    .update({
      status: d.status,
      start_date: d.startDate,
      end_date: d.endDate,
      timezone: d.timezone,
      capacity: d.capacity,
      minimum_travelers: d.minimumTravelers,
      price_amount: d.price,
      deposit_amount: d.deposit,
      currency: d.currency,
      booking_deadline: d.bookingDeadline,
      balance_due_date: d.balanceDueDate,
      ...(d.cancellationPolicy ? { cancellation_policy: d.cancellationPolicy } : {}),
    })
    .eq("id", departureId);
  if (error) flash(back, "error", dbErrorMessage(error));
  const { data: tour } = await sb.from("tours").select("slug").eq("id", d.tourId).maybeSingle();
  revalidateDeparture(departureId, tour?.slug);
  flash(back, "ok", "Departure saved.");
}

export async function addDepartureNoteAction(fd: FormData): Promise<void> {
  const ctx = await requireStaff();
  const departureId = id(fd, "departureId");
  const back = `/admin/departures/${departureId}#notes`;
  const parsed = parseForm(noteSchema, fd);
  if (!parsed.ok) flash(back, "error", parsed.error);
  const sb = await createClient();
  const { error } = await sb
    .from("departure_notes")
    .insert({ departure_id: departureId, body: parsed.data.body, created_by: ctx.user.id });
  if (error) flash(back, "error", dbErrorMessage(error));
  revalidatePath(`/admin/departures/${departureId}`);
  flash(back, "ok", "Note added.");
}

/**
 * Snapshot the departure group into a trip (ADR-009). The SQL function is service-role only,
 * so the role check happens here before we escalate.
 */
export async function activateTripAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const departureId = id(fd, "departureId");
  const groupId = id(fd, "groupId");
  const back = `/admin/departures/${departureId}#trips`;
  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch {
    flash(
      back,
      "error",
      "Trip activation needs SUPABASE_SERVICE_ROLE_KEY on the server. Ask an engineer to configure it.",
    );
  }
  const { data: existing } = await admin
    .from("trips")
    .select("id")
    .eq("departure_group_id", groupId)
    .maybeSingle();
  if (existing) flash(back, "error", "This group already has a trip.");
  const { data: tripId, error } = await admin.rpc("create_trip_for_group", { p_group_id: groupId });
  if (error) flash(back, "error", dbErrorMessage(error));
  await admin
    .from("departures")
    .update({ status: "guaranteed" })
    .eq("id", departureId)
    .eq("status", "open");
  revalidateDeparture(departureId);
  flash(
    `/admin/departures/${departureId}/trips/${tripId}`,
    "ok",
    "Trip created from the tour version. Edit the live itinerary here.",
  );
}

export async function addGroupAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const departureId = id(fd, "departureId");
  const back = `/admin/departures/${departureId}#trips`;
  const sb = await createClient();
  const { data: groups } = await sb
    .from("departure_groups")
    .select("position")
    .eq("departure_id", departureId);
  const position = Math.max(0, ...(groups ?? []).map((g) => g.position)) + 1;
  const name = `Group ${String.fromCharCode(64 + position)}`;
  const { error } = await sb
    .from("departure_groups")
    .insert({ departure_id: departureId, name, position });
  if (error) flash(back, "error", dbErrorMessage(error));
  revalidateDeparture(departureId);
  flash(back, "ok", `${name} added.`);
}

export async function assignTravelerGroupAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const departureId = id(fd, "departureId");
  const bookingId = id(fd, "bookingId");
  const travelerId = id(fd, "travelerId");
  const groupRaw = fd.get("groupId");
  const groupId = typeof groupRaw === "string" && groupRaw !== "" ? id(fd, "groupId") : null;
  const back = `/admin/departures/${departureId}#travelers`;
  const sb = await createClient();
  const { error } = await sb
    .from("booking_travelers")
    .update({ departure_group_id: groupId })
    .eq("booking_id", bookingId)
    .eq("traveler_id", travelerId);
  if (error) flash(back, "error", dbErrorMessage(error));
  revalidateDeparture(departureId);
  flash(back, "ok", "Group assignment saved.");
}

// ── Suppliers ─────────────────────────────────────────────────────────────────
export async function createSupplierAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const back = returnTo(fd, "/admin/departures");
  const parsed = parseForm(supplierFormSchema, fd);
  if (!parsed.ok) flash(back, "error", parsed.error);
  const s = parsed.data;
  const sb = await createClient();
  const { error } = await sb.from("suppliers").insert({
    name: s.name,
    kind: s.kind,
    website: s.website ?? null,
    country_code: s.countryCode?.toUpperCase() ?? null,
  });
  if (error) flash(back, "error", dbErrorMessage(error));
  revalidatePath(back);
  flash(back, "ok", "Supplier added.");
}

export async function addSupplierServiceAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const departureId = id(fd, "departureId");
  const back = `/admin/departures/${departureId}#suppliers`;
  const parsed = parseForm(supplierServiceFormSchema, fd);
  if (!parsed.ok) flash(back, "error", parsed.error);
  const s = parsed.data;
  const sb = await createClient();
  const { error } = await sb.from("supplier_services").insert({
    departure_id: departureId,
    supplier_id: s.supplierId,
    title: s.title,
    status: s.status,
    confirmation_number: s.confirmationNumber ?? null,
    cost_amount: s.cost ?? null,
    cost_currency: s.cost != null ? (s.costCurrency ?? "EUR") : null,
    cancellation_deadline: s.cancellationDeadline ?? null,
    internal_notes: s.internalNotes ?? null,
  });
  if (error) flash(back, "error", dbErrorMessage(error));
  revalidateDeparture(departureId);
  flash(back, "ok", "Supplier service recorded.");
}

export async function updateSupplierServiceStatusAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const departureId = id(fd, "departureId");
  const serviceId = id(fd, "serviceId");
  const back = `/admin/departures/${departureId}#suppliers`;
  const status = fd.get("status");
  const confirmation = fd.get("confirmationNumber");
  const allowed = ["requested", "pending", "confirmed", "cancelled", "failed"] as const;
  if (typeof status !== "string" || !(allowed as readonly string[]).includes(status))
    flash(back, "error", "Invalid status.");
  const sb = await createClient();
  const { error } = await sb
    .from("supplier_services")
    .update({
      status: status as (typeof allowed)[number],
      ...(typeof confirmation === "string" && confirmation.trim()
        ? { confirmation_number: confirmation.trim() }
        : {}),
    })
    .eq("id", serviceId);
  if (error) flash(back, "error", dbErrorMessage(error));
  revalidateDeparture(departureId);
  flash(back, "ok", "Supplier service updated.");
}
