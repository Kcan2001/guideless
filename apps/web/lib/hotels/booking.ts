import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { bestStoredRate, resolveStayContext, type HotelBookingRow } from "./catalog";
import { getHotelSupplier, getHotelSupplierId, HotelSupplierError } from "./suppliers";

/**
 * Hotel booking for a Guideless booking's stay tier.
 *
 * Milestone 3 scope: staff trigger this from admin. It records a `hotel_bookings` row from the best
 * stored rate and, when `confirmWithSupplier` is set, books it with the supplier. Automatic supplier
 * booking on payment is deliberately NOT wired yet (docs/hotels.md "What is manual today").
 */
export interface HotelBookingOutcome {
  ok: boolean;
  hotelBooking: HotelBookingRow | null;
  reason?: "no_hotel" | "no_rate" | "already_booked" | "supplier_error" | "not_found";
  message?: string;
}

export async function bookHotelForBooking(
  bookingId: string,
  opts: { confirmWithSupplier?: boolean } = {},
): Promise<HotelBookingOutcome> {
  const sb = createServiceRoleClient();
  const { data: booking } = await sb
    .from("bookings")
    .select(
      "id, stay_option_id, status, confirmation_number, booking_travelers(traveler_id, is_lead)",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { ok: false, hotelBooking: null, reason: "not_found" };
  if (!booking.stay_option_id) return { ok: false, hotelBooking: null, reason: "no_hotel" };

  const { data: existing } = await sb
    .from("hotel_bookings")
    .select("*")
    .eq("booking_id", bookingId)
    .not("status", "in", "(cancelled,failed)")
    .maybeSingle();
  if (existing)
    return { ok: false, hotelBooking: existing as HotelBookingRow, reason: "already_booked" };

  const ctx = await resolveStayContext(booking.stay_option_id as string);
  if (!ctx) return { ok: false, hotelBooking: null, reason: "no_hotel" };
  const travelers = (booking.booking_travelers ?? []) as Array<{ traveler_id: string }>;
  const adults = Math.min(2, Math.max(1, travelers.length));
  const rate = await bestStoredRate(ctx, adults);
  if (!rate) return { ok: false, hotelBooking: null, reason: "no_rate" };

  const supplierId = getHotelSupplierId();
  let supplierBookingId: string | null = null;
  let confirmation: string | null = null;
  let status: "quoted" | "booked" | "confirmed" | "failed" = "quoted";
  if (opts.confirmWithSupplier) {
    // Guest details come from the traveler profiles; contact from the lead traveler.
    const { data: profiles } = await sb
      .from("traveler_profiles")
      .select("id, first_name, last_name, email, phone")
      .in(
        "id",
        travelers.map((t) => t.traveler_id),
      );
    const guests = ((profiles ?? []) as Array<{ first_name: string; last_name: string }>).map(
      (p, i) => ({ firstName: p.first_name, lastName: p.last_name, isLead: i === 0 }),
    );
    const lead = ((profiles ?? []) as Array<{ email: string | null; phone: string | null }>)[0];
    try {
      const result = await getHotelSupplier().book({
        supplierRateId: rate.supplier_rate_id,
        guests,
        contact: { email: lead?.email ?? "", phone: lead?.phone ?? undefined },
      });
      supplierBookingId = result.supplierBookingId;
      confirmation = result.confirmationNumber ?? null;
      status = result.status;
    } catch (err) {
      const message =
        err instanceof HotelSupplierError ? `${err.code}: ${err.message}` : "unexpected";
      console.error("hotel booking failed", { bookingId, message });
      return { ok: false, hotelBooking: null, reason: "supplier_error", message };
    }
  }

  const deadline = (rate.cancellation_policy as { deadline?: string } | null)?.deadline ?? null;
  const { data: row, error } = await sb
    .from("hotel_bookings")
    .insert({
      booking_id: bookingId,
      stay_option_id: booking.stay_option_id,
      hotel_id: ctx.hotel.id,
      supplier: supplierId,
      supplier_booking_id: supplierBookingId,
      status,
      rate_snapshot: rate,
      confirmation_number: confirmation,
      cancellation_deadline: deadline,
    })
    .select("*")
    .single();
  if (error) throw error;
  return { ok: true, hotelBooking: row as HotelBookingRow };
}
