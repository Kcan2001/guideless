import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { brand } from "@guideless/config";
import { formatDateRange, formatMoney } from "@guideless/utils";
import { CtaLink } from "@/components/analytics/cta-link";
import { AppShowcase } from "@/components/marketing/app-showcase";
import { CompareObserver } from "@/components/marketing/compare-observer";
import { CompareTable } from "@/components/marketing/compare-table";
import { ConfiguratorExampleCard } from "@/components/marketing/configurator-example";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { FounderBlock } from "@/components/marketing/founder-block";
import { SectionHeading } from "@/components/marketing/page-hero";
import { JsonLd } from "@/components/site/json-ld";
import { HeroScrim, heroEyebrowClass } from "@/components/site/hero-scrim";
import { HeroVideo } from "@/components/site/hero-video";
import { PhotoBackdrop } from "@/components/site/photo-hero";
import { TourCard } from "@/components/tours/tour-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { faqByIds, HOME_FAQ_IDS } from "@/content/faq";
import { listAppScreens } from "@/lib/app-screens";
import { getConfiguratorExample } from "@/lib/data/configurator";
import {} from "@/lib/data/extras";
import { listPublishedTours } from "@/lib/data/tours";
import { heroVideo, sitePhotos } from "@/lib/photos";
import { faqJsonLd } from "@/lib/seo";
import { cn } from "@/lib/utils";

// Title and description come from the root layout; this is only here so the homepage declares a
// canonical like every other indexable page. Without it the site's most-linked URL is the one page
// that never told a crawler which version of itself is authoritative.
export const metadata: Metadata = { alternates: { canonical: "/" } };

export const revalidate = 300;

const COMPARE = [
  {
    title: "Book everything yourself",
    lines: [
      "Hotel research in three cities.",
      "Train schedules and station changes.",
      "Which boat, which tickets, which transfer.",
      "Coordinating everyone's dates.",
      "Nobody to call when the train is cancelled.",
    ],
  },
  {
    title: "Traditional group tour",
    lines: [
      "Fixed itinerary, headcounts, a flag to follow.",
      "Mandatory activities and set meals.",
      "Forty people on a coach.",
      "A guide deciding your afternoon.",
      "One price for the whole package.",
    ],
  },
  {
    title: "Guideless",
    highlight: true,
    lines: [
      "Hotels, trains and transfers handled.",
      "Your free time is yours. No headcounts.",
      "A small group there when you want it.",
      "Choose your hotel, your seat, your extras.",
      "Add more later, from your phone.",
    ],
  },
];

