import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { type HotelBookingRow } from "./catalog";
import { getHotelSupplier, HotelSupplierError } from "./suppliers";

export interface HotelCancellationOutcome {
  ok: boolean;
  hotelBooking: HotelBookingRow | null;
  reason?: "not_found" | "already_cancelled" | "supplier_error";
  message?: string;
}

/** Cancels with the supplier when a supplier booking exists, then marks the row cancelled. */
export async function cancelHotelBooking(
  hotelBookingId: string,
): Promise<HotelCancellationOutcome> {
  const sb = createServiceRoleClient();
  const { data: row } = await sb
    .from("hotel_bookings")
    .select("*")
    .eq("id", hotelBookingId)
    .maybeSingle();
  if (!row) return { ok: false, hotelBooking: null, reason: "not_found" };
  const current = row as HotelBookingRow;
  if (current.status === "cancelled")
    return { ok: false, hotelBooking: current, reason: "already_cancelled" };

  if (current.supplier_booking_id) {
    try {
      const result = await getHotelSupplier().cancel(current.supplier_booking_id);
      if (!result.cancelled) {
        return {
          ok: false,
          hotelBooking: current,
          reason: "supplier_error",
          message: "The supplier did not confirm the cancellation.",
        };
      }
    } catch (err) {
      const message =
        err instanceof HotelSupplierError ? `${err.code}: ${err.message}` : "unexpected";
      console.error("hotel cancellation failed", { hotelBookingId, message });
      return { ok: false, hotelBooking: current, reason: "supplier_error", message };
    }
  }
  const { data: updated, error } = await sb
    .from("hotel_bookings")
    .update({ status: "cancelled" })
    .eq("id", hotelBookingId)
    .select("*")
    .single();
  if (error) throw error;
  return { ok: true, hotelBooking: updated as HotelBookingRow };
}
