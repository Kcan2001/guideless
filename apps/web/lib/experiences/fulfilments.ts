import "server-only";

import type { Enums } from "@guideless/types";
import { createClient } from "@/lib/supabase/server";

/**
 * Bought-in experiences on a traveler's own bookings, as the traveler sees them.
 *
 * Read as them, so row-level security is the filter. There is nothing commercial in this table by
 * design — what we paid lives in `add_on_sourcing`, staff-only — which is exactly what makes it
 * safe to put in front of the person who bought it.
 */

export interface MyFulfilment {
  id: string;
  bookingId: string;
  title: string;
  status: Enums<"fulfilment_status">;
  travelDate: string;
  travelers: number;
  operatedBy: string | null;
  supplierReference: string | null;
  voucherUrl: string | null;
  instructions: string | null;
  termsUrl: string | null;
  bookingUrl: string | null;
}

interface Row {
  id: string;
  booking_id: string;
  status: Enums<"fulfilment_status">;
  travel_date: string;
  travelers: number;
  supplier_reference: string | null;
  voucher_url: string | null;
  instructions: string | null;
  departure_add_ons: {
    title: string;
    operated_by: string | null;
    supplier_terms_url: string | null;
    supplier_booking_url: string | null;
  } | null;
}

export async function listMyFulfilments(bookingIds: string[]): Promise<MyFulfilment[]> {
  if (bookingIds.length === 0) return [];
  const sb = await createClient();
  const { data, error } = await sb
    .from("add_on_fulfilments")
    .select(
      "id, booking_id, status, travel_date, travelers, supplier_reference, voucher_url, " +
        "instructions, departure_add_ons(title, operated_by, supplier_terms_url, supplier_booking_url)",
    )
    .in("booking_id", bookingIds)
    .order("travel_date");
  if (error) {
    // Nothing bought in, or not signed in. Neither is worth throwing at an account page.
    if (error.code === "42501") return [];
    throw error;
  }

  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    bookingId: r.booking_id,
    title: r.departure_add_ons?.title ?? "Experience",
    status: r.status,
    travelDate: r.travel_date,
    travelers: r.travelers,
    operatedBy: r.departure_add_ons?.operated_by ?? null,
    supplierReference: r.supplier_reference,
    voucherUrl: r.voucher_url,
    instructions: r.instructions,
    termsUrl: r.departure_add_ons?.supplier_terms_url ?? null,
    bookingUrl: r.departure_add_ons?.supplier_booking_url ?? null,
  }));
}

/**
 * What the traveler is told about each state.
 *
 * `failed` is the one that matters. They have paid for something they are not getting, and the
 * words have to say that plainly rather than leaving them to work it out from a status chip.
 */
export function fulfilmentMessage(f: MyFulfilment): string {
  const operator = f.operatedBy ?? "the operator";
  switch (f.status) {
    case "pending":
      return `We're booking this with ${operator} for you. Your reference will appear here, usually within a day.`;
    case "booked":
      return `Booked with ${operator}${f.supplierReference ? `, reference ${f.supplierReference}` : ""}.`;
    case "cancelled":
      return `Cancelled with ${operator}.`;
    default:
      return `${operator} couldn't take this booking after all. You'll be refunded for it — we'll be in touch, and you don't need to chase us.`;
  }
}
