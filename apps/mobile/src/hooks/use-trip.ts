import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { pickCurrentTrip } from "@/lib/trips/next-up";
import { tripCache, type CachedTrip } from "@/lib/trips/cache";
import { tripService, type TripDetail } from "@/lib/trips/service";

export const tripKeys = {
  list: ["trips"] as const,
  detail: (id: string) => ["trip", id] as const,
};

export function useMyTrips() {
  return useQuery({ queryKey: tripKeys.list, queryFn: tripService.listMyTrips });
}

/**
 * Trip detail with an offline fallback: while the network request runs (or fails) we serve the
 * last cached copy and expose `syncedAt` so the UI can say "Last synced 8 minutes ago".
 */
export function useTrip(tripId: string | null) {
  const [cached, setCached] = useState<CachedTrip | null>(null);

  useEffect(() => {
    if (!tripId) return;
    let alive = true;
    tripCache.load(tripId).then((c) => alive && setCached(c));
    return () => {
      alive = false;
    };
  }, [tripId]);

  const query = useQuery({
    queryKey: tripKeys.detail(tripId ?? "none"),
    enabled: !!tripId,
    queryFn: async () => {
      const detail = await tripService.getTrip(tripId!);
      if (detail) await tripCache.save(detail);
      return detail;
    },
  });

  const detail: TripDetail | null = query.data ?? cached?.detail ?? null;
  const offline = !query.data && !!cached && (query.isError || query.isPending);
  const syncedAt = query.data ? new Date().toISOString() : (cached?.syncedAt ?? null);

  return { ...query, detail, offline, syncedAt };
}

/** The trip the home screen should show: active, else soonest upcoming, else latest past. */
export function useCurrentTrip() {
  const trips = useMyTrips();
  const today = new Date().toISOString().slice(0, 10);
  const current = trips.data ? pickCurrentTrip(trips.data, today) : null;
  const detail = useTrip(current?.id ?? null);
  return { trips, current, ...detail };
}

export function useInvalidateTrip() {
  const qc = useQueryClient();
  return (tripId: string) => qc.invalidateQueries({ queryKey: tripKeys.detail(tripId) });
}
