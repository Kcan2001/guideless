import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { SaveTourButton } from "@/components/growth/save-tour-button";
import { getSaveCount } from "@/lib/growth/saved";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, Gauge, MapPin, MoonStar, Sparkles, Users } from "lucide-react";
import { brand } from "@guideless/config";
import { formatDateRange, formatMoney, formatWallTime } from "@guideless/utils";
import { TrackView } from "@/components/analytics/track-view";
import { ReferralHint, RoomRule } from "@/components/marketing/make-it-yours";
import { JsonLd } from "@/components/site/json-ld";
import { PhotoBackdrop } from "@/components/site/photo-hero";
import { AddLaterCallout } from "@/components/tours/add-later-callout";
import { BaseIncludes } from "@/components/tours/base-includes";
import { CompareBlock } from "@/components/tours/compare-block";
import { DepartureList } from "@/components/tours/departure-list";
import { UnlockProgress, type DepartureUnlock } from "@/components/growth/unlock-progress";
import { getUnlockProgress } from "@/lib/growth/unlocks";
import { WaitlistForm } from "@/components/growth/waitlist-form";
import { ExperienceCards } from "@/components/tours/experience-cards";
import { Faq } from "@/components/tours/faq";
import { ItineraryTimeline } from "@/components/tours/itinerary-timeline";
import { PhotoGallery } from "@/components/tours/photo-gallery";
import { ResponsibilityList } from "@/components/tours/responsibility-list";
import { StayTierCards } from "@/components/tours/stay-tier-cards";
import { addOnFamilies } from "@/lib/data/extras-shared";
import { TierLegend } from "@/components/tours/tier-legend";
import { CtaLink } from "@/components/analytics/cta-link";
import { buttonVariants } from "@/components/ui/button";
import { tourEventJsonLd } from "@/lib/community/seo";
import { getRoomRule } from "@/lib/data/community";
import { listDepartureExtras } from "@/lib/data/extras";
import { getTourBySlug, listTourSlugs } from "@/lib/data/tours";
import { tourFromPrice } from "@/lib/data/tour-filters";
import { TourReviews } from "@/components/reviews/tour-reviews";
import { getTourReviewStats, listReviewsForTour } from "@/lib/reviews/queries";
import { TestimonialStrip } from "@/components/testimonials/testimonial-strip";
import { listTestimonialsForTour } from "@/lib/testimonials/queries";
import { withAggregateRating } from "@/lib/reviews/seo";
import { breadcrumbJsonLd, faqJsonLd, tourJsonLd } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const revalidate = 300;
export const dynamicParams = true;

const LEVEL_LABEL = {
  relaxed: "Relaxed pace",
  moderate: "Moderate pace",
  active: "Active pace",
} as const;

/** Hero promise when the version has no tagline of its own. */
/**
 * The tier grid's call to action, and the only one in the section.
 *
 * The cards used to carry a button each, all four pointing at the same builder. That asked "which
 * one?" of somebody who had not yet seen a room, and it is the wrong question on this page: the
 * tiers explain the price bands, and choosing is what the builder is for. One button, naming what
 * happens next.
 */
function SeeTheRooms({ href }: { href: Route }) {
  return (
    <div className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-2">
      <CtaLink
        placement="tour_tiers"
        href={href}
        className={buttonVariants({ size: "lg" })}
        data-testid="see-the-rooms"
      >
        See the rooms and prices <ArrowRight className="h-4 w-4" aria-hidden />
      </CtaLink>
      <p className="text-sm text-muted-foreground">
        Free to look — nothing is held until you pay a deposit.
      </p>
    </div>
  );
}

/**
 * Exclusive sets the tour page gives a section of their own. Everything else with a `tier_group`
 * falls through to the general "also optional" grid rather than being mislabelled.
 */
const RACE_VIEW_GROUP = "race_view";
const NIGHT_GROUP_PREFIX = "night_";

