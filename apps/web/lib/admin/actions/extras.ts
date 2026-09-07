"use server";

import { revalidatePath } from "next/cache";
import { addOnFormSchema, stayOptionFormSchema, uuidSchema } from "@guideless/validation";
import { OPS_ROLES, requireStaff } from "@/lib/auth/staff";
import { dbErrorMessage, flash, parseForm } from "@/lib/admin/form";
import { createClient } from "@/lib/supabase/server";

function id(fd: FormData, key: string): string {
  const parsed = uuidSchema.safeParse(fd.get(key));
  if (!parsed.success) throw new Error(`Missing or invalid ${key}`);
  return parsed.data;
}

function optionalId(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (!v) return null;
  const parsed = uuidSchema.safeParse(v);
  return parsed.success ? parsed.data : null;
}

const toMinor = (major: number) => Math.round(major * 100);

async function departureCurrency(
  sb: Awaited<ReturnType<typeof createClient>>,
  departureId: string,
) {
  const { data } = await sb
    .from("departures")
    .select("currency")
    .eq("id", departureId)
    .maybeSingle();
  if (!data) throw new Error("Departure not found");
  return data.currency;
}

// ── Stay options ─────────────────────────────────────────────────────────────
export async function saveStayOptionAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const departureId = id(fd, "departureId");
  const stayId = optionalId(fd, "stayOptionId");
  const to = `/admin/departures/${departureId}#stays`;
  const parsed = parseForm(stayOptionFormSchema, fd);
  if (!parsed.ok) flash(to, "error", parsed.error);
  const s = parsed.data;
  const sb = await createClient();

  if (s.isDefault) {
    const { error: clearErr } = await sb
      .from("departure_stay_options")
      .update({ is_default: false })
      .eq("departure_id", departureId)
      .eq("is_default", true);
    if (clearErr) flash(to, "error", dbErrorMessage(clearErr));
  }
  const row = {
    departure_id: departureId,
    name: s.name,
    description: s.description ?? null,
    hotel_name: s.hotelName ?? null,
    area: s.area ?? null,
    star_rating: s.starRating,
    destination_id: s.destinationId,
    price_delta_amount: toMinor(s.priceDelta),
    shared_room_discount_amount:
      s.sharedRoomDiscount === null ? null : toMinor(s.sharedRoomDiscount),
    capacity: s.capacity,
    position: s.position,
    is_default: s.isDefault,
    is_active: s.isActive,
  };
  const { error } = stayId
    ? await sb.from("departure_stay_options").update(row).eq("id", stayId)
    : await sb.from("departure_stay_options").insert(row);
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath(`/admin/departures/${departureId}`);
  flash(to, "ok", stayId ? "Stay option updated." : "Stay option added.");
}

export async function toggleStayOptionAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const departureId = id(fd, "departureId");
  const stayId = id(fd, "stayOptionId");
  const active = fd.get("isActive") === "true";
  const to = `/admin/departures/${departureId}#stays`;
  const sb = await createClient();
  const { error } = await sb
    .from("departure_stay_options")
    .update({ is_active: active })
    .eq("id", stayId);
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath(`/admin/departures/${departureId}`);
  flash(to, "ok", active ? "Stay option is bookable again." : "Stay option hidden from customers.");
}

// ── Add-ons ──────────────────────────────────────────────────────────────────
export async function saveAddOnAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const departureId = id(fd, "departureId");
  const addOnId = optionalId(fd, "addOnId");
  const to = `/admin/departures/${departureId}#add-ons`;
  const parsed = parseForm(addOnFormSchema, fd);
  if (!parsed.ok) flash(to, "error", parsed.error);
  const a = parsed.data;
  const sb = await createClient();
  const currency = await departureCurrency(sb, departureId);
  const row = {
    departure_id: departureId,
    title: a.title,
    description: a.description ?? null,
    kind: a.kind,
    price_amount: toMinor(a.price),
    currency,
    pricing_basis: a.pricingBasis,
    capacity: a.capacity,
    day_number: a.dayNumber,
    start_time: a.startTime ?? null,
    end_time: a.endTime ?? null,
    location_name: a.locationName ?? null,
    address: a.address ?? null,
    latitude: a.latitude,
    longitude: a.longitude,
    bookable_until_days_before: a.bookableUntilDaysBefore,
    cancellable_until_days_before: a.cancellableUntilDaysBefore,
    tier_group: a.tierGroup ?? null,
    supplier_service_id: a.supplierServiceId,
    position: a.position,
    is_featured: a.isFeatured,
    is_active: a.isActive,
  };
  const { error } = addOnId
    ? await sb.from("departure_add_ons").update(row).eq("id", addOnId)
    : await sb.from("departure_add_ons").insert(row);
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath(`/admin/departures/${departureId}`);
  flash(to, "ok", addOnId ? "Add-on updated." : "Add-on added.");
}

export async function toggleAddOnAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const departureId = id(fd, "departureId");
  const addOnId = id(fd, "addOnId");
  const active = fd.get("isActive") === "true";
  const to = `/admin/departures/${departureId}#add-ons`;
  const sb = await createClient();
  const { error } = await sb
    .from("departure_add_ons")
    .update({ is_active: active })
    .eq("id", addOnId);
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath(`/admin/departures/${departureId}`);
  flash(to, "ok", active ? "Add-on is bookable again." : "Add-on hidden from customers.");
}

/** Ops can cancel a confirmed add-on (refunds are handled on the booking as today). */
export async function cancelBookingAddOnAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const departureId = id(fd, "departureId");
  const addOnId = id(fd, "addOnId");
  const rowId = id(fd, "bookingAddOnId");
  const to = `/admin/departures/${departureId}/add-ons/${addOnId}`;
  const sb = await createClient();
  const { error } = await sb
    .from("booking_add_ons")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", rowId)
    .in("status", ["pending", "confirmed"]);
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath(to);
  flash(to, "ok", "Removed from the manifest. Handle any refund on the booking.");
}
