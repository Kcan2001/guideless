import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { Currency } from "@guideless/types";
import { formatDateRange } from "@guideless/utils";
import { AddOnPurchase } from "@/components/account/add-on-purchase";
import { getMyBooking } from "@/lib/data/bookings";
import { listDepartureExtras } from "@/lib/data/extras";
import { isStripeConfigured } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Add to your trip",
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Add-ons after booking, any time until each one's sales window closes (also mid-trip). The app
 * links here with `?add=<addOnId>` to preselect.
 */
export default async function BookingAddOnsPage(
  props: PageProps<"/account/bookings/[bookingId]/add-ons">,
) {
  const [{ bookingId }, sp] = await Promise.all([props.params, props.searchParams]);
  if (!UUID.test(bookingId)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    redirect(`/login?next=${encodeURIComponent(`/account/bookings/${bookingId}/add-ons`)}`);

  const booking = await getMyBooking(bookingId);
  if (!booking) notFound();
  const { booking: b, departure, tour, travelers } = booking;

  const [extras, { data: layout }] = await Promise.all([
    // Already booked, so this is the trip rather than the shop: sourced activities belong here.
    listDepartureExtras(b.departure_id, { includeInTripOnly: true }),
    supabase
      .from("booking_travelers")
      .select("traveler_id, room_index, is_lead, created_at")
      .eq("booking_id", b.id)
      .order("is_lead", { ascending: false })
      .order("created_at"),
  ]);
  const ordered = (layout ?? []).map((row) => ({
    room: row.room_index,
    traveler: travelers.find((t) => t.id === row.traveler_id),
  }));
  const roomIndexes = ordered.map((r) => r.room);
  const travelerNames = ordered.map(
    (r) => r.traveler?.preferred_name || r.traveler?.first_name || "Traveler",
  );
  const preselect = typeof sp.add === "string" && UUID.test(sp.add) ? sp.add : null;
  const notPayable = b.status !== "confirmed";

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <Link
        href="/account"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground no-underline hover:text-link"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to your account
      </Link>
      <p className="mt-6 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {tour.name}
        {departure.start_date && departure.end_date
          ? ` · ${formatDateRange(departure.start_date, departure.end_date)}`
          : ""}
      </p>
      <h1 className="mt-3 text-4xl font-bold md:text-5xl">Add to your trip.</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Everything optional, paid today, and visible to your group so you can find each other there.
        You can come back to this page any time, even during the trip.
      </p>
      {sp.cancelled === "1" && (
        <p role="status" className="mt-6 rounded border border-border bg-sand/60 px-4 py-3 text-sm">
          Payment was cancelled. Nothing was charged.
        </p>
      )}

      <div className="mt-10">
        {notPayable ? (
          <p className="rounded border border-dashed border-border p-6 text-sm text-muted-foreground">
            Add-ons can be added once this booking is confirmed.
          </p>
        ) : (
          <AddOnPurchase
            bookingId={b.id}
            departureId={b.departure_id}
            currency={b.currency as Currency}
            startDate={departure.start_date ?? new Date().toISOString().slice(0, 10)}
            roomIndexes={roomIndexes.length ? roomIndexes : [1]}
            travelerNames={travelerNames.length ? travelerNames : ["You"]}
            addOns={extras.addOns}
            preselect={preselect}
            paymentsReady={isStripeConfigured()}
          />
        )}
      </div>
    </div>
  );
}
