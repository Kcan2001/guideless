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
import { RosterStrip } from "@/components/marketing/roster-strip";
import { JsonLd } from "@/components/site/json-ld";
import { HeroScrim, heroEyebrowClass } from "@/components/site/hero-scrim";
import { PhotoBackdrop } from "@/components/site/photo-hero";
import { TourCard } from "@/components/tours/tour-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { faqByIds, HOME_FAQ_IDS } from "@/content/faq";
import { listAppScreens } from "@/lib/app-screens";
import { getConfiguratorExample } from "@/lib/data/configurator";
import { getRosterStats } from "@/lib/data/extras";
import { listPublishedTours } from "@/lib/data/tours";
import { sitePhotos } from "@/lib/photos";
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

const WHY = [
  {
    title: "Your trip, your choices",
    body: "Start with the essentials handled. Choose where you stay, which experiences you join, how you get from the airport, and see the price change as you decide.",
    photo: sitePhotos.choices,
    alt: "View of the harbour grandstands from a yacht deck",
  },
  {
    title: "Travel with people, not a tour group",
    body: "Everyone on your departure is in one group. Meet at the welcome drinks, chat before you fly, join a dinner or a boat when you feel like it, and go your own way when you do not.",
    photo: sitePhotos.people,
    alt: "Parisians sitting along the Seine quay in the evening",
  },
  {
    title: "Everything lives in the app",
    body: "Today's plan, the full itinerary, a map of everything, your tickets and confirmations, the group, chat and support. It works offline for the parts you need on the move.",
    photo: sitePhotos.app,
    alt: "A Métropolitain sign in front of a Haussmann façade",
  },
  {
    title: "Keep adding to your trip",
    body: "Not sure about the boat yet? Reserve the trip now and add experiences later from your account or the app, even mid-trip, subject to availability.",
    photo: sitePhotos.addLater,
    alt: "Yachts moored side by side in the Monaco harbour on race week",
  },
];

