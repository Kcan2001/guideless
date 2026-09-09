import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { locationService } from "@/lib/location/service";

/**
 * Sharing your position with the group, and reading everyone else's.
 *
 * The refresh loop is deliberately modest: a position is pushed when the app is in the foreground
 * and the traveler is actually sharing, every couple of minutes, and never when the app is in the
 * background. That is enough for "where is everyone for the swim" and nothing like enough to
 * follow somebody around.
 *
 * It also never extends the window. A traveler who said "share for two hours" gets two hours,
 * whatever the refresh does — the refresh updates the position, not the promise.
 */

const REFRESH_MS = 2 * 60 * 1000;
/** Others' positions are hidden by the database once stale, so polling any slower shows gaps. */
const POLL_MS = 60 * 1000;

export function useLocationSharing(tripId: string | null, userId: string | null) {
  const qc = useQueryClient();

  const mine = useQuery({
    queryKey: ["location-sharing", tripId, userId],
    queryFn: () => locationService.mySharing(tripId!, userId!),
    enabled: Boolean(tripId && userId),
  });

  const others = useQuery({
    queryKey: ["trip-locations", tripId],
    queryFn: () => locationService.sharedOnTrip(tripId!),
    enabled: Boolean(tripId),
    refetchInterval: POLL_MS,
  });

  // A ticking clock rather than Date.now() in render, and not only to satisfy the linter: sharing
  // lapses with time, so the control has to notice the moment it does instead of still claiming to
  // be on until something else happens to re-render.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, []);

  const sharing = Boolean(mine.data && new Date(mine.data.sharing_until).getTime() > now);

  // Push a fresh position while sharing and while the app is actually open. Cleared on unmount and
  // whenever sharing stops, so nothing keeps ticking after somebody goes dark.
  useEffect(() => {
    if (!sharing || !tripId || !userId) return;
    const push = () => {
      if (AppState.currentState !== "active") return;
      void locationService.refreshShared(tripId, userId);
    };
    const timer = setInterval(push, REFRESH_MS);
    return () => clearInterval(timer);
  }, [sharing, tripId, userId]);

  const start = useMutation({
    mutationFn: async (hours: number) => {
      if (!tripId || !userId) throw new Error("No trip");
      const result = await locationService.startSharing(tripId, userId, hours);
      if (!result.ok) throw new Error(result.reason);
      return result;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["location-sharing", tripId] });
      void qc.invalidateQueries({ queryKey: ["trip-locations", tripId] });
    },
  });

  const stop = useMutation({
    mutationFn: async () => {
      if (!tripId || !userId) return;
      await locationService.stopSharing(tripId, userId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["location-sharing", tripId] });
      void qc.invalidateQueries({ queryKey: ["trip-locations", tripId] });
    },
  });

  return {
    sharing,
    sharingUntil: mine.data?.sharing_until ?? null,
    /** Everyone else who is sharing — mine is filtered out so the map does not double-pin me. */
    others: (others.data ?? []).filter((l) => l.user_id !== userId),
    start,
    stop,
    isPending: mine.isPending,
  };
}
