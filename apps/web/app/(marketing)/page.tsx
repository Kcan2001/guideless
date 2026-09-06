import Link from "next/link";
import { ArrowRight, Check, Plane } from "lucide-react";
import { brand, responsibilityLabels } from "@guideless/config";
import { formatWallTime } from "@guideless/utils";
import { buttonVariants } from "@/components/ui/button";
import { RouteArt } from "@/components/site/route-art";
import { TourCard } from "@/components/tours/tour-card";
import { Faq } from "@/components/tours/faq";
import { JsonLd } from "@/components/site/json-ld";
import { listPublishedDestinations } from "@/lib/data/destinations";
import { getTourBySlug, listPublishedTours } from "@/lib/data/tours";
import { faqJsonLd } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const revalidate = 300;

const HOW = [
  ["Pick a trip", "A route, a small group, a departure date."],
  [
    "Book",
    "Reserve with a deposit. We arrange hotels, trains and a few experiences worth showing up for.",
  ],
  [
    "Fly in and meet the group",
    "You book the flight. We meet you at arrivals with a welcome drive.",
  ],
  [
    "Explore independently",
    "Your itinerary lives on your phone. Free time is built in on purpose.",
  ],
] as const;

const GENERIC_FAQ = [
  {
    id: "guide",
    question: "Is there really no guide?",
    answer:
      "There is no tour guide walking you around. Your itinerary, maps, recommendations and support live in the Guideless app, and a small Guideless team is reachable whenever you need a human.",
  },
  {
    id: "group",
    question: "Do I have to do things with the group?",
    answer:
      "No. Group moments — welcome drinks, a wine afternoon, a farewell dinner — are optional. Many travelers join one or two and otherwise go their own way.",
  },
  {
    id: "problems",
    question: "What happens if something goes wrong?",
    answer:
      "Message support in the app. We see your trip, your itinerary and where you are, and we fix it. For emergencies, local numbers are one tap away.",
  },
];

