import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Minus } from "lucide-react";
import { brand } from "@guideless/config";
import { PageHero } from "@/components/marketing/page-hero";
import { JsonLd } from "@/components/site/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { sitePhotos } from "@/lib/photos";
import { breadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "We book the hotels, trains and transfers. You pick your budget, keep your days, and travel with a group that is there when you want it.",
  alternates: { canonical: "/how-it-works" },
};

/**
 * The one page that explains the product.
 *
 * It replaces three — "How it works", "Why Guideless" and "Group travel" — which were the same
 * argument written three times and made the nav ask you to pick between three doors into one room.
 * `/why-guideless` and `/group-travel` redirect here (next.config.ts).
 *
 * Short on purpose. The old version opened with nine numbered steps for a proposition that has
 * three, and the length was doing the opposite of its job: a simple idea described at length reads
 * as a complicated one.
 */
const STEPS = [
  ["Pick a trip", "A route and a date. Small groups, one welcome drink, no flag to follow."],
  ["Choose your level", "Four budgets, same trip. Pick your hotel and any extras you want."],
  ["Turn up", "We have booked the rest. Your phone knows where you sleep and when the train goes."],
] as const;

const ORGANISED = [
  "Hotels for every night",
  "Trains and transfers between cities",
  "A welcome drink on night one",
  "One person to call, any hour",
] as const;

const YOURS = [
  "Your flights",
  "Your days",
  "Your dinners",
  "Whether you join anything at all",
] as const;

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        photo={sitePhotos.howItWorks}
        fallbackAlt="The flower market on the Cours Saleya in Nice"
        eyebrow="How it works"
        title={brand.tagline}
        lede="We organise the parts that are tedious to book and easy to get wrong. The rest of the trip is yours."
        compact
      >
        <Link href="/tours" className={buttonVariants({ size: "lg" })}>
          See the trips <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </PageHero>

      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <ol className="grid gap-10 sm:grid-cols-3">
          {STEPS.map(([title, body], i) => (
            <li key={title}>
              <p className="num text-4xl text-accent">{String(i + 1).padStart(2, "0")}</p>
              <h2 className="mt-3 text-2xl">{title}</h2>
              <p className="mt-2 text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-surface py-20">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 sm:grid-cols-2">
          <div>
            <p className="eyebrow text-muted-foreground">We book</p>
            <ul className="mt-5 space-y-3">
              {ORGANISED.map((line) => (
                <li key={line} className="flex gap-3">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-teal" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow text-muted-foreground">You keep</p>
            <ul className="mt-5 space-y-3 text-muted-foreground">
              {YOURS.map((line) => (
                <li key={line} className="flex gap-3">
                  <Minus className="mt-1 h-4 w-4 shrink-0" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-ink py-20 text-cloud">
        <div className="mx-auto w-full max-w-6xl px-6">
          <p className="eyebrow text-aqua">The group</p>
          <h2 className="mt-3 max-w-2xl text-3xl md:text-5xl">Together, separately.</h2>
          <dl className="mt-10 grid gap-8 sm:grid-cols-3">
            <div>
              <dt className="text-xl">Everyone pays for themselves</dt>
              <dd className="mt-2 text-cloud/75">
                No one fronts the money and chases it afterwards. Separate bookings, same departure.
              </dd>
            </div>
            <div>
              <dt className="text-xl">Your own room by default</dt>
              <dd className="mt-2 text-cloud/75">
                Share with someone and you both pay less. No single supplement either way.
              </dd>
            </div>
            <div>
              <dt className="text-xl">Bring people, earn credit</dt>
              <dd className="mt-2 text-cloud/75">
                Host a departure and you earn $100 of credit per traveler you bring, up to $1,000.
              </dd>
            </div>
          </dl>
          <div className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link href="/tours" className={buttonVariants({ size: "lg" })}>
              See the trips <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/host" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Host a departure
            </Link>
          </div>
        </div>
      </section>

      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "How it works", path: "/how-it-works" },
        ])}
      />
    </>
  );
}
