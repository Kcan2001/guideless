import "server-only";

import type { Tables } from "@guideless/types";
import { createClient } from "@/lib/supabase/server";

export type CancellationRequest = Tables<"cancellation_requests">;
export type EmergencyContact = Tables<"emergency_contacts">;

export interface RefundableAddOn {
  id: string;
  title: string;
  total: number;
  status: string;
  dayNumber: number | null;
  cancellableUntilDaysBefore: number;
  bookingId: string;
}

/** Open and recent cancellation requests for the customer's bookings (RLS: their own rows). */
export async function listMyCancellationRequests(
  bookingIds: string[],
): Promise<CancellationRequest[]> {
  if (bookingIds.length === 0) return [];
  const sb = await createClient();
  const { data, error } = await sb
    .from("cancellation_requests")
    .select("*")
    .in("booking_id", bookingIds)
    .order("requested_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Add-ons with the fields the refund preview needs (their own cancellation deadlines). */
export async function listRefundableAddOns(bookingIds: string[]): Promise<RefundableAddOn[]> {
  if (bookingIds.length === 0) return [];
  const sb = await createClient();
  const { data, error } = await sb
    .from("booking_add_ons")
    .select(
      "id, booking_id, total_amount, status, add_on:departure_add_ons(title, day_number, cancellable_until_days_before)",
    )
    .in("booking_id", bookingIds)
    .in("status", ["pending", "confirmed"]);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    bookingId: r.booking_id,
    total: r.total_amount,
    status: r.status,
    title: r.add_on?.title ?? "Add-on",
    dayNumber: r.add_on?.day_number ?? null,
    cancellableUntilDaysBefore: r.add_on?.cancellable_until_days_before ?? 7,
  }));
}

/** Primary emergency contact per traveler (RLS follows the traveler's owner). */
export async function listEmergencyContacts(
  travelerIds: string[],
): Promise<Map<string, EmergencyContact>> {
  if (travelerIds.length === 0) return new Map();
  const sb = await createClient();
  const { data, error } = await sb
    .from("emergency_contacts")
    .select("*")
    .in("traveler_id", travelerIds)
    .order("is_primary", { ascending: false });
  if (error) throw error;
  const map = new Map<string, EmergencyContact>();
  for (const c of data ?? []) if (!map.has(c.traveler_id)) map.set(c.traveler_id, c);
  return map;
}
