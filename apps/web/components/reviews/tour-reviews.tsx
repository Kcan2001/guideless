import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ReviewCard } from "@/components/reviews/review-card";
import { Stars } from "@/components/reviews/stars";
import { buttonVariants } from "@/components/ui/button";
import type { PublishedReview, ReviewStats } from "@/lib/reviews/queries";
import { cn } from "@/lib/utils";

/**
 * Reviews on a tour page. Renders nothing at all when a tour has none — no heading, no "0
 * reviews", no empty stars. A trip nobody has written about yet should look like a trip nobody
 * has written about yet, not like a trip rated zero.
 */
export function TourReviews({
  stats,
  reviews,
  tourName,
}: {
  stats: ReviewStats | null;
  reviews: PublishedReview[];
  tourName: string;
}) {
  if (!stats || reviews.length === 0) return null;

  return (
    <section id="reviews" className="border-t border-border bg-cloud/40">
      <div className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-muted-foreground">From travelers</p>
            <h2 className="mt-3 font-heading text-3xl ">What people said about {tourName}.</h2>
            <p className="mt-3 flex flex-wrap items-center gap-3 text-muted-foreground">
              <Stars rating={stats.average} size="lg" />
              <span>
                {stats.average.toFixed(1)} from {stats.count}{" "}
                {stats.count === 1 ? "traveler" : "travelers"} who took this trip
              </span>
            </p>
          </div>
          <Link href="/reviews" className={cn(buttonVariants({ variant: "secondary" }))}>
            All reviews <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {reviews.map((r) => (
            <ReviewCard key={r.id} review={r} showTour={false} />
          ))}
        </div>
      </div>
    </section>
  );
}
