import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, CalendarDays, Clock, Users } from "lucide-react";
import { formatDate, formatDateRange, formatMoney, subtract } from "@guideless/utils";
import { TrackView } from "@/components/analytics/track-view";
import { AddOnList, ReferralHint, RoomRule, StayTiers } from "@/components/marketing/make-it-yours";
import { RosterStrip } from "@/components/marketing/roster-strip";
import { JsonLd } from "@/components/site/json-ld";
import { availabilityBadge } from "@/components/tours/departure-list";
import { ResponsibilityList } from "@/components/tours/responsibility-list";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getRoomRule } from "@/lib/data/community";
import { getRosterStats, listDepartureExtras } from "@/lib/data/extras";
import { getDepartureById } from "@/lib/data/tours";
import { breadcrumbJsonLd } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const revalidate = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(
  props: PageProps<"/tours/[slug]/departures/[departureId]">,
): Promise<Metadata> {
  const { departureId } = await props.params;
  if (!UUID.test(departureId)) return { title: "Departure not found" };
  const detail = await getDepartureById(departureId);
  if (!detail) return { title: "Departure not found" };
  const { tour, departure } = detail;
  return {
    title: `${tour.name} · ${formatDateRange(departure.startDate, departure.endDate)}`,
    description: `Book the ${formatDateRange(departure.startDate, departure.endDate)} departure of ${tour.name}. Hotels, trains and experiences organized; the exploring is yours.`,
    alternates: { canonical: `/tours/${tour.slug}/departures/${departure.id}` },
  };
}

