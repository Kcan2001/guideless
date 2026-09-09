import { useQuery } from "@tanstack/react-query";
import { planService } from "@/lib/plans/service";

/**
 * This traveler's own plans for a trip. Private to them, so there is no sharing or presence to
 * think about — and no trip means no query rather than an empty one.
 */
export function useMyPlans(tripId: string | null) {
  return useQuery({
    queryKey: ["plans", tripId],
    queryFn: () => planService.forTrip(tripId!),
    enabled: Boolean(tripId),
    staleTime: 60 * 1000,
  });
}
