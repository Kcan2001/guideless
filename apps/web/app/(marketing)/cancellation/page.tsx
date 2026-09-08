import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { brand } from "@guideless/config";
import { formatDateRange } from "@guideless/utils";
import { PageHero, SectionHeading } from "@/components/marketing/page-hero";
import { JsonLd } from "@/components/site/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { listPublishedTours } from "@/lib/data/tours";
import { sitePhotos } from "@/lib/photos";
import { breadcrumbJsonLd } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Cancellation policy",
  description:
    "How cancellations and refunds work on a Guideless trip: published tiers per departure, deposits and balances on the same terms, add-ons refundable until their own deadline, and the refund shown in your account before you confirm.",
  alternates: { canonical: "/cancellation" },
};

const RULES = [
  {
    title: "Every departure publishes its tiers before you book.",
    body: "The tiers state what percentage of the trip price is refunded depending on how many days before departure you cancel. They are shown on the departure page, at checkout and in your account. They differ by trip, because the risk does: a touring route commits us to very little until about a month out, while an event weekend is prepaid months ahead and cannot be resold, so it steps down sooner.",
  },
  {
    title: "Deposits and balances follow the same tiers.",
    body: "There are no separate cancellation fees. Whatever you have paid toward the trip is refunded at the percentage for the day you cancel. No tier is 100%: refunding a card payment costs us the processing fee, so the top tier sits just below it instead of us inventing a fee to cover it.",
  },
  {
    title: "Extras follow their own deadline, not the tiers.",
    body: "Each optional extra shows its deadline when you add it, usually a few days before it happens. Before the deadline you get it back in full; after it, you do not. A few extras are non-refundable from the moment you buy them, because we buy them in your name and cannot hand them back — race tickets are the clear case — and those say so before you add them.",
  },
  {
    title: "You see the refund before you confirm.",
    body: "Request a cancellation from your account. It shows the refund percentage that applies that day and which add-ons are still refundable, before you commit. We confirm within two business days and refunds go back to the original payment method, usually within 10 business days.",
  },
  {
    title: "If we cancel, you get everything back.",
    body: "Each departure has a minimum number of travelers. If it is not reached by the booking deadline we may cancel it, and you choose a full refund or a transfer to another date. If we cancel for any other reason within our control, you receive a full refund of everything paid to us.",
  },
  {
    title: "Flights and your own bookings are yours.",
    body: "We refund what we control. Flights and anything you booked yourself are not part of our refund, which is why we strongly recommend travel insurance.",
  },
];

export default async function CancellationPage() {
  const tours = await listPublishedTours();
  const examples = tours
    .map((t) => ({ tour: t.tour, departure: t.departures[0] }))
    .filter((x) => x.departure && x.departure.cancellationPolicy.length > 0);

  return (
    <>
      <PageHero
        photo={sitePhotos.cancellation}
        fallbackAlt="Arcaded Haussmann buildings on a quiet Paris street"
        eyebrow="Cancellation policy"
        title="Plans change. Here is exactly what happens."
        lede="Refund tiers are published per departure before you book, and your account shows the refund you would get today before you confirm anything."
        compact
      />

      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <ul className="grid gap-6 md:grid-cols-2">
          {RULES.map((r) => (
            <li key={r.title} className="rounded-xl border border-border bg-surface p-6">
              <h2 className="text-lg font-semibold">{r.title}</h2>
              <p className="mt-2 text-muted-foreground">{r.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {examples.length > 0 && (
        <section className="bg-surface py-20">
          <div className="mx-auto w-full max-w-6xl px-6">
            <SectionHeading
              eyebrow="Current departures"
              title="The tiers on our next departures."
              lede="These are the live tiers from each trip's next departure, exactly as shown at checkout."
            />
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              {examples.map(({ tour, departure }) => {
                const tiers = [...departure!.cancellationPolicy].sort(
                  (a, b) => b.daysBeforeDeparture - a.daysBeforeDeparture,
                );
                return (
                  <div key={tour.id} className="rounded-xl border border-border bg-cloud p-6">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      {tour.name}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDateRange(departure!.startDate, departure!.endDate)}
                    </p>
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="pb-2 font-medium">Cancel</th>
                            <th className="pb-2 text-right font-medium">Refund of trip price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {tiers.map((t) => (
                            <tr key={t.daysBeforeDeparture}>
                              <td className="py-2">
                                {t.daysBeforeDeparture === 0
                                  ? "Less than the last tier before departure"
                                  : `${t.daysBeforeDeparture}+ days before departure`}
                              </td>
                              <td className="py-2 text-right font-semibold tabular-nums">
                                {t.refundPercentage}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Link
                      href={`/tours/${tour.slug}/departures/${departure!.id}`}
                      className={cn(buttonVariants({ variant: "link" }), "mt-3 px-0")}
                    >
                      This departure <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="grid gap-6 rounded-2xl border border-border bg-surface p-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="text-2xl font-bold">The full terms</h2>
            <p className="mt-2 text-muted-foreground">
              This page summarizes the cancellation sections of the {brand.name} Terms of Service,
              which govern. Travel insurance covers what we cannot.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/terms#cancellation-by-you"
              className={buttonVariants({ variant: "secondary" })}
            >
              Terms of Service
            </Link>
            <Link
              href="/travel-insurance"
              className={cn(buttonVariants({ variant: "link" }), "px-0")}
            >
              Travel insurance <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Cancellation policy", path: "/cancellation" },
        ])}
      />
    </>
  );
}