function heroPromise(slug: string, isEvent: boolean): string {
  if (slug === "monaco-grand-prix") {
    return "Stay in Nice or Monaco. Choose your race view. Meet the group. Explore the Riviera on your own terms.";
  }
  return isEvent
    ? "Choose where you stay and how you watch. Meet the group. Explore on your own terms."
    : "Hotels, trains and a welcome drink are organized. Your days are yours, and the group is there when you want it.";
}

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

  const { tour, version, route, days, included, excluded, requirements, faqs, departures } = detail;
  const price = tourFromPrice({
    tour,
    version,
    destinations: route.map((r) => r.destination),
    departures,
  });
  const nights = route.reduce((n, r) => n + r.nights, 0);
  const isEvent = tour.kind === "event";
  const next = departures[0];
  // Group unlocks for the departure the page is selling. Real confirmed counts only.
  const unlockProgress = next
    ? await getUnlockProgress(next.id)
    : { confirmed: 0, unlocks: [] as DepartureUnlock[] };
  const [extras, roomRule] = next
    ? await Promise.all([listDepartureExtras(next.id), getRoomRule(next.id)])
    : [null, null];
  // Reviews appear only once real travelers have written them; both are empty until then.
  // Testimonials are the separate thing: quotes from trips run before Guideless existed, with no
  // rating, so they can stand on the page without touching the star count above them.
  const [reviewStats, reviews, testimonials] = await Promise.all([
    getTourReviewStats(tour.id),
    listReviewsForTour(tour.id),
    listTestimonialsForTour(tour.id),
  ]);
  const currency = next?.currency ?? version.starting_price_currency;
  const anchor = days
    .flatMap((d) => d.items.map((i) => ({ item: i, day: d })))
    .find((x) => x.item.is_anchor);
  const stayOptions = extras?.stayOptions ?? [];
  // One card per thing you can add, not per row you can buy: the yacht's three days are one
  // answer to "can I watch from a boat?". The builder still offers every variant.
  //
  // `tier_group` marks any mutually exclusive set, and Monaco has six of them — race viewing plus
  // one per night. Treating "has a tier_group" as "is race viewing" put nine nightclub cards under
  // the heading "How you watch the Monaco Grand Prix", which is the wrong answer to the only
  // question that section exists to answer.
  const allAddOns = extras?.addOns ?? [];
  const viewing = addOnFamilies(allAddOns.filter((a) => a.tier_group === RACE_VIEW_GROUP));
  const nightOptions = addOnFamilies(
    allAddOns.filter((a) => a.tier_group?.startsWith(NIGHT_GROUP_PREFIX)),
  );
  const experiences = addOnFamilies(allAddOns.filter((a) => !a.tier_group));
  const hasExtras =
    stayOptions.length > 0 ||
    viewing.length > 0 ||
    nightOptions.length > 0 ||
    experiences.length > 0;
  const bookable = !!next && next.availability.available > 0;
  const buildHref = bookable ? (`/tours/${tour.slug}/build?departure=${next.id}` as Route) : null;
  const eventShortName = tour.event_name?.replace(/^Formula 1 /, "") ?? null;

  // The count only — deliberately not whether *you* saved it. This page is statically generated
  // and revalidated; reading the session here would force it dynamic and cost the cache on the
  // page that matters most. The count is anonymous, so it caches fine, and "what I saved" lives on
  // the account page where per-person state belongs.
  const saveCount = await getSaveCount(tour.id);

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
          <p className="mt-6 max-w-2xl text-lg text-cloud/85 md:text-xl">
            {version.tagline ?? heroPromise(tour.slug, isEvent)}
          </p>
          {isEvent && tour.event_starts_on && (
            <p
              className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-cloud/85"
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

          {/* Facts strip */}
          <dl
            className="mt-10 grid max-w-3xl grid-cols-2 gap-x-8 gap-y-5 border-t border-cloud/20 pt-8 text-sm sm:grid-cols-4"
            data-testid="hero-facts"
          >
            {next ? (
              <div>
                <dt className="flex items-center gap-1.5 text-cloud/70">
                  <CalendarDays className="h-4 w-4 text-aqua" aria-hidden /> Next departure
                </dt>
                <dd className="mt-1 font-heading text-base font-bold">
                  {formatDateRange(next.startDate, next.endDate)}
                </dd>
              </div>
            ) : (
              <div>
                <dt className="flex items-center gap-1.5 text-cloud/70">
                  <Gauge className="h-4 w-4 text-aqua" aria-hidden /> Pace
                </dt>
                <dd className="mt-1 font-heading text-base font-bold">
                  {LEVEL_LABEL[tour.activity_level]}
                </dd>
              </div>
            )}
            <div>
              <dt className="flex items-center gap-1.5 text-cloud/70">
                <MoonStar className="h-4 w-4 text-aqua" aria-hidden /> Length
              </dt>
              <dd className="mt-1 font-heading text-base font-bold">
                {tour.duration_days} days · {nights} nights
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-cloud/70">
                <Users className="h-4 w-4 text-aqua" aria-hidden /> Group
              </dt>
              <dd className="mt-1 font-heading text-base font-bold">
                {tour.group_size_min}–{tour.group_size_max} travelers
              </dd>
            </div>
            {price && (
              <div>
                <dt className="text-cloud/70">From</dt>
                <dd className="mt-1 font-heading text-base font-bold">
                  {formatMoney(price, { compact: true })}
                  <span className="ml-1 text-xs font-normal text-cloud/70">per person</span>
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-10 flex flex-wrap gap-3">
            {buildHref ? (
              <CtaLink
                placement="tour_hero"
                href={buildHref}
                className={buttonVariants({ variant: "inverse", size: "lg" })}
              >
                Build my trip <ArrowRight className="h-4 w-4" aria-hidden />
              </CtaLink>
            ) : (
              <a href="#departures" className={buttonVariants({ variant: "inverse", size: "lg" })}>
                See dates <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            )}
            <a
              href="#itinerary"
              className={cn(
                buttonVariants({ size: "lg" }),
                "border border-cloud/30 bg-transparent text-cloud hover:bg-cloud/10",
              )}
            >
              See itinerary
            </a>
          </div>
        </div>
      </section>

      {/* Base trip includes */}
      <BaseIncludes
        included={included}
        groupOpensDaysBefore={extras?.groupOpensDaysBefore ?? null}
      />

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

      {/* Two ways to buy the same trip */}
      <section className="bg-surface py-20">
        <div className="mx-auto w-full max-w-6xl px-6">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Two ways to do this
          </p>
          <h2 className="mt-3 text-3xl font-bold md:text-4xl">
            {isEvent ? "One package, or your weekend." : "One itinerary, or your trip."}
          </h2>
          <div className="mt-10">
            <CompareBlock isEvent={isEvent} eventName={eventShortName} />
          </div>
        </div>
      </section>

      {/* Where you stay */}
      {stayOptions.length > 0 && extras && (
        <section id="make-it-yours" className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 py-20">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Where you stay
          </p>
          <h2 className="mt-3 text-3xl font-bold md:text-4xl">
            {isEvent ? "Pick your base." : "Pick your tier."}
          </h2>
          <p className="mt-2 max-w-xl text-muted-foreground">
            What each price band buys you: the area, how far it is, and what is in the price. You
            see the actual properties when you build the trip. The same four tiers apply to add-ons.
          </p>
          <TierLegend className="mt-8" />
          <div className="mt-10">
            <StayTierCards
              options={stayOptions}
              currency={currency}
              sharedRoomDiscountAmount={extras.sharedRoomDiscountAmount}
            />
          </div>
          <div className="mt-8 space-y-2">
            <RoomRule rule={roomRule} />
          </div>
          {buildHref && <SeeTheRooms href={buildHref} />}
        </section>
      )}

      {/* How you watch / experiences */}
      {(viewing.length > 0 || nightOptions.length > 0 || experiences.length > 0) && (
        <section className="bg-surface py-20">
          <div className="mx-auto w-full max-w-6xl space-y-16 px-6">
            {viewing.length > 0 && (
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  {isEvent ? "How you watch" : "Choose one"}
                </p>
                <h2 className="mt-3 text-3xl font-bold md:text-4xl">
                  {isEvent && eventShortName
                    ? `How you watch ${eventShortName}.`
                    : "One of these, your call."}
                </h2>
                <p className="mt-2 max-w-xl text-muted-foreground">
                  Priced per person and chosen per traveler. One view per session — take Saturday
                  and Sunday both if you want, just not two views of the same day. Where there is
                  more than one way to do it, you pick the day when you build. Tiers work the same
                  way as for where you stay.
                </p>
                <div className="mt-10">
                  <ExperienceCards
                    families={viewing}
                    currency={currency}
                    size="large"
                    pickOne
                    testId="race-options"
                  />
                </div>
              </div>
            )}
            {nightOptions.length > 0 && (
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Your nights
                </p>
                <h2 className="mt-3 text-3xl font-bold md:text-4xl">Where the group ends up.</h2>
                <p className="mt-2 max-w-xl text-muted-foreground">
                  One per night, and none of them compulsory. Prices are per person and every night
                  stands on its own — take one, take all of them, or keep your evenings free.
                </p>
                <div className="mt-10">
                  <ExperienceCards
                    families={nightOptions}
                    currency={currency}
                    pickOne
                    testId="night-options"
                  />
                </div>
              </div>
            )}
            {experiences.length > 0 && (
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Also optional
                </p>
                <h2 className="mt-3 text-3xl font-bold md:text-4xl">
                  {viewing.length > 0 ? "Round out the weekend." : "Add on what you like."}
                </h2>
                <p className="mt-2 max-w-xl text-muted-foreground">
                  Everything here is optional, paid only if you choose it, and visible to the group
                  so you can see who else is in.
                </p>
                <div className="mt-10">
                  <ExperienceCards
                    families={experiences}
                    currency={currency}
                    testId="experience-options"
                  />
                </div>
              </div>
            )}
            {hasExtras && (
              <div className="space-y-6">
                <AddLaterCallout />
                <ReferralHint />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Itinerary */}
      <section id="itinerary" className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 py-20">
        <h2 className="text-3xl font-bold md:text-4xl">Day by day.</h2>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Times are local. Anything marked{" "}
          <span className="font-medium text-foreground">Optional</span> is exactly that. The dashed
          blocks are free time — on purpose.
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
              Everyone is invited, nobody is obliged. In the app you see who&rsquo;s coming, and the
              group opens weeks before you fly.
            </p>
          </aside>
        )}
        <div className="mt-10 max-w-3xl">
          <ItineraryTimeline days={days} />
        </div>
      </section>

      {/* Departures */}
      <section id="departures" className="scroll-mt-24 bg-surface py-20">
        <div className="mx-auto w-full max-w-6xl px-6">
          <h2 className="text-3xl font-bold md:text-4xl">Dates &amp; prices.</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Prices are per traveler in your own room and include everything under &ldquo;Guideless
            handles&rdquo;. Reserve with a deposit; the balance is due before departure.
          </p>
          <div className="mt-6">
            <SaveTourButton tourId={tour.id} slug={tour.slug} saveCount={saveCount} />
          </div>
          <div className="mt-8">
            <DepartureList tourSlug={tour.slug} tourId={tour.id} departures={departures} />
            {departures.length === 0 && (
              <div className="mt-6 max-w-md">
                <p className="text-sm text-muted-foreground">
                  Tell us where to write when the next dates land.
                </p>
                <WaitlistForm
                  tourId={tour.id}
                  source="tour_page"
                  label="Tell me first"
                  className="mt-3"
                />
              </div>
            )}
            {unlockProgress.unlocks.length > 0 && (
              <UnlockProgress
                confirmed={unlockProgress.confirmed}
                unlocks={unlockProgress.unlocks}
                className="mt-10 max-w-2xl"
              />
            )}
          </div>
        </div>
      </section>

      {/* Included / excluded */}
      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <h2 className="text-3xl font-bold md:text-4xl">Who handles what.</h2>
        <p className="mt-2 max-w-xl text-muted-foreground">
          The one thing every traveler should know before booking.
        </p>
        <div className="mt-8">
          <ResponsibilityList included={included} excluded={excluded} />
        </div>
      </section>

      {/* Before you book. Conditions of joining, not marketing: a traveler who cannot meet these
          cannot come, so they belong above the reviews rather than in the small print. */}
      {requirements.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-6 pb-20">
          <h2 className="text-3xl font-bold md:text-4xl">Before you book.</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">
            What everyone on this trip has to be able to do. Check these now, not in May.
          </p>
          <ul className="mt-8 grid max-w-4xl gap-4 md:grid-cols-3">
            {requirements.map((requirement) => (
              <li key={requirement.id} className="rounded-xl border bg-card p-5">
                <h3 className="font-semibold">{requirement.title}</h3>
                {requirement.description && (
                  <p className="mt-2 text-sm text-muted-foreground">{requirement.description}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <TourReviews stats={reviewStats} reviews={reviews} tourName={tour.name} />
      <TestimonialStrip
        testimonials={testimonials}
        heading={isEvent ? "From past weekends" : "From past trips"}
        title={
          isEvent
            ? "This weekend has been run before."
            : "People who have travelled this route before."
        }
      />

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
      {/* The rating is attached only when travelers have actually left one: a review count in
          machine-readable form that nobody wrote would be a lie a search engine repeats. */}
      <JsonLd
        data={withAggregateRating(
          tourJsonLd({ tour, version, route, departures, days }),
          reviewStats,
        )}
      />
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
