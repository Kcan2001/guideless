import Link from "next/link";
import { formatDate } from "@guideless/utils";
import { Stars } from "@/components/reviews/stars";
import type { PublishedReview } from "@/lib/reviews/queries";

/** One published review. `showTour` is off on a tour page, where the trip is already the subject. */
export function ReviewCard({
  review,
  showTour = true,
}: {
  review: PublishedReview;
  showTour?: boolean;
}) {
  return (
    <article className="rounded-xl border border-border bg-surface p-6">
      <Stars rating={review.rating} />
      {review.title && <h3 className="mt-3 font-heading text-lg font-semibold">{review.title}</h3>}
      <p className="mt-2 whitespace-pre-line text-muted-foreground">{review.body}</p>
      <footer className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{review.authorName}</span>
        {showTour && review.tourSlug && (
          <>
            <span aria-hidden>·</span>
            <Link href={`/tours/${review.tourSlug}`}>{review.tourName}</Link>
          </>
        )}
        {review.tripEndDate && (
          <>
            <span aria-hidden>·</span>
            <span>Travelled {formatDate(review.tripEndDate)}</span>
          </>
        )}
        {review.wouldRepeat && (
          <>
            <span aria-hidden>·</span>
            <span>Would travel Guideless again</span>
          </>
        )}
      </footer>
    </article>
  );
}
