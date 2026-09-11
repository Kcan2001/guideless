import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { CalendarDays, MapPin, Wine } from "lucide-react";
import { brand } from "@guideless/config";
import { formatDate, formatDateRange } from "@guideless/utils";
import { DestinationAlertForm } from "@/components/growth/destination-alert-form";
import { WhatsComingFlash } from "@/components/growth/whats-coming-flash";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listWhatsComing } from "@/lib/growth/saved";
import { createPublicClient } from "@/lib/supabase/public";

/** Rebuilt every ten minutes: a drop opening is time-sensitive, but not to the second. */
export const revalidate = 600;

export const metadata: Metadata = {
  title: "What's coming",
  description:
    "Trips opening, departures still to run and city evenings — everything Guideless has coming up, in one place.",
  alternates: { canonical: "/whats-coming" },
};

/**
 * The answer to "is anything happening?" for somebody who is not currently planning a trip.
 *
 * Brief item 8. The honest problem it solves is that we gave people nothing to do between trips:
 * you either booked or you left. This is deliberately public and deliberately not a sales page —
 * the ask at the bottom is an email, not a checkout.
 */
export default async function WhatsComingPage() {
  const coming = await listWhatsComing(40);
  const sb = createPublicClient();
  const { data: destinations } = await sb
    .from("destinations")
    .select("id, name, country_name")
    .order("name");

  const drops = coming.filter((c) => c.kind === "departure" && c.notYetOpen);
  const departures = coming.filter((c) => c.kind === "departure" && !c.notYetOpen);
  const meetups = coming.filter((c) => c.kind === "meetup");

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {brand.shortName}
      </p>
      <h1 className="mt-3 text-4xl font-bold md:text-5xl">What&rsquo;s coming.</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
        Everything we have scheduled, and everything about to open. Nothing here needs you to book
        anything — it&rsquo;s just what&rsquo;s happening.
      </p>

      <Suspense fallback={null}>
        <WhatsComingFlash />
      </Suspense>

      {drops.length > 0 && (
        <section className="mt-12">
          <h2 className="font-heading text-2xl font-semibold">Opening soon</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Priced and visible, not yet bookable. They open on the date shown.
          </p>
          <ul className="mt-4 grid gap-4">
            {drops.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center gap-4 rounded border border-border bg-surface p-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-lg font-semibold">{d.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {d.startDate && d.endDate ? formatDateRange(d.startDate, d.endDate) : ""}
                  </p>
                </div>
                <Badge variant="info">Opens {formatDate(d.opensAt!.slice(0, 10))}</Badge>
                {d.slug && (
                  <Link
                    href={`/tours/${d.slug}` as Route}
                    className={buttonVariants({ variant: "secondary", size: "sm" })}
                  >
                    Have a look
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {departures.length > 0 && (
        <section className="mt-12">
          <h2 className="font-heading text-2xl font-semibold">Still to run</h2>
          <ul className="mt-4 grid gap-4">
            {departures.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center gap-4 rounded border border-border bg-surface p-5"
              >
                <CalendarDays className="h-4 w-4 text-teal" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{d.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {d.startDate && d.endDate ? formatDateRange(d.startDate, d.endDate) : ""}
                  </p>
                </div>
                {d.slug && (
                  <Link
                    href={`/tours/${d.slug}` as Route}
                    className="text-sm text-link no-underline"
                  >
                    Details →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {meetups.length > 0 && (
        <section className="mt-12">
          <h2 className="font-heading text-2xl font-semibold">Evenings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            No trip required. Come and meet people who travel the way you do.
          </p>
          <ul className="mt-4 grid gap-4">
            {meetups.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-4 rounded border border-border bg-surface p-5"
              >
                <Wine className="h-4 w-4 text-teal" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{m.title}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    {m.city} · {formatDate(m.happensAt.slice(0, 10))}
                  </p>
                </div>
                <Link href="/meetups" className="text-sm text-link no-underline">
                  Details →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {coming.length === 0 && (
        <p className="mt-12 rounded border border-border bg-surface p-6 text-muted-foreground">
          Nothing scheduled at the moment. Leave your email below and you&rsquo;ll be the first to
          know when there is.
        </p>
      )}

      <section className="mt-16 rounded border border-border bg-cloud p-8" id="tell-me">
        <h2 className="font-heading text-2xl font-semibold">Tell me when</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Pick somewhere we already go, or tell us where you&rsquo;d rather we went. We only run two
          trips today, and what people ask for is how we decide the third.
        </p>
        <div className="mt-6 max-w-xl">
          <DestinationAlertForm
            destinations={destinations ?? []}
            returnTo="/whats-coming"
            source="whats-coming"
          />
        </div>
      </section>
    </div>
  );
}
