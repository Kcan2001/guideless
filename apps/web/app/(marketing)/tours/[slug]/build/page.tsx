import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { ArrowLeft } from "lucide-react";
import { TrackView } from "@/components/analytics/track-view";
import type { BuilderDepartureSummary } from "@/components/builder/departure-step";
import { TripBuilder } from "@/components/builder/trip-builder";
import type { CheckoutDeparture } from "@/components/checkout/types";
import { deriveBuilderSteps, resolveStep } from "@/lib/bookings/builder-steps";
import { loadBuilderDraft } from "@/lib/bookings/drafts";
import { listDepartureExtras } from "@/lib/data/extras";
import { refreshStaleRatesForDeparture } from "@/lib/hotels/search";
import { getTourBySlug } from "@/lib/data/tours";
import { enabledAuthProviders } from "@/lib/auth/providers";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/tours/[slug]/build">): Promise<Metadata> {
  const { slug } = await props.params;
  const detail = await getTourBySlug(slug);
  return {
    title: detail ? `Build your ${detail.tour.name}` : "Build your trip",
    robots: { index: false, follow: false },
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The Trip Builder (plan v2 §13). `?departure=` picks the dates (default: the next open one),
 * `?step=` resumes, `?cancelled=1` comes back from Stripe. Choosing another departure reloads
 * this page with its own extras; the draft is kept per departure.
 */
export default async function BuildPage(props: PageProps<"/tours/[slug]/build">) {
  const [{ slug }, sp] = await Promise.all([props.params, props.searchParams]);
  const detail = await getTourBySlug(slug);
  if (!detail) notFound();
  const { tour, route, departures, days } = detail;

  const requested =
    typeof sp.departure === "string" && UUID.test(sp.departure) ? sp.departure : null;
  const chosen =
    (requested && departures.find((d) => d.id === requested)) ??
    departures.find((d) => d.availability.available > 0) ??
    departures[0];
  if (!chosen) notFound();

  const supabase = await createClient();
  const [extras, userRes, serverDraft] = await Promise.all([
    listDepartureExtras(chosen.id),
    supabase.auth.getUser(),
    loadBuilderDraft(chosen.id),
  ]);
  const user = userRes.data.user;
  const providers = await enabledAuthProviders();

  // Somebody is about to choose between these tiers, so make sure the cost data behind them is
  // current rather than up to six hours old from the last cron run. This runs after the response
  // is sent, refetches only tiers whose stored rate has gone stale, and never changes what this
  // page displays — see refreshStaleRatesForDeparture for why all three of those matter.
  after(async () => {
    try {
      await refreshStaleRatesForDeparture(chosen.id);
    } catch {
      // A supplier being slow or down must never surface on a page a traveler is trying to book on.
      // The nightly cron and the recheck inside startCheckout are both still there behind this.
    }
  });

  const departure: CheckoutDeparture = {
    id: chosen.id,
    tourSlug: tour.slug,
    tourName: tour.name,
    routeNames: route.map((r) => r.destination.name),
    startDate: chosen.startDate,
    endDate: chosen.endDate,
    timezone: chosen.timezone,
    priceAmount: chosen.priceAmount,
    depositAmount: chosen.depositAmount,
    sharedRoomDiscountAmount: extras.sharedRoomDiscountAmount,
    currency: chosen.currency,
    capacity: chosen.capacity,
    available: chosen.availability.available,
    bookingDeadline: chosen.bookingDeadline,
    balanceDueDate: chosen.balanceDueDate,
    cancellationPolicy: chosen.cancellationPolicy,
    stayOptions: extras.stayOptions,
    addOns: extras.addOns,
  };
  const summaries: BuilderDepartureSummary[] = departures.map((d) => ({
    id: d.id,
    startDate: d.startDate,
    endDate: d.endDate,
    priceAmount: d.priceAmount,
    depositAmount: d.depositAmount,
    currency: d.currency,
    available: d.availability.available,
    guaranteed: d.status === "guaranteed",
  }));
  const steps = deriveBuilderSteps({
    stayOptionCount: extras.stayOptions.length,
    addOns: extras.addOns,
    eventName: tour.event_name,
  });
  const savedStep = (serverDraft?.draft as { step?: unknown } | undefined)?.step;
  const initialStep = resolveStep(steps, sp.step ?? savedStep);

  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-6 pt-6">
        <Link
          href={`/tours/${tour.slug}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground no-underline hover:text-link"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to {tour.name}
        </Link>
      </div>
      <TripBuilder
        tourSlug={tour.slug}
        departure={departure}
        tripDays={days.map((d) => ({
          day_number: d.day_number,
          title: d.title,
          destination: d.destination?.name ?? null,
        }))}
        departures={summaries}
        steps={steps}
        user={user ? { id: user.id, email: user.email ?? null } : null}
        googleEnabled={providers.google}
        initialStep={initialStep}
        cancelled={sp.cancelled === "1"}
        serverDraft={serverDraft}
      />
      <TrackView
        event="start_checkout"
        params={{
          tour_id: tour.id,
          departure_id: chosen.id,
          currency: chosen.currency,
          value: chosen.priceAmount / 100,
        }}
      />
    </>
  );
}