export default async function HomePage() {
  const [tours, example] = await Promise.all([listPublishedTours(), getConfiguratorExample()]);
  const routes = tours.filter((t) => t.tour.kind !== "event");
  const events = tours.filter((t) => t.tour.kind === "event");
  const featured = routes.slice(0, 3);
  const screens = listAppScreens();
  const homeFaq = faqByIds(HOME_FAQ_IDS);

  // "Independent, not alone" shows real roster numbers only once a departure has three bookings.
  const nextDeparture = tours
    .flatMap((t) => t.departures)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const roster = nextDeparture ? await getRosterStats(nextDeparture.id) : null;
  const showRoster = roster != null && roster.booked >= 3;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink text-cloud">
        <PhotoBackdrop
          src={sitePhotos.home}
          fallbackAlt="The Riviera at dusk"
          priority
          position="center 55%"
        />
        <HeroScrim />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col px-6 py-28 md:py-40">
          <p className={cn(heroEyebrowClass, "mb-5")}>Small-group trips to Europe</p>
          <h1 className="max-w-3xl text-5xl leading-[1.02] md:text-7xl">{brand.tagline}</h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-cloud/85 md:text-xl">
            {brand.description}
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <CtaLink
              href="/tours"
              placement="home_hero"
              className={buttonVariants({ variant: "inverse", size: "lg" })}
            >
              Explore trips <ArrowRight className="h-4 w-4" aria-hidden />
            </CtaLink>
            <CtaLink
              href="/how-it-works"
              placement="home_hero_secondary"
              className={cn(
                buttonVariants({ size: "lg" }),
                "border border-cloud/30 bg-transparent text-cloud hover:bg-cloud/10",
              )}
            >
              How Guideless works
            </CtaLink>
          </div>
        </div>
      </section>

      {/* The problem */}
      <section className="mx-auto w-full max-w-6xl px-6 py-24">
        <SectionHeading
          eyebrow="The problem"
          title="You want to travel. You don’t want to plan every damn thing."
          lede="There have been two ways to see Europe: do all the work yourself, or hand your days to a tour guide. Guideless is the third."
        />
        <CompareObserver section="home_problem">
          <div className="mt-12">
            <CompareTable columns={COMPARE} />
          </div>
        </CompareObserver>
      </section>

      {/* Why Guideless */}
      <section className="bg-surface py-24">
        <div className="mx-auto w-full max-w-6xl px-6">
          <SectionHeading
            eyebrow="Why Guideless"
            title="We plan the hard parts. You choose the rest."
          />
          <ul className="mt-14 grid gap-10 md:grid-cols-2">
            {WHY.map((w, i) => (
              <li key={w.title} className="group">
                <div className="relative aspect-[3/2] overflow-hidden rounded">
                  <PhotoBackdrop
                    src={w.photo}
                    fallbackAlt={w.alt}
                    sizes="(min-width: 768px) 50vw, 100vw"
                    imgClassName="transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                </div>
                <p className="mt-6 font-heading text-sm font-semibold text-link">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 text-2xl md:text-3xl">{w.title}</h3>
                <p className="mt-3 max-w-lg text-lg text-muted-foreground">{w.body}</p>
              </li>
            ))}
          </ul>
          <Link
            href="/why-guideless"
            className={cn(buttonVariants({ variant: "link" }), "mt-10 px-0")}
          >
            Why someone books Guideless instead of doing it themselves{" "}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      {/* The app */}
      <section className="bg-ink py-24 text-cloud">
        <div className="mx-auto w-full max-w-6xl px-6">
          <SectionHeading
            eyebrow="The app"
            title="Your entire trip. In your pocket."
            lede="Guideless is a travel company with an app instead of a guide. Every morning it answers three questions: where am I, what is next, and what are my options."
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

      {/* Independent, not alone */}
      <section className={cn("py-24", example ? "bg-surface" : "")}>
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 lg:grid-cols-2 lg:items-center">
          <div className="relative aspect-[4/5] overflow-hidden rounded">
            <PhotoBackdrop
              src={sitePhotos.together}
              fallbackAlt="A café terrace in Paris"
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
          </div>
          <div>
            <SectionHeading
              eyebrow="Independent, not alone"
              title="Travel independently. Don’t travel alone."
              lede="Guideless is built for people who book on their own. The trip is designed so that never feels like a compromise."
            />
            <ul className="mt-8 space-y-4 text-lg">
              {[
                ["Welcome drinks on night one.", "Included. You will know faces by breakfast."],
                [
                  "The group chat opens before you fly.",
                  "Thirty to forty-five days out, the roster, chat and Live Moments switch on together.",
                ],
                [
                  "Optional dinners, boats and meetups.",
                  "Each one shows how many of your group are in before you decide.",
                ],
                [
                  "City evenings at home.",
                  "Meet other Guideless travelers in your own city before you ever board a plane.",
                ],
              ].map(([title, body]) => (
                <li key={title}>
                  <span className="font-semibold">{title}</span>{" "}
                  <span className="text-muted-foreground">{body}</span>
                </li>
              ))}
            </ul>
            {showRoster && <RosterStrip stats={roster} className="mt-8" />}
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/group-travel" className={buttonVariants({ variant: "secondary" })}>
                Traveling with friends
              </Link>
              <Link href="/meetups" className={cn(buttonVariants({ variant: "link" }), "px-0")}>
                City evenings <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trips */}
      <section className="mx-auto w-full max-w-6xl px-6 py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading eyebrow="Trips" title="Routes we would send a friend on." />
          <Link href="/tours" className={buttonVariants({ variant: "secondary" })}>
            All trips
          </Link>
        </div>
        {featured.length + events.length === 0 && (
          <p className="mt-12 text-muted-foreground">Our first routes are being finalized.</p>
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
                    <p className="eyebrow text-aqua">Event weekend · {tour.event_name}</p>
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
                          <MapPin className="h-4 w-4 text-aqua" aria-hidden /> {tour.event_location}
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
      </section>

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
