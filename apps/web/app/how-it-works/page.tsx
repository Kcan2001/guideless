import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@guideless/config";

export const metadata: Metadata = {
  title: "How it works",
  description: brand.description,
};

const steps = [
  ["Pick a trip", "Choose a route and a departure date that suits you."],
  [
    "Book",
    "Reserve your place with a deposit. We handle hotels, trains, transfers and selected experiences.",
  ],
  ["Fly in", "You book your own flight. We tell you exactly where to go when you land."],
  [
    "Meet the group",
    "A welcome transfer and a first evening together — optional, like everything else.",
  ],
  ["Follow your itinerary", "Your phone knows where you are, what is next, and what is nearby."],
  ["Explore independently", "Free time is built in on purpose. No headcounts. No flag to follow."],
  [
    "Join optional experiences",
    "A wine tasting, a sunset walk, a group dinner — when you feel like it.",
  ],
  ["Travel onward", "Trains and hotels are arranged for every stop on the route."],
  [
    "Stay connected",
    "Group chat before, during and after. Real people at Guideless when you need them.",
  ],
] as const;

/** Placeholder content; the designed page is Milestone 3. */
export default function HowItWorksPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-24">
      <p className="mb-6 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
        How Guideless works
      </p>
      <h1 className="max-w-3xl text-4xl font-bold md:text-6xl">{brand.taglineSecondary}</h1>
      <ol className="mt-16 grid max-w-4xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map(([title, body], i) => (
          <li key={title} className="rounded-xl border border-border bg-surface p-6">
            <span className="font-heading text-sm font-semibold text-link">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h2 className="mt-2 text-xl font-semibold">{title}</h2>
            <p className="mt-2 text-muted-foreground">{body}</p>
          </li>
        ))}
      </ol>
      <Link
        href="/tours"
        className="mt-16 inline-flex w-fit items-center rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground no-underline hover:opacity-90"
      >
        Explore trips
      </Link>
    </main>
  );
}
