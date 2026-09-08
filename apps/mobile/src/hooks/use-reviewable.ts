import { useQuery } from "@tanstack/react-query";
import { reviewService } from "@/lib/reviews/service";

/**
 * Trips this traveler could review right now. Returns an empty list for everyone else, so the
 * prompt simply does not render rather than needing a guard at every call site.
 */
export function useReviewable() {
  return useQuery({
    queryKey: ["reviewable"],
    queryFn: () => reviewService.reviewable(),
    staleTime: 5 * 60 * 1000,
  });
}
