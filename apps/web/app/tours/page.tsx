import type { Metadata } from "next";
import Link from "next/link";
import { emptyStates } from "@guideless/config";

export const metadata: Metadata = {
  title: "Trips",
  description: "Small-group trips with the logistics organized and the exploring left to you.",
};

/**
 * Placeholder. The filterable tour listing (destination, duration, month, price, activity level,
 * group size, style) is Milestone 3 and reads from tours / tour_versions / departures.
 */
export default function ToursPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-24">
      <h1 className="text-4xl font-bold md:text-6xl">Trips</h1>
      <div className="mt-16 max-w-md rounded-xl border border-border bg-surface p-8">
        <p className="font-heading text-lg font-semibold">{emptyStates.noRecommendations.title}</p>
        <p className="mt-2 text-muted-foreground">
          Our first departures are being finalized. Southern France — Nice, Avignon, Paris — is up
          first.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm font-medium">
          ← Back to home
        </Link>
      </div>
    </main>
  );
}
