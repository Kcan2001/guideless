import type { ReviewStats } from "@/lib/reviews/queries";

/**
 * Attaches an `aggregateRating` to a tour's structured data — and only ever when real published
 * reviews exist. Written as a wrapper rather than a change to `tourJsonLd` so the rule that
 * "no reviews means no rating anywhere" lives next to the reviews code that enforces it.
 */
export function withAggregateRating<T extends Record<string, unknown>>(
  jsonLd: T,
  stats: ReviewStats | null,
): T {
  if (!stats || stats.count < 1) return jsonLd;
  return {
    ...jsonLd,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: stats.average.toFixed(1),
      reviewCount: stats.count,
      bestRating: 5,
      worstRating: 1,
    },
  };
}
