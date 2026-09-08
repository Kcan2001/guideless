"use server";

import { revalidatePath } from "next/cache";
import {
  hotelFormSchema,
  hotelRoomFormSchema,
  hotelSupplierMappingSchema,
  pricingRuleFormSchema,
  uuidSchema,
  type HotelForm,
} from "@guideless/validation";
import { FINANCE_ROLES, OPS_ROLES, requireStaff } from "@/lib/auth/staff";
import { dbErrorMessage, flash, parseForm, returnTo } from "@/lib/admin/form";
import { bookHotelForBooking } from "@/lib/hotels/booking";
import { cancelHotelBooking } from "@/lib/hotels/cancellation";
import { refreshRatesForStayOption } from "@/lib/hotels/search";
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

function hotelRowFromForm(h: HotelForm) {
  return {
    destination_id: h.destinationId,
    name: h.name,
    slug: h.slug,
    address: h.address ?? null,
    city: h.city,
    country_code: h.countryCode,
    latitude: h.latitude,
    longitude: h.longitude,
    star_rating: h.starRating,
    description: h.description ?? null,
    image_urls: h.imageUrls,
    amenities: h.amenities,
    is_active: h.isActive,
  };
}

// ── Hotels ────────────────────────────────────────────────────────────────────
export async function createHotelAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const parsed = parseForm(hotelFormSchema, fd);
  if (!parsed.ok) flash("/admin/hotels/new", "error", parsed.error);
  const sb = await createClient();
  const { data, error } = await sb
    .from("hotels")
    .insert(hotelRowFromForm(parsed.data))
    .select("id")
    .single();
  if (error) flash("/admin/hotels/new", "error", dbErrorMessage(error));
  revalidatePath("/admin/hotels");
  flash(`/admin/hotels/${data.id}`, "ok", "Hotel added. Now map it to a supplier and add rooms.");
}

export async function updateHotelAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const hotelId = id(fd, "hotelId");
  const to = returnTo(fd, `/admin/hotels/${hotelId}`);
  const parsed = parseForm(hotelFormSchema, fd);
  if (!parsed.ok) flash(to, "error", parsed.error);
  const sb = await createClient();
  const { error } = await sb.from("hotels").update(hotelRowFromForm(parsed.data)).eq("id", hotelId);
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath("/admin/hotels");
  revalidatePath(to);
  flash(to, "ok", "Hotel saved.");
}

// ── Rooms ─────────────────────────────────────────────────────────────────────
export async function saveHotelRoomAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const hotelId = id(fd, "hotelId");
  const roomId = optionalId(fd, "roomId");
  const to = `/admin/hotels/${hotelId}#rooms`;
  const parsed = parseForm(hotelRoomFormSchema, fd);
  if (!parsed.ok) flash(to, "error", parsed.error);
  const r = parsed.data;
  const row = {
    hotel_id: hotelId,
    name: r.name,
    bed_type: r.bedType ?? null,
    max_occupancy: r.maxOccupancy,
    description: r.description ?? null,
    image_urls: r.imageUrls,
    position: r.position,
  };
  const sb = await createClient();
  const { error } = roomId
    ? await sb.from("hotel_rooms").update(row).eq("id", roomId)
    : await sb.from("hotel_rooms").insert(row);
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath(to);
  flash(to, "ok", roomId ? "Room saved." : "Room added.");
}

export async function deleteHotelRoomAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const hotelId = id(fd, "hotelId");
  const roomId = id(fd, "roomId");
  const to = `/admin/hotels/${hotelId}#rooms`;
  const sb = await createClient();
  const { error } = await sb.from("hotel_rooms").delete().eq("id", roomId);
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath(to);
  flash(to, "ok", "Room removed.");
}

// ── Supplier mappings ─────────────────────────────────────────────────────────
export async function saveHotelMappingAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const hotelId = id(fd, "hotelId");
  const to = `/admin/hotels/${hotelId}#suppliers`;
  const parsed = parseForm(hotelSupplierMappingSchema, fd);
  if (!parsed.ok) flash(to, "error", parsed.error);
  const m = parsed.data;
  const sb = await createClient();
  const { error } = await sb.from("hotel_supplier_mappings").insert({
    hotel_id: hotelId,
    supplier: m.supplier,
    supplier_hotel_id: m.supplierHotelId.trim(),
    hotel_room_id: m.hotelRoomId || null,
    supplier_room_id: m.supplierRoomId ?? null,
  });
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath(to);
  flash(to, "ok", "Supplier mapping saved.");
}

export async function deleteHotelMappingAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const hotelId = id(fd, "hotelId");
  const mappingId = id(fd, "mappingId");
  const to = `/admin/hotels/${hotelId}#suppliers`;
  const sb = await createClient();
  const { error } = await sb.from("hotel_supplier_mappings").delete().eq("id", mappingId);
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath(to);
  flash(to, "ok", "Mapping removed.");
}

