import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { ReviewCard } from "@/components/reviews/review-card";
import { Stars } from "@/components/reviews/stars";
import { JsonLd } from "@/components/site/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { listPublishedReviews } from "@/lib/reviews/queries";
import { breadcrumbJsonLd } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Reviews",
  description:
    "What Guideless travelers said after their trip. Every review is written by someone who took the trip, and nothing is published until we have read it.",
  alternates: { canonical: "/reviews" },
};

/** Hero photo lives here rather than in sitePhotos so the page owns its own art direction. */
const HERO = "/photos/nice-market-soaps.jpg";

export default async function ReviewsPage() {
  const reviews = await listPublishedReviews();
  const average =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;

  return (
    <>
      <PageHero
        photo={HERO}
        fallbackAlt="A market stall in Nice on a bright morning"
        eyebrow="Reviews"
        title="Written by people who went."
        lede="A review here means someone booked a Guideless trip, travelled on it, and wrote about it afterwards. There is no other way for one to appear."
        compact
      />

      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        {reviews.length === 0 ? (
          <div className="max-w-2xl">
            <h2 className="font-heading text-2xl ">Nothing here yet.</h2>
            <p className="mt-3 text-muted-foreground">
              Our first departures have not travelled yet, so nobody has written a review. When they
              do, their words will appear here unedited. We will not be filling this page with
              anything else in the meantime.
            </p>
            <Link
              href="/tours"
              className={cn(buttonVariants({ variant: "secondary" }), "mt-6 inline-flex")}
            >
              See the trips <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        ) : (
          <>
            {average !== null && (
              <p className="flex flex-wrap items-center gap-3 text-muted-foreground">
                <Stars rating={average} size="lg" />
                <span>
                  {average.toFixed(1)} across {reviews.length}{" "}
                  {reviews.length === 1 ? "review" : "reviews"}
                </span>
              </p>
            )}
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {reviews.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </div>
          </>
        )}
      </section>

      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Reviews", path: "/reviews" },
        ])}
      />
    </>
  );
}