export default async function HomePage() {
  const [tours, destinations] = await Promise.all([
    listPublishedTours(),
    listPublishedDestinations(),
  ]);
  const featured = tours.slice(0, 3);
  const sample = tours[0] ? await getTourBySlug(tours[0].tour.slug) : null;
  const sampleDay = sample?.days.find((d) => d.day_number === 2) ?? sample?.days[0];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink text-cloud">
        <div className="absolute inset-0 opacity-70">
          <RouteArt stops={3} />
        </div>
        <div
          className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/30"
          aria-hidden
        />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col px-6 py-28 md:py-40">
          <p className="mb-5 text-sm font-medium uppercase tracking-[0.22em] text-aqua">
            Minimal intervention travel
          </p>
          <h1 className="max-w-3xl text-5xl font-bold leading-[1.02] md:text-7xl">
            {brand.tagline}
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-cloud/80 md:text-xl">
            {brand.description}
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/tours" className={buttonVariants({ variant: "inverse", size: "lg" })}>
              Explore trips <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/how-it-works"
              className={cn(
                buttonVariants({ size: "lg" }),
                "border border-cloud/30 bg-transparent text-cloud hover:bg-cloud/10",
              )}
            >
              How Guideless works
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto w-full max-w-6xl px-6 py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            How it works
          </p>
          <h2 className="mt-3 text-4xl font-bold md:text-5xl">
            Everything planned. Nothing forced.
          </h2>
        </div>
        <ol className="mt-12 grid gap-6 md:grid-cols-4">
          {HOW.map(([title, body], i) => (
            <li key={title} className="rounded-xl border border-border bg-surface p-6">
              <span className="font-heading text-sm font-semibold text-link">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
        <Link href="/how-it-works" className={cn(buttonVariants({ variant: "link" }), "mt-6 px-0")}>
          The full story <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </section>

      {/* Featured trips */}
      <section className="bg-surface py-24">
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Trips
              </p>
              <h2 className="mt-3 text-4xl font-bold md:text-5xl">
                Routes we would send a friend on.
              </h2>
            </div>
            <Link href="/tours" className={buttonVariants({ variant: "secondary" })}>
              All trips
            </Link>
          </div>
          {featured.length > 0 ? (
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featured.map((item) => (
                <TourCard key={item.tour.id} item={item} />
              ))}
            </div>
          ) : (
            <p className="mt-12 text-muted-foreground">Our first routes are being finalized.</p>
          )}
        </div>
      </section>

      {/* Destinations */}
      {destinations.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-6 py-24">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Destinations
          </p>
          <h2 className="mt-3 text-4xl font-bold md:text-5xl">Where the routes go.</h2>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {destinations.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/destinations/${d.slug}`}
                  className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-5 no-underline transition-colors hover:border-teal"
                >
                  <div>
                    <p className="font-heading text-xl font-semibold text-foreground">{d.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {d.region ? `${d.region}, ` : ""}
                      {d.country_name}
                    </p>
                  </div>
                  <ArrowRight
                    className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-link"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Included / not included */}
      <section className="bg-ink py-24 text-cloud">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 md:grid-cols-2">
          <div>
            <h2 className="font-heading text-2xl font-semibold text-aqua">
              {responsibilityLabels.guideless}
            </h2>
            <ul className="mt-6 space-y-3">
              {[
                "Hotels in every city",
                "Trains and transfers between them",
                "A welcome transfer with your group",
                "Selected experiences — optional, included",
                "A digital guide that always knows what is next",
                "Real people at Guideless when you need them",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-aqua" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-heading text-2xl font-semibold">{responsibilityLabels.traveler}</h2>
            <ul className="mt-6 space-y-3 text-cloud/85">
              {[
                "Your flights — we tell you exactly when to land",
                "Most meals — we have recommendations",
                "Travel insurance",
                "Every free afternoon",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <Plane className="mt-1 h-4 w-4 shrink-0 text-cyan" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Sample day */}
      {sample && sampleDay && (
        <section className="mx-auto w-full max-w-6xl px-6 py-24">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            A sample day
          </p>
          <h2 className="mt-3 text-4xl font-bold md:text-5xl">
            Day {sampleDay.day_number} in {sampleDay.destination?.name ?? sample.tour.name}
          </h2>
          <p className="mt-3 max-w-xl text-muted-foreground">{sampleDay.summary}</p>
          <ol className="mt-10 grid gap-3 md:grid-cols-2">
            {sampleDay.items.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "rounded-lg border p-4",
                  item.type === "free_time"
                    ? "border-dashed border-aqua bg-aqua/10"
                    : "border-border bg-surface",
                )}
              >
                <p className="text-xs text-muted-foreground">
                  {item.start_time ? formatWallTime(item.start_time) : "Anytime"} ·{" "}
                  {item.type.replace("_", " ")}
                </p>
                <p className="mt-1 font-semibold">{item.title}</p>
              </li>
            ))}
          </ol>
          <Link
            href={`/tours/${sample.tour.slug}`}
            className={cn(buttonVariants({ variant: "link" }), "mt-6 px-0")}
          >
            See the whole {sample.tour.name} itinerary{" "}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </section>
      )}

      {/* FAQ + CTA */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <h2 className="text-3xl font-bold md:text-4xl">Questions people ask.</h2>
        <div className="mt-8 max-w-3xl">
          <Faq items={GENERIC_FAQ} />
        </div>
        <div className="mt-20 rounded-2xl bg-sand p-10 md:p-14">
          <h2 className="max-w-2xl text-3xl font-bold md:text-4xl">{brand.taglineSecondary}</h2>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Pick a route. We will handle the rest — and then get out of the way.
          </p>
          <Link href="/tours" className={cn(buttonVariants({ size: "lg" }), "mt-8")}>
            Explore trips <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>
      <JsonLd data={faqJsonLd(GENERIC_FAQ)} />
    </>
  );
}
