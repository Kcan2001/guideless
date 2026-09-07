import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, Gauge, MapPin, MoonStar, Sparkles, Users } from "lucide-react";
import { brand } from "@guideless/config";
import { formatDateRange, formatMoney, formatWallTime } from "@guideless/utils";
import { TrackView } from "@/components/analytics/track-view";
import {
  AddOnList,
  EventTierMenu,
  ReferralHint,
  RoomRule,
  StayTiers,
} from "@/components/marketing/make-it-yours";
import { JsonLd } from "@/components/site/json-ld";
import { PhotoBackdrop } from "@/components/site/photo-hero";
import { PhotoGallery } from "@/components/tours/photo-gallery";
import { DepartureList } from "@/components/tours/departure-list";
import { Faq } from "@/components/tours/faq";
import { ItineraryTimeline } from "@/components/tours/itinerary-timeline";
import { ResponsibilityList } from "@/components/tours/responsibility-list";
import { buttonVariants } from "@/components/ui/button";
import { tourEventJsonLd } from "@/lib/community/seo";
import { getRoomRule } from "@/lib/data/community";
import { listDepartureExtras } from "@/lib/data/extras";
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
  const isEvent = tour.kind === "event";
  const next = departures[0];
  const [extras, roomRule] = next
    ? await Promise.all([listDepartureExtras(next.id), getRoomRule(next.id)])
    : [null, null];
  const currency = next?.currency ?? version.starting_price_currency;
  const anchor = days
    .flatMap((d) => d.items.map((i) => ({ item: i, day: d })))
    .find((x) => x.item.is_anchor);
  const hasExtras = !!extras && (extras.stayOptions.length > 0 || extras.addOns.length > 0);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink text-cloud">
        <PhotoBackdrop
          src={version.hero_image_url}
          fallbackAlt={`${tour.name}: ${route.map((r) => r.destination.name).join(", ")}`}
          stops={route.length || 3}
          priority
          className={version.hero_image_url ? undefined : "opacity-70"}
        />
        <div
          className={
            version.hero_image_url
              ? "absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/70 to-ink/20"
              : "absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/30"
          }
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
            {isEvent && tour.event_name
              ? tour.event_name
              : route.map((r) => r.destination.name).join(" → ")}
          </p>
          <h1 className="mt-3 max-w-3xl text-5xl font-bold leading-[1.02] md:text-7xl">
            {tour.name}
          </h1>
          {isEvent && tour.event_starts_on && (
            <p
              className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-cloud/85"
              data-testid="event-hero"
            >
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-aqua" aria-hidden />
                {tour.event_ends_on && tour.event_ends_on !== tour.event_starts_on
                  ? formatDateRange(tour.event_starts_on, tour.event_ends_on)
                  : formatDateRange(tour.event_starts_on, tour.event_starts_on)}
              </span>
              {tour.event_location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-aqua" aria-hidden /> {tour.event_location}
                </span>
              )}
              <span className="text-cloud/70">
                · {route.map((r) => r.destination.name).join(" & ")}
              </span>
            </p>
          )}
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

      {version.gallery_image_urls.length > 0 && (
        <section
          aria-labelledby="gallery-heading"
          className="mx-auto w-full max-w-6xl px-6 pt-12 md:pt-16"
        >
          <h2 id="gallery-heading" className="sr-only">
            Photos from {tour.name}
          </h2>
          <PhotoGallery images={version.gallery_image_urls} subject={tour.name} />
        </section>
      )}

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

      {/* Make it yours */}
      {hasExtras && extras && (
        <section id="make-it-yours" className="scroll-mt-24 bg-surface py-20">
          <div className="mx-auto w-full max-w-6xl px-6">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
              {isEvent ? "Race weekend, your way" : "Make it yours"}
            </p>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl">
              {isEvent
                ? "Your hotel, your seat, your call."
                : "Pay for what you want. Skip what you don't."}
            </h2>
            <p className="mt-2 max-w-xl text-muted-foreground">
              The base trip is the hotels, the trains and the welcome drinks. Everything below is
              optional, chosen at booking or any time later, even mid-trip. You always see who else
              is in.
            </p>
            <div className="mt-10">
              {isEvent ? (
                <EventTierMenu
                  stayOptions={extras.stayOptions}
                  addOns={extras.addOns}
                  currency={currency}
                  eventName={tour.event_name ?? tour.name}
                />
              ) : (
                <div className="grid gap-10 lg:grid-cols-2">
                  <StayTiers options={extras.stayOptions} currency={currency} />
                  <AddOnList addOns={extras.addOns} currency={currency} featuredOnly />
                </div>
              )}
            </div>
            <div className="mt-8 space-y-2">
              <RoomRule rule={roomRule} />
              <ReferralHint />
            </div>
          </div>
        </section>
      )}

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
          {anchor && (
            <aside
              className="mt-10 max-w-3xl rounded-2xl border border-aqua bg-aqua/10 p-6"
              aria-labelledby="night-one"
              data-testid="anchor-callout"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Night one · Day {anchor.day.day_number}
              </p>
              <h3
                id="night-one"
                className="mt-1 flex items-center gap-2 font-heading text-2xl font-semibold"
              >
                <Sparkles className="h-5 w-5 text-teal" aria-hidden /> {anchor.item.title}
                {anchor.item.start_time ? ` · ${formatWallTime(anchor.item.start_time)}` : ""}
              </h3>
              {anchor.item.description && (
                <p className="mt-2 text-muted-foreground">{anchor.item.description}</p>
              )}
              <p className="mt-3 text-sm text-muted-foreground">
                Everyone is invited, nobody is obliged. In the app you see who&rsquo;s coming, and
                the group opens weeks before you fly.
              </p>
            </aside>
          )}
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
      {isEvent && tour.event_name && tour.event_starts_on && (
        <JsonLd
          data={tourEventJsonLd({
            name: tour.name,
            slug: tour.slug,
            eventName: tour.event_name,
            startsOn: tour.event_starts_on,
            endsOn: tour.event_ends_on,
            location: tour.event_location,
            description: version.summary,
            priceAmount: price?.amount ?? null,
            currency: price?.currency ?? null,
          })}
        />
      )}
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
