import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