export default async function DeparturePage(
  props: PageProps<"/tours/[slug]/departures/[departureId]">,
) {
  const { slug, departureId } = await props.params;
  if (!UUID.test(departureId)) notFound();
  const detail = await getDepartureById(departureId);
  if (!detail) notFound();
  if (detail.tour.slug !== slug) redirect(`/tours/${detail.tour.slug}/departures/${departureId}`);

  const { departure: d, tour, route, included, excluded } = detail;
  const [extras, roster, roomRule] = await Promise.all([
    listDepartureExtras(d.id),
    getRosterStats(d.id),
    getRoomRule(d.id),
  ]);
  const hasExtras = extras.stayOptions.length > 0 || extras.addOns.length > 0;
  const money = (amount: number) =>
    formatMoney({ amount, currency: d.currency }, { compact: true });
  const badge = availabilityBadge(d);
  const soldOut = d.availability.available <= 0;
  const balance = subtract(
    { amount: d.priceAmount, currency: d.currency },
    { amount: d.depositAmount, currency: d.currency },
  );
  const tiers = [...d.cancellationPolicy].sort(
    (a, b) => b.daysBeforeDeparture - a.daysBeforeDeparture,
  );

  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-6 pt-16 pb-10">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link href="/tours" className="text-muted-foreground no-underline hover:text-link">
            Trips
          </Link>
          <span className="mx-2" aria-hidden>
            /
          </span>
          <Link
            href={`/tours/${tour.slug}`}
            className="text-muted-foreground no-underline hover:text-link"
          >
            {tour.name}
          </Link>
          <span className="mx-2" aria-hidden>
            /
          </span>
          <span>{formatDateRange(d.startDate, d.endDate)}</span>
        </nav>
        <p className="mt-6 text-sm font-medium uppercase tracking-[0.22em] text-link">
          {route.map((r) => r.destination.name).join(" → ")}
        </p>
        <h1 className="mt-3 text-4xl font-bold md:text-6xl">{tour.name}</h1>
        <p className="mt-3 flex flex-wrap items-center gap-3 text-xl">
          <CalendarDays className="h-5 w-5 text-muted-foreground" aria-hidden />
          {formatDateRange(d.startDate, d.endDate)}
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </p>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 pb-20 lg:grid-cols-[1fr_380px]">
        <div className="space-y-12">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Group</p>
              <p className="mt-1 flex items-center gap-2 text-lg font-semibold">
                <Users className="h-4 w-4 text-muted-foreground" aria-hidden />{" "}
                {d.availability.confirmed} of {d.capacity} booked
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Departs with {d.minimumTravelers}+ travelers
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Booking deadline
              </p>
              <p className="mt-1 flex items-center gap-2 text-lg font-semibold">
                <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
                {d.bookingDeadline ? formatDate(d.bookingDeadline) : "Until full"}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Time zone</p>
              <p className="mt-1 text-lg font-semibold">{d.timezone.replace("_", " ")}</p>
              <p className="mt-1 text-sm text-muted-foreground">All itinerary times are local</p>
            </div>
          </div>

          <RosterStrip stats={roster} />

          {hasExtras && (
            <div id="make-it-yours" className="scroll-mt-24 space-y-8">
              <div>
                <h2 className="text-2xl font-bold">Make it yours.</h2>
                <p className="mt-2 text-muted-foreground">
                  Choose at booking or add later from your account, even during the trip. Add-ons
                  are paid in full when chosen and never count toward the deposit.
                </p>
              </div>
              <StayTiers options={extras.stayOptions} currency={d.currency} />
              <AddOnList addOns={extras.addOns} currency={d.currency} />
              <RoomRule rule={roomRule} />
              <ReferralHint />
            </div>
          )}

          <div>
            <h2 className="text-2xl font-bold">Payment schedule</h2>
            <dl className="mt-4 divide-y divide-border rounded-xl border border-border bg-surface">
              <div className="flex justify-between gap-4 p-4">
                <dt>Deposit at booking</dt>
                <dd className="font-semibold">
                  {d.depositAmount > 0 ? money(d.depositAmount) : "None"}
                </dd>
              </div>
              <div className="flex justify-between gap-4 p-4">
                <dt>
                  Balance
                  {d.balanceDueDate
                    ? ` due ${formatDate(d.balanceDueDate)}`
                    : " due before departure"}
                </dt>
                <dd className="font-semibold">{money(balance.amount)}</dd>
              </div>
              <div className="flex justify-between gap-4 p-4 font-semibold">
                <dt>Total per traveler · own room</dt>
                <dd>{money(d.priceAmount)}</dd>
              </div>
              <div className="flex justify-between gap-4 p-4 text-sm text-muted-foreground">
                <dt>Add-ons and stay upgrades</dt>
                <dd>Paid in full when chosen</dd>
              </div>
            </dl>
          </div>

          <div>
            <h2 className="text-2xl font-bold">Cancellation policy</h2>
            <p className="mt-2 text-muted-foreground">
              Refund of the amount paid, by how far ahead you cancel.
            </p>
            <table className="mt-4 w-full overflow-hidden rounded-xl border border-border bg-surface text-left text-sm">
              <thead className="bg-cloud text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Cancel
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Refund
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tiers.map((t, i) => {
                  // Sorted descending: [60, 30, 15, 0] → "60+", "30–59", "15–29", "0–14".
                  const prev = tiers[i - 1];
                  const label = prev
                    ? `${t.daysBeforeDeparture}–${prev.daysBeforeDeparture - 1} days before`
                    : `${t.daysBeforeDeparture}+ days before`;
                  return (
                    <tr key={t.daysBeforeDeparture}>
                      <td className="px-4 py-3">{label}</td>
                      <td className="px-4 py-3 font-semibold">{t.refundPercentage}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div>
            <h2 className="text-2xl font-bold">Who handles what.</h2>
            <div className="mt-6">
              <ResponsibilityList included={included} excluded={excluded} />
            </div>
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Per traveler · own room
            </p>
            <p className="mt-1 font-heading text-4xl font-bold">{money(d.priceAmount)}</p>
            {d.depositAmount > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                {money(d.depositAmount)} deposit today
              </p>
            )}
            <div className="mt-6 space-y-2">
              {soldOut ? (
                <span
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "pointer-events-none w-full opacity-50",
                  )}
                >
                  Sold out
                </span>
              ) : (
                <Link
                  href={`/checkout/${d.id}`}
                  className={cn(buttonVariants({ size: "lg" }), "w-full")}
                >
                  Book this departure <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              )}
              <Link
                href={`/tours/${tour.slug}#itinerary`}
                className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "w-full")}
              >
                Day-by-day itinerary
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              {d.availability.available > 0
                ? `${d.availability.available} of ${d.capacity} spots open.`
                : "Join the waitlist by emailing us."}{" "}
              Flights not included.
            </p>
          </div>
        </aside>
      </section>

      <TrackView
        event="view_departure"
        params={{
          tour_id: tour.id,
          departure_id: d.id,
          currency: d.currency,
          value: d.priceAmount / 100,
        }}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Trips", path: "/tours" },
          { name: tour.name, path: `/tours/${tour.slug}` },
          {
            name: formatDateRange(d.startDate, d.endDate),
            path: `/tours/${tour.slug}/departures/${d.id}`,
          },
        ])}
      />
    </>
  );
}