export default async function HomePage() {
  const [tours, example] = await Promise.all([listPublishedTours(), getConfiguratorExample()]);
  const routes = tours.filter((t) => t.tour.kind !== "event");
  const events = tours.filter((t) => t.tour.kind === "event");
  const featured = routes.slice(0, 3);
  const screens = listAppScreens();
  const homeFaq = faqByIds(HOME_FAQ_IDS);

  return (
    <>
      {/* Hero. `data-hero-dark` is what tells the header to start transparent and sit on the
          photograph; `fadeToInk` dissolves the base into the trips band below instead of ending
          on a hard horizontal edge. */}
      <section data-hero-dark className="relative overflow-hidden bg-ink text-cloud">
        {/* The photograph is the poster and the LCP: Next preloads it, the largest paint happens
            on it, and the video resolves in on top once it can actually play. Reduced motion, a
            refused autoplay or a missing file all leave the photograph, which is a fine hero. */}
        <PhotoBackdrop
          src={sitePhotos.home}
          fallbackAlt="The Riviera at dusk"
          priority
          position="center 55%"
        />
        <HeroVideo
          webm={heroVideo.webm}
          mp4={heroVideo.mp4}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <HeroScrim fadeToInk />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col px-6 pt-32 pb-28 md:pt-44 md:pb-40">
          <p className={cn(heroEyebrowClass, "mb-6")}>Small-group trips to Europe &middot; 2027</p>
          {/* The accent carries one phrase per screen, and this is the screen's phrase. */}
          <h1 className="max-w-[13ch] text-5xl md:text-7xl">
            Group trips, <span className="text-aqua">built your way.</span>
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-cloud/85">
            Choose your hotel, your budget and your extras. We book every part of it, and the group
            is there when you want it and gone when you do not.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <CtaLink href="/tours" placement="home_hero" className={buttonVariants({ size: "lg" })}>
              See the trips <ArrowRight className="h-4 w-4" aria-hidden />
            </CtaLink>
            <CtaLink
              href="/how-it-works"
              placement="home_hero_secondary"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              How it works
            </CtaLink>
          </div>
        </div>
      </section>

      {/* Trips */}
      <section className="bg-ink pt-4 pb-24 text-cloud">
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow text-aqua">Open now</p>
              <h2 className="mt-3 text-3xl md:text-5xl">What&rsquo;s next?</h2>
            </div>
            <Link href="/tours" className={buttonVariants({ variant: "outline", size: "sm" })}>
              See all trips
            </Link>
          </div>
          {featured.length + events.length === 0 && (
            <p className="mt-12 text-cloud/70">Our first routes are being finalized.</p>
          )}

          {featured.length + events.length > 0 && (
            <ul
              className={cn(
                "mt-12 grid gap-6 md:grid-cols-2",
                featured.length + events.length >= 3 && "lg:grid-cols-3",
              )}
            >
              {featured.map((item) => (
                <li key={item.tour.id} className="grid">
                  <TourCard item={item} />
                </li>
              ))}
              {events.map(({ tour, version, destinations: dests, departures }) => {
                const next = departures[0];
                return (
                  <li
                    key={tour.id}
                    className="relative flex flex-col justify-between gap-6 overflow-hidden rounded bg-ink p-8 text-cloud"
                  >
                    {version.hero_image_url && (
                      <>
                        <PhotoBackdrop
                          src={version.hero_image_url}
                          fallbackAlt={tour.name}
                          sizes="(min-width: 768px) 50vw, 100vw"
                        />
                        <div
                          className="absolute inset-0 bg-gradient-to-t from-ink via-ink/85 to-ink/40"
                          aria-hidden
                        />
                      </>
                    )}
                    <div className="relative">
                      <p className="eyebrow text-cloud">Event weekend · {tour.event_name}</p>
                      <h3 className="mt-2 font-heading text-3xl ">{tour.name}</h3>
                      {version.tagline && <p className="mt-3 text-cloud/80">{version.tagline}</p>}
                      <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-cloud/80">
                        {tour.event_starts_on && (
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-4 w-4 text-aqua" aria-hidden />
                            {formatDateRange(
                              tour.event_starts_on,
                              tour.event_ends_on ?? tour.event_starts_on,
                            )}
                          </span>
                        )}
                        {tour.event_location && (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-4 w-4 text-aqua" aria-hidden />{" "}
                            {tour.event_location}
                          </span>
                        )}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {dests.map((d) => (
                          <Badge key={d.id} variant="guideless">
                            Stay in {d.name}
                          </Badge>
                        ))}
                        <Badge variant="guideless">Pick your view</Badge>
                        <Badge variant="guideless">Welcome drinks night one</Badge>
                      </div>
                    </div>
                    <div className="relative flex flex-wrap items-center justify-between gap-4">
                      {next && (
                        <p className="text-sm text-cloud/80">
                          From{" "}
                          <span className="font-heading text-lg font-bold text-cloud">
                            {formatMoney(
                              { amount: next.priceAmount, currency: next.currency },
                              { compact: true },
                            )}
                          </span>{" "}
                          · own room · {next.capacity} places
                        </p>
                      )}
                      <Link
                        href={`/tours/${tour.slug}`}
                        className={buttonVariants({ variant: "inverse" })}
                      >
                        See the weekend <ArrowRight className="h-4 w-4" aria-hidden />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* The problem */}
      <section className="mx-auto w-full max-w-6xl px-6 py-24">
        <SectionHeading
          eyebrow="The problem"
          title="You want to travel. You don’t want to plan every damn thing."
          lede="Do it all yourself, or hand your days to a guide. We are the third option."
        />
        <CompareObserver section="home_problem">
          <div className="mt-12">
            <CompareTable columns={COMPARE} />
          </div>
        </CompareObserver>
      </section>

      {/* The app */}
      <section className="bg-ink py-24 text-cloud">
        <div className="mx-auto w-full max-w-6xl px-6">
          <SectionHeading
            eyebrow="The app"
            title="Your entire trip. In your pocket."
            lede="Where you are, what is next, what is nearby. No guide required."
            inverse
          />
          <div className="mt-14">
            <AppShowcase screens={screens} />
          </div>
        </div>
      </section>

      {/* Configurator */}
      {example && (
        <section className="mx-auto w-full max-w-6xl px-6 py-24">
          <ConfiguratorExampleCard example={example} />
        </section>
      )}

      {/* Trust */}
      <section className="bg-surface py-24">
        <div className="mx-auto w-full max-w-6xl px-6">
          <SectionHeading eyebrow="Who is behind this" title="A small company. A specific idea." />
          <div className="mt-12">
            <FounderBlock />
          </div>
        </div>
      </section>

      {/* FAQ + CTA */}
      <section className="mx-auto w-full max-w-6xl px-6 py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading eyebrow="Questions" title="Questions people ask." />
          <Link href="/faq" className={buttonVariants({ variant: "secondary" })}>
            All questions
          </Link>
        </div>
        <div className="mt-8 max-w-3xl">
          <FaqAccordion items={homeFaq} />
        </div>
        <div className="mt-20 rounded bg-sand p-10 md:p-14">
          <h2 className="max-w-2xl text-3xl md:text-4xl">{brand.taglineSecondary}</h2>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Pick a trip. We will handle the rest, and then get out of the way.
          </p>
          <CtaLink
            href="/tours"
            placement="home_closing"
            className={cn(buttonVariants({ size: "lg" }), "mt-8")}
          >
            Explore trips <ArrowRight className="h-4 w-4" aria-hidden />
          </CtaLink>
        </div>
      </section>
      <JsonLd data={faqJsonLd(homeFaq)} />
    </>
  );
}
