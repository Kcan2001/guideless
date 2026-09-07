import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TrackView } from "@/components/analytics/track-view";
import { CheckoutWizard } from "@/components/checkout/checkout-wizard";
import type { CheckoutDeparture } from "@/components/checkout/types";
import { listDepartureExtras } from "@/lib/data/extras";
import { getDepartureById } from "@/lib/data/tours";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The 7-step booking flow (spec §15). Steps 2–6 run in the client wizard; step 1 is the departure
 * the customer arrived with; step 7 is /confirmation after Stripe redirects back.
 */
export default async function CheckoutPage(props: PageProps<"/checkout/[departureId]">) {
  const [{ departureId }, sp] = await Promise.all([props.params, props.searchParams]);
  if (!UUID.test(departureId)) notFound();

  const [detail, supabase, extras] = await Promise.all([
    getDepartureById(departureId),
    createClient(),
    listDepartureExtras(departureId),
  ]);
  if (!detail) notFound();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { departure: d, tour, route } = detail;
  const departure: CheckoutDeparture = {
    id: d.id,
    tourSlug: tour.slug,
    tourName: tour.name,
    routeNames: route.map((r) => r.destination.name),
    startDate: d.startDate,
    endDate: d.endDate,
    timezone: d.timezone,
    priceAmount: d.priceAmount,
    depositAmount: d.depositAmount,
    sharedRoomDiscountAmount: extras.sharedRoomDiscountAmount,
    currency: d.currency,
    capacity: d.capacity,
    available: d.availability.available,
    bookingDeadline: d.bookingDeadline,
    balanceDueDate: d.balanceDueDate,
    cancellationPolicy: d.cancellationPolicy,
    stayOptions: extras.stayOptions,
    addOns: extras.addOns,
  };

  const stepParam = Number(typeof sp.step === "string" ? sp.step : 1);
  const initialStep = Number.isInteger(stepParam) ? stepParam : 1;

  return (
    <>
      <div className="mx-auto w-full max-w-5xl px-6 pt-6">
        <Link
          href={`/tours/${tour.slug}/departures/${d.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground no-underline hover:text-link"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to departure
        </Link>
      </div>
      <CheckoutWizard
        departure={departure}
        user={user ? { id: user.id, email: user.email ?? null } : null}
        initialStep={initialStep}
        cancelled={sp.cancelled === "1"}
      />
      <TrackView
        event="start_checkout"
        params={{
          tour_id: tour.id,
          departure_id: d.id,
          currency: d.currency,
          value: d.priceAmount / 100,
        }}
      />
    </>
  );
}
