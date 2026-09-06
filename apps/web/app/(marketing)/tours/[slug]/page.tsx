import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Gauge, MoonStar, Users } from "lucide-react";
import { brand } from "@guideless/config";
import { formatMoney } from "@guideless/utils";
import { TrackView } from "@/components/analytics/track-view";
import { JsonLd } from "@/components/site/json-ld";
import { RouteArt } from "@/components/site/route-art";
import { DepartureList } from "@/components/tours/departure-list";
import { Faq } from "@/components/tours/faq";
import { ItineraryTimeline } from "@/components/tours/itinerary-timeline";
import { ResponsibilityList } from "@/components/tours/responsibility-list";
import { buttonVariants } from "@/components/ui/button";
import { getTourBySlug, listTourSlugs } from "@/lib/data/tours";
import { tourFromPrice } from "@/lib/data/tour-filters";
import { breadcrumbJsonLd, faqJsonLd, tourJsonLd } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const revalidate = 300;
export const dynamicParams = true;

const LEVEL_LABEL = {
  relaxed: "Relaxed pace",
  moderate: "Moderate pace",
  active: "Active pace",
} as const;

export async function generateStaticParams() {
  const slugs = await listTourSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata(props: PageProps<"/tours/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const detail = await getTourBySlug(slug);
  if (!detail) return { title: "Trip not found" };
  const { tour, version, route } = detail;
  const description =
    version.seo_description ??
    version.summary ??
    `${tour.duration_days} days through ${route.map((r) => r.destination.name).join(", ")}. ${brand.tagline}`;
  return {
    // A hand-written SEO title already includes the brand; skip the layout's "· Guideless" template.
    title: version.seo_title ? { absolute: version.seo_title } : tour.name,
    description,
    alternates: { canonical: `/tours/${tour.slug}` },
    openGraph: {
      title: version.seo_title ?? `${tour.name} · ${brand.name}`,
      description,
      type: "website",
      images: version.hero_image_url ? [version.hero_image_url] : undefined,
    },
  };
}

export default async function TourPage(props: PageProps<"/tours/[slug]">) {
  const { slug } = await props.params;
  const detail = await getTourBySlug(slug);
  if (!detail) notFound();

  const { tour, version, route, days, included, excluded, faqs, departures } = detail;
  const price = tourFromPrice({
    tour,
    version,
    destinations: route.map((r) => r.destination),
    departures,
  });
  const nights = route.reduce((n, r) => n + r.nights, 0);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink text-cloud">
        <div className="absolute inset-0 opacity-70">
          <RouteArt stops={route.length || 3} />
        </div>
        <div
          className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/30"
          aria-hidden
        />
        <div className="relative mx-auto w-full max-w-6xl px-6 pt-20 pb-16 md:pt-28 md:pb-20">
          <nav aria-label="Breadcrumb" className="text-sm text-cloud/70">
            <Link href="/tours" className="text-cloud/70 no-underline hover:text-cloud">
              Trips
            </Link>
            <span className="mx-2" aria-hidden>
              /
            </span>
            <span>{tour.name}</span>
          </nav>
          <p className="mt-6 text-sm font-medium uppercase tracking-[0.22em] text-aqua">
            {route.map((r) => r.destination.name).join(" → ")}
          </p>
          <h1 className="mt-3 max-w-3xl text-5xl font-bold leading-[1.02] md:text-7xl">
            {tour.name}
          </h1>
          {version.tagline && (
            <p className="mt-6 max-w-xl text-lg text-cloud/80 md:text-xl">{version.tagline}</p>
          )}

          <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 text-sm">
            <div className="flex items-center gap-2">
              <MoonStar className="h-4 w-4 text-aqua" aria-hidden />
              <dt className="sr-only">Duration</dt>
              <dd>
                {tour.duration_days} days · {nights} nights
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-aqua" aria-hidden />
              <dt className="sr-only">Group size</dt>
              <dd>
                {tour.group_size_min}–{tour.group_size_max} travelers
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-aqua" aria-hidden />
              <dt className="sr-only">Pace</dt>
              <dd>{LEVEL_LABEL[tour.activity_level]}</dd>
            </div>
            {price && (
              <div className="flex items-center gap-2">
                <dt className="text-cloud/70">From</dt>
                <dd className="font-heading text-base font-bold">
                  {formatMoney(price, { compact: true })}
                </dd>
              </div>
            )}
          </dl>
          <div className="mt-10 flex flex-wrap gap-3">
            <a href="#departures" className={buttonVariants({ variant: "inverse", size: "lg" })}>
              See dates &amp; book <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            <a
              href="#itinerary"
              className={cn(
                buttonVariants({ size: "lg" }),
                "border border-cloud/30 bg-transparent text-cloud hover:bg-cloud/10",
              )}
            >
              Day by day
            </a>
          </div>
        </div>
      </section>

      {/* Overview */}
      <section className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-20 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6 text-lg leading-relaxed">
          {version.summary && <p>{version.summary}</p>}
          {version.description && <p className="text-muted-foreground">{version.description}</p>}
          {version.why_this_trip && (
            <blockquote className="border-l-4 border-aqua pl-5 font-heading text-2xl font-semibold">
              {version.why_this_trip}
            </blockquote>
          )}
        </div>
        <aside className="rounded-xl border border-border bg-surface p-6">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Your route
          </h2>
          <ol className="mt-4 space-y-4">
            {route.map((stop, i) => (
              <li key={stop.destination.id} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-aqua/30 font-heading text-xs font-bold text-ink">
                  {i + 1}
                </span>
                <div>
                  <Link
                    href={`/destinations/${stop.destination.slug}`}
                    className="font-semibold text-foreground no-underline hover:text-link"
                  >
                    {stop.destination.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {stop.nights} {stop.nights === 1 ? "night" : "nights"}
                    {stop.destination.region ? ` · ${stop.destination.region}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      {/* Included / excluded */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-20">
        <h2 className="text-3xl font-bold md:text-4xl">Who handles what.</h2>
        <p className="mt-2 max-w-xl text-muted-foreground">
          The one thing every traveler should know before booking.
        </p>
        <div className="mt-8">
          <ResponsibilityList included={included} excluded={excluded} />
        </div>
      </section>

      {/* Itinerary */}
      <section id="itinerary" className="scroll-mt-24 bg-surface py-20">
        <div className="mx-auto w-full max-w-6xl px-6">
          <h2 className="text-3xl font-bold md:text-4xl">Day by day.</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Times are local. Anything marked{" "}
            <span className="font-medium text-foreground">Optional</span> is exactly that. The
            dashed blocks are free time — on purpose.
          </p>
          <div className="mt-10 max-w-3xl">
            <ItineraryTimeline days={days} />
          </div>
        </div>
      </section>

      {/* Departures */}
      <section id="departures" className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 py-20">
        <h2 className="text-3xl font-bold md:text-4xl">Dates &amp; prices.</h2>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Prices are per traveler and include everything under &ldquo;Guideless handles&rdquo;.
          Reserve with a deposit; the balance is due before departure.
        </p>
        <div className="mt-8">
          <DepartureList tourSlug={tour.slug} departures={departures} />
        </div>
      </section>

      {/* FAQ */}
      {faqs.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-6 pb-24">
          <h2 className="text-3xl font-bold md:text-4xl">Questions about this trip.</h2>
          <div className="mt-8 max-w-3xl">
            <Faq items={faqs} />
          </div>
        </section>
      )}

      <TrackView event="view_tour" params={{ tour_id: tour.id, tour_slug: tour.slug }} />
      <JsonLd data={tourJsonLd({ tour, version, route, departures, days })} />
      <JsonLd data={faqJsonLd(faqs)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Trips", path: "/tours" },
          { name: tour.name, path: `/tours/${tour.slug}` },
        ])}
      />
    </>
  );
}
