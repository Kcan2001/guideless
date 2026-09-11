import type { Metadata } from "next";
import Link from "next/link";
import { TrackView } from "@/components/analytics/track-view";
import { JsonLd } from "@/components/site/json-ld";
import { TourCard } from "@/components/tours/tour-card";
import { TourFilters } from "@/components/tours/tour-filters";
import { buttonVariants } from "@/components/ui/button";
import {
  availableDestinations,
  availableMonths,
  filterTours,
  hasActiveFilters,
  parseTourFilters,
} from "@/lib/data/tour-filters";
import { listPublishedTours } from "@/lib/data/tours";
import { breadcrumbJsonLd } from "@/lib/seo";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Trips",
  description:
    "Small-group trips with hotels, trains and selected experiences organized — and the exploring left to you.",
  alternates: { canonical: "/tours" },
};

export default async function ToursPage(props: PageProps<"/tours">) {
  const searchParams = await props.searchParams;
  const filters = parseTourFilters(searchParams);
  const all = await listPublishedTours();
  const items = filterTours(all, filters);
  const active = hasActiveFilters(filters);

  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-6 pt-20 pb-10">
        <p className="eyebrow text-muted-foreground">Trips</p>
        <h1 className="mt-3 text-5xl md:text-6xl">Pick a route.</h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Every trip is organized end to end and experienced entirely on your own terms.
        </p>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <TourFilters
          filters={filters}
          destinations={availableDestinations(all)}
          months={availableMonths(all)}
        />

        <p className="mt-6 text-sm text-muted-foreground" role="status">
          {items.length === 0
            ? "No trips match those filters."
            : active
              ? `${items.length} ${items.length === 1 ? "trip matches" : "trips match"}`
              : `${items.length} ${items.length === 1 ? "trip" : "trips"}`}
        </p>

        {items.length > 0 ? (
          <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <TourCard key={item.tour.id} item={item} headingLevel="h2" />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded border border-dashed border-border p-10 text-center">
            <p className="font-heading text-lg font-semibold">
              {all.length === 0 ? "Our first routes are being finalized." : "Nothing here yet."}
            </p>
            <p className="mt-1 text-muted-foreground">
              {all.length === 0
                ? "Southern France — Nice, Avignon, Paris — is up first."
                : "Try a different month or destination."}
            </p>
            {active && (
              <Link
                href="/tours"
                className={buttonVariants({ variant: "secondary", size: "sm" }) + " mt-5"}
              >
                Clear filters
              </Link>
            )}
          </div>
        )}
      </section>

      <TrackView
        event={active ? "filter_tours" : "search_tours"}
        params={{ results: items.length }}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Trips", path: "/tours" },
        ])}
      />
    </>
  );
}
