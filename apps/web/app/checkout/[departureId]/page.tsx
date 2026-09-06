import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { brand } from "@guideless/config";
import { formatDateRange, formatMoney } from "@guideless/utils";
import { TrackView } from "@/components/analytics/track-view";
import { buttonVariants } from "@/components/ui/button";
import { getDepartureById } from "@/lib/data/tours";

export const revalidate = 60;
export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checkout entry point. Milestone 4 replaces this with the 7-step flow (departure → travelers →
 * preferences → account → terms → Stripe → confirmation). For now it confirms the selection and
 * fires the start_checkout event so the funnel is measurable from day one.
 */
export default async function CheckoutPage(props: PageProps<"/checkout/[departureId]">) {
  const { departureId } = await props.params;
  if (!UUID.test(departureId)) notFound();
  const detail = await getDepartureById(departureId);
  if (!detail) notFound();
  const { departure: d, tour, route } = detail;
  const money = (amount: number) =>
    formatMoney({ amount, currency: d.currency }, { compact: true });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 text-foreground no-underline">
          <Image
            src="/brand/guideless-logo.webp"
            alt=""
            width={32}
            height={32}
            className="rounded-md"
          />
          <span className="font-heading font-bold">{brand.shortName}</span>
        </Link>
        <Link
          href={`/tours/${tour.slug}/departures/${d.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground no-underline hover:text-link"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to departure
        </Link>
      </header>

      <section className="mt-12 rounded-2xl border border-border bg-surface p-8">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Step 1 of 7 · Your departure
        </p>
        <h1 className="mt-3 text-3xl font-bold">{tour.name}</h1>
        <p className="mt-1 text-muted-foreground">
          {route.map((r) => r.destination.name).join(" → ")}
        </p>
        <dl className="mt-6 grid gap-4 sm:grid-cols-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Dates</dt>
            <dd className="font-semibold">{formatDateRange(d.startDate, d.endDate)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Per traveler</dt>
            <dd className="font-semibold">{money(d.priceAmount)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Deposit today</dt>
            <dd className="font-semibold">
              {d.depositAmount > 0 ? money(d.depositAmount) : "None"}
            </dd>
          </div>
        </dl>

        <div className="mt-8 rounded-xl border border-dashed border-teal bg-aqua/10 p-5">
          <p className="font-semibold">Online booking opens shortly.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Traveler details, preferences, terms and secure payment arrive in the next release.
            Until then, hold your place by emailing us — we will confirm within one business day.
          </p>
          <a
            href={`mailto:${brand.supportEmail}?subject=${encodeURIComponent(`Booking request: ${tour.name}, ${formatDateRange(d.startDate, d.endDate)}`)}`}
            className={buttonVariants({ size: "md" }) + " mt-4"}
          >
            Request this departure
          </a>
        </div>
      </section>

      <TrackView
        event="start_checkout"
        params={{
          tour_id: tour.id,
          departure_id: d.id,
          currency: d.currency,
          value: d.priceAmount / 100,
        }}
      />
    </main>
  );
}