// ── Rates ─────────────────────────────────────────────────────────────────────
/** Refresh stored rates for every stay option linked to this hotel. Service role, after the ops check. */
export async function refreshHotelRatesAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const hotelId = id(fd, "hotelId");
  const to = `/admin/hotels/${hotelId}#rates`;
  const sb = await createClient();
  const { data: stays } = await sb
    .from("departure_stay_options")
    .select("id")
    .eq("hotel_id", hotelId)
    .eq("is_active", true);
  const ids = ((stays ?? []) as Array<{ id: string }>).map((s) => s.id);
  if (ids.length === 0)
    flash(
      to,
      "error",
      "No active stay option uses this hotel yet, so there are no dates to price.",
    );
  let stored = 0;
  const problems: string[] = [];
  for (const stayId of ids) {
    try {
      const r = await refreshRatesForStayOption(stayId);
      stored += r.stored;
      if (r.skipped === "no_mapping")
        problems.push("no supplier mapping for the configured supplier");
      if (r.skipped === "no_rates")
        problems.push("the supplier returned no rates for these dates — check the mapping");
      for (const s of r.suppliers) if (!s.ok && s.error) problems.push(s.error);
    } catch (err) {
      problems.push(err instanceof Error ? err.message : "refresh failed");
    }
  }
  revalidatePath(to);
  if (stored === 0)
    flash(
      to,
      "error",
      `No rates stored. ${[...new Set(problems)].join("; ") || "Supplier returned nothing."}`,
    );
  flash(
    to,
    "ok",
    `${stored} rate${stored === 1 ? "" : "s"} stored for ${ids.length} stay option${ids.length === 1 ? "" : "s"}.${
      problems.length ? ` Some calls failed: ${[...new Set(problems)].join("; ")}` : ""
    }`,
  );
}

/** One click: write the suggested customer delta onto the stay option (ops role; RLS applies). */
export async function useSuggestedDeltaAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const hotelId = id(fd, "hotelId");
  const stayOptionId = id(fd, "stayOptionId");
  const to = `/admin/hotels/${hotelId}#rates`;
  const major = Number(fd.get("deltaMajor"));
  if (!Number.isFinite(major)) flash(to, "error", "Suggested delta is missing.");
  const sb = await createClient();
  const { error } = await sb
    .from("departure_stay_options")
    .update({ price_delta_amount: toMinor(major) })
    .eq("id", stayOptionId);
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath(to);
  revalidatePath("/admin/departures");
  flash(to, "ok", "Stay option price updated from the suggestion.");
}

// ── Pricing rules ─────────────────────────────────────────────────────────────
export async function savePricingRuleAction(fd: FormData): Promise<void> {
  await requireStaff(FINANCE_ROLES);
  const ruleId = optionalId(fd, "ruleId");
  const to = "/admin/pricing";
  const parsed = parseForm(pricingRuleFormSchema, fd);
  if (!parsed.ok) flash(to, "error", parsed.error);
  const p = parsed.data;
  const row = {
    destination_id: p.destinationId || null,
    hotel_id: p.hotelId || null,
    min_markup_amount: toMinor(p.minMarkup),
    percentage_markup: p.percentageMarkup,
    fixed_markup_amount: toMinor(p.fixedMarkup),
    priority: p.priority,
    effective_from: p.effectiveFrom,
    effective_to: p.effectiveTo,
    is_active: p.isActive,
  };
  const sb = await createClient();
  const { error } = ruleId
    ? await sb.from("pricing_rules").update(row).eq("id", ruleId)
    : await sb.from("pricing_rules").insert(row);
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath(to);
  flash(to, "ok", ruleId ? "Rule saved." : "Rule added.");
}

export async function deletePricingRuleAction(fd: FormData): Promise<void> {
  await requireStaff(FINANCE_ROLES);
  const ruleId = id(fd, "ruleId");
  const sb = await createClient();
  const { error } = await sb.from("pricing_rules").delete().eq("id", ruleId);
  if (error) flash("/admin/pricing", "error", dbErrorMessage(error));
  revalidatePath("/admin/pricing");
  flash("/admin/pricing", "ok", "Rule removed.");
}

// ── Hotel bookings (staff-triggered in this milestone) ────────────────────────
export async function bookHotelForBookingAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const bookingId = id(fd, "bookingId");
  const confirm = fd.get("confirmWithSupplier") === "true";
  const to = returnTo(fd, `/admin/bookings/${bookingId}`);
  const result = await bookHotelForBooking(bookingId, { confirmWithSupplier: confirm });
  if (!result.ok) {
    const why: Record<string, string> = {
      not_found: "Booking not found.",
      no_hotel: "This booking's stay tier has no hotel linked.",
      no_rate: "No stored rate for these dates. Refresh rates on the hotel first.",
      already_booked: "A hotel booking already exists for this booking.",
      supplier_error: `The supplier refused: ${result.message ?? "unknown error"}`,
    };
    flash(to, "error", why[result.reason ?? ""] ?? "Could not book the hotel.");
  }
  revalidatePath(to);
  flash(
    to,
    "ok",
    confirm
      ? "Hotel booked with the supplier."
      : "Hotel booking recorded (not yet sent to the supplier).",
  );
}

export async function cancelHotelBookingAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const hotelBookingId = id(fd, "hotelBookingId");
  const to = returnTo(fd, "/admin/bookings");
  const result = await cancelHotelBooking(hotelBookingId);
  if (!result.ok)
    flash(
      to,
      "error",
      result.reason === "already_cancelled"
        ? "Already cancelled."
        : `Could not cancel: ${result.message ?? result.reason ?? "unknown"}`,
    );
  revalidatePath(to);
  flash(to, "ok", "Hotel booking cancelled.");
}
