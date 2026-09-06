import "server-only";

import type { Tables, Views } from "@guideless/types";
import { createClient } from "@/lib/supabase/server";

export type Booking = Tables<"bookings">;
export type BookingTraveler = Tables<"traveler_profiles">;

export interface BookingWithContext {
  booking: Booking;
  travelers: BookingTraveler[];
  departure: Views<"departures_public">;
  tour: Tables<"tours">;
  payments: Tables<"payments">[];
}

/**
 * The signed-in customer's bookings. Uses the request-scoped client so RLS restricts rows to
 * `customer_id = auth.uid()` (or staff). Never pass ids from other users here — RLS would return
 * nothing, which is the point.
 */
export async function listMyBookings(): Promise<BookingWithContext[]> {
  const sb = await createClient();
  const { data: bookings, error } = await sb
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (bookings.length === 0) return [];

  const departureIds = [...new Set(bookings.map((b) => b.departure_id))];
  const [
    { data: departures, error: dErr },
    { data: travelers, error: tErr },
    { data: payments, error: pErr },
  ] = await Promise.all([
    sb.from("departures_public").select("*").in("id", departureIds),
    sb
      .from("booking_travelers")
      .select("booking_id, traveler_profiles(*)")
      .in(
        "booking_id",
        bookings.map((b) => b.id),
      ),
    sb
      .from("payments")
      .select("*")
      .in(
        "booking_id",
        bookings.map((b) => b.id),
      )
      .order("created_at"),
  ]);
  if (dErr) throw dErr;
  if (tErr) throw tErr;
  if (pErr) throw pErr;

  const tourIds = [...new Set(departures.map((d) => d.tour_id).filter((x): x is string => !!x))];
  const { data: tours, error: toErr } = await sb.from("tours").select("*").in("id", tourIds);
  if (toErr) throw toErr;

  const depById = new Map(departures.map((d) => [d.id, d]));
  const tourById = new Map(tours.map((t) => [t.id, t]));

  return bookings.flatMap((booking) => {
    const departure = depById.get(booking.departure_id);
    const tour = departure?.tour_id ? tourById.get(departure.tour_id) : undefined;
    if (!departure || !tour) return [];
    return [
      {
        booking,
        departure,
        tour,
        travelers: travelers
          .filter((t) => t.booking_id === booking.id)
          .flatMap((t) => (t.traveler_profiles ? [t.traveler_profiles] : [])),
        payments: payments.filter((p) => p.booking_id === booking.id),
      },
    ];
  });
}

export async function getMyBooking(bookingId: string): Promise<BookingWithContext | null> {
  const all = await listMyBookings();
  return all.find((b) => b.booking.id === bookingId) ?? null;
}
