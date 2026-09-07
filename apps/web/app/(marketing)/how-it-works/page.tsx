import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BedDouble, Check, Users } from "lucide-react";
import { brand } from "@guideless/config";
import { buttonVariants } from "@/components/ui/button";
import { JsonLd } from "@/components/site/json-ld";
import { breadcrumbJsonLd } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "How it works",
  description: `${brand.description} Here is exactly what we do, and what you do.`,
  alternates: { canonical: "/how-it-works" },
};

const STEPS = [
  ["Pick a trip", "Choose a route and a departure date. Small groups — six to fourteen travelers."],
  [
    "Book",
    "Reserve your place with a deposit. We book the hotels, trains, transfers and a handful of experiences.",
  ],
  [
    "Fly in",
    "You book your own flight. We tell you exactly when to land and where to walk when you do.",
  ],
  [
    "Meet the group",
    "A shared welcome drive and a first evening together. Optional, like everything else.",
  ],
  [
    "Follow your itinerary",
    "Your phone knows where you are staying, when the train leaves, and what is nearby.",
  ],
  ["Explore independently", "Free time is built in on purpose. No headcounts. No flag to follow."],
  [
    "Join optional experiences",
    "A wine afternoon, a sunset walk, a long dinner — when you feel like it.",
  ],
  ["Travel onward", "Trains and hotels are arranged for every stop on the route."],
  [
    "Stay connected",
    "Group chat before, during and after. Real people at Guideless when you need them.",
  ],
] as const;

export default function HowItWorksPage() {
  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-6 pt-20 pb-12">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          How Guideless works
        </p>
        <h1 className="mt-3 max-w-3xl text-5xl font-bold md:text-6xl">{brand.taglineSecondary}</h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          A Guideless trip is organized like a great tour and experienced like independent travel.
          Here is the whole arc, start to finish.
        </p>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="rounded-xl border border-border bg-surface p-6">
              <span className="font-heading text-sm font-semibold text-link">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="mt-2 text-xl font-semibold">{title}</h2>
              <p className="mt-2 text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-20 grid gap-12 lg:grid-cols-2">
          <div id="pricing" className="scroll-mt-24">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Pricing
            </p>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl">Pay only for what you do.</h2>
            <p className="mt-3 text-muted-foreground">
              Guided tours bundle everything and charge for the guide. We split it the other way: a
              base trip, then a short list of optional add-ons you choose at booking or later, even
              mid-trip.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "The base trip: hotels, trains between cities, the welcome drinks and your Guide in the app.",
                "Add-ons are optional and priced one by one: a boat day, a wine afternoon, race tickets, an extra night. You see how many of your group are in before you decide.",
                "Your own room is the default. Two travelers can share one room and each pay less. Never more than two.",
                "Reserve with a deposit; the balance is due before departure. Add-ons are paid in full when you choose them.",
                "Cancellation tiers are published on every departure page before you book.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden /> {t}
                </li>
              ))}
            </ul>
            <Link href="/tours" className={cn(buttonVariants({ variant: "link" }), "mt-4 px-0")}>
              See a departure&rsquo;s full price breakdown{" "}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <div id="solo" className="scroll-mt-24">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Travelling solo
            </p>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl">Come alone. Leave with a group.</h2>
            <p className="mt-3 text-muted-foreground">
              Most of our travelers book alone. The trip is built so that never feels like a
              compromise.
            </p>
            <ul className="mt-6 space-y-4 text-sm">
              <li className="flex gap-3">
                <BedDouble className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                <span>
                  <span className="font-medium text-foreground">No single supplement games.</span>{" "}
                  Your own room is the price on the page. Sharing is a choice, not a default.
                </span>
              </li>
              <li className="flex gap-3">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                <span>
                  <span className="font-medium text-foreground">
                    See who&rsquo;s going before you book.
                  </span>{" "}
                  Every departure shows how many are booked, how many are solo, how many countries.
                  Numbers, never names.
                </span>
              </li>
              <li className="flex gap-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                <span>
                  <span className="font-medium text-foreground">Welcome drinks on night one.</span>{" "}
                  The first round is on us. You will know faces by breakfast.
                </span>
              </li>
              <li className="flex gap-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                <span>
                  <span className="font-medium text-foreground">
                    Your Group opens 30 to 45 days out.
                  </span>{" "}
                  Chat, the roster and Live Moments switch on together, so nobody is alone in an
                  empty room.
                </span>
              </li>
            </ul>
            <Link href="/meetups" className={cn(buttonVariants({ variant: "link" }), "mt-4 px-0")}>
              Meet travelers at a city evening first <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>

        <div className="mt-16 grid gap-6 rounded-2xl bg-ink p-10 text-cloud md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="text-3xl font-bold">Your guide is the app.</h2>
            <p className="mt-3 max-w-xl text-cloud/80">
              Every morning it answers three questions: where am I, what is next, and what are my
              options. Everything else is up to you.
            </p>
          </div>
          <Link href="/tours" className={cn(buttonVariants({ variant: "inverse", size: "lg" }))}>
            Explore trips <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
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
