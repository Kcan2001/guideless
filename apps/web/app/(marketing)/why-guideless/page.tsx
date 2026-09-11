import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CtaLink } from "@/components/analytics/cta-link";
import { CompareObserver } from "@/components/marketing/compare-observer";
import { CompareTable } from "@/components/marketing/compare-table";
import { PageHero, SectionHeading } from "@/components/marketing/page-hero";
import { JsonLd } from "@/components/site/json-ld";
import { PhotoBackdrop } from "@/components/site/photo-hero";
import { buttonVariants } from "@/components/ui/button";
import { sitePhotos } from "@/lib/photos";
import { breadcrumbJsonLd } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Why Guideless",
  description:
    "Why book Guideless instead of planning it yourself or joining a tour: coordination removed, independence kept, a trip you configure, extras you add later, and a group you travel with but not behind.",
  alternates: { canonical: "/why-guideless" },
};

const BENEFITS = [
  {
    title: "We remove the coordination",
    lede: "The parts of a trip nobody enjoys planning are the parts we do.",
    points: [
      "Which hotel location actually makes sense for the days you have.",
      "How to get between cities, with the tickets already in your app.",
      "Which activities are reputable and worth the afternoon.",
      "Coordinating a group of people arriving from different places.",
      "What happens each day, and where your confirmations are.",
      "Who to message when something breaks.",
    ],
    photo: sitePhotos.app,
    alt: "A Métropolitain sign in front of a Haussmann façade",
  },
  {
    title: "You don’t lose your independence",
    lede: "This is where a Guideless trip stops resembling a tour.",
    points: [
      "No guide walking around with you.",
      "No coach for the day.",
      "No mandatory group meals.",
      "No rigid schedule and no headcounts.",
      "No requirement to participate in anything.",
    ],
    photo: sitePhotos.solo,
    alt: "An old-town lane in Nice at blue hour",
  },
  {
    title: "You configure the trip",
    lede: "Start with a base trip. Then make it yours.",
    points: [
      "Your hotel tier, where a trip offers a choice.",
      "Your own room by default, or share with someone on your booking and pay less.",
      "Event tickets, from a grandstand to a terrace to a yacht.",
      "Experiences, transfers, meals and upgrades, one by one.",
      "The price updates as you choose, and the database does the math, not the page.",
    ],
    photo: sitePhotos.choices,
    alt: "View of the harbour grandstands from a yacht deck",
  },
  {
    title: "You can add things later",
    lede: "Reserve now. Decide about the boat when you are on the beach.",
    points: [
      "Add a boat, a dinner, a race upgrade, a transfer or an extra night after booking.",
      "Add from your account on the web or from the app during the trip.",
      "Every extra shows how many of your group are already going.",
      "Availability is real: capacity comes from the same inventory that holds your seat.",
    ],
    photo: sitePhotos.addLater,
    alt: "Yachts moored side by side in the Monaco harbour on race week",
  },
  {
    title: "You travel independently, not alone",
    lede: "A group that is there when you want it and invisible when you do not.",
    points: [
      "Welcome drinks on night one, included.",
      "A group chat that opens weeks before departure.",
      "Member profiles that share only what each traveler chooses to share.",
      "Optional meetups, dinners and Live Moments during the trip.",
      "Friends can book separately and still be in the same group.",
    ],
    photo: sitePhotos.people,
    alt: "Parisians sitting along the Seine quay in the evening",
  },
];

const COMPARE = [
  {
    title: "Do it yourself",
    lines: [
      "You get exactly what you research.",
      "Hours of comparison, no second opinion.",
      "Nobody to fix a cancelled train at 7 a.m.",
      "Traveling solo means being alone, unless you get lucky.",
    ],
  },
  {
    title: "Guided tour",
    lines: [
      "Everything decided for you, including the parts you would rather decide.",
      "A schedule, a coach, a flag.",
      "One price, whether or not you want the museum.",
      "Forty strangers you did not choose.",
    ],
  },
  {
    title: "Guideless",
    highlight: true,
    lines: [
      "Logistics handled, days yours.",
      "Options with real prices, chosen by you.",
      "People who organized the trip on the other end of the chat.",
      "A small group you meet on your terms.",
    ],
  },
];

export default function WhyGuidelessPage() {
  return (
    <>
      <PageHero
        photo={sitePhotos.whyGuideless}
        fallbackAlt="Swimmers below Castle Hill on the Nice beach"
        eyebrow="Why Guideless"
        title="Why book with us instead of doing it yourself?"
        lede="Because the work is the part you do not want, and the freedom is the part you do. Here is exactly what changes when Guideless organizes the trip."
      >
        <CtaLink
          href="/tours"
          placement="why_hero"
          className={buttonVariants({ variant: "inverse", size: "lg" })}
        >
          Explore trips <ArrowRight className="h-4 w-4" aria-hidden />
        </CtaLink>
      </PageHero>

      <section className="mx-auto w-full max-w-6xl px-6 py-24">
        <SectionHeading eyebrow="Three ways to see Europe" title="The same trip, three ways." />
        <CompareObserver section="why_compare">
          <div className="mt-12">
            <CompareTable columns={COMPARE} />
          </div>
        </CompareObserver>
      </section>

      <section className="bg-surface py-24">
        <div className="mx-auto w-full max-w-6xl space-y-24 px-6">
          {BENEFITS.map((b, i) => (
            <article
              key={b.title}
              className={cn(
                "grid gap-10 lg:grid-cols-2 lg:items-center",
                i % 2 === 1 && "lg:[&>*:first-child]:order-2",
              )}
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded">
                <PhotoBackdrop
                  src={b.photo}
                  fallbackAlt={b.alt}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                />
              </div>
              <div>
                <p className="font-heading text-sm font-semibold text-link">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h2 className="mt-2 text-3xl font-bold md:text-4xl">{b.title}</h2>
                <p className="mt-3 text-lg text-muted-foreground">{b.lede}</p>
                <ul className="mt-6 space-y-2.5 text-foreground/90">
                  {b.points.map((p) => (
                    <li key={p} className="flex gap-3">
                      <span
                        className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal"
                        aria-hidden
                      />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-24">
        <div className="grid gap-6 rounded bg-ink p-10 text-cloud md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="text-3xl font-bold">See a real trip, priced.</h2>
            <p className="mt-3 max-w-xl text-cloud/80">
              Every trip page lists what is included, every optional extra and the deposit before
              you talk to anyone.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <CtaLink
              href="/tours"
              placement="why_closing"
              className={buttonVariants({ variant: "inverse", size: "lg" })}
            >
              Explore trips <ArrowRight className="h-4 w-4" aria-hidden />
            </CtaLink>
            <Link
              href="/how-it-works"
              className={cn(
                buttonVariants({ size: "lg" }),
                "border border-cloud/30 bg-transparent text-cloud hover:bg-cloud/10",
              )}
            >
              How it works
            </Link>
          </div>
        </div>
      </section>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Why Guideless", path: "/why-guideless" },
        ])}
      />
    </>
  );
}
