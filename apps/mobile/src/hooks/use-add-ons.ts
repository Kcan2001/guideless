import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth/session";
import { addOnsService } from "@/lib/add-ons/service";
import { groupService } from "@/lib/group/service";
import type { TripDetail } from "@/lib/trips/service";

export const addOnKeys = {
  trip: (tripId: string) => ["add-ons", tripId] as const,
  booking: (tripId: string, userId: string) => ["my-booking", tripId, userId] as const,
};

/** Optional add-ons for the trip's departure plus the traveler's booking id for the purchase link. */
export function useTripAddOns(detail: TripDetail | null) {
  const { user } = useSession();
  const tripId = detail?.trip.id ?? null;
  const userId = user?.id ?? null;

  const addOns = useQuery({
    queryKey: addOnKeys.trip(tripId ?? "none"),
    enabled: !!detail,
    staleTime: 60_000,
    queryFn: () =>
      addOnsService.listForTrip({
        tripId: detail!.trip.id,
        departureId: detail!.trip.departure_id,
        startDate: detail!.trip.start_date,
        endDate: detail!.trip.end_date,
        userId,
      }),
  });

  const booking = useQuery({
    queryKey: addOnKeys.booking(tripId ?? "none", userId ?? "none"),
    enabled: !!tripId && !!userId,
    staleTime: 5 * 60_000,
    queryFn: () => groupService.myBookingIdForTrip(tripId!, userId!),
  });

  return {
    addOns: addOns.data ?? [],
    isPending: addOns.isPending,
    bookingId: booking.data ?? null,
  };
}
