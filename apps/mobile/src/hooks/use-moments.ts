import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { track } from "@/lib/analytics";
import { useSession } from "@/lib/auth/session";
import { momentsService, type MomentWithState } from "@/lib/moments/service";
import { supabase } from "@/lib/supabase";

/**
 * Live Moments for a trip plus the join/leave mutation, shared by the Group tab and the Trip
 * home so both screens read the same cache and show the same counts.
 */
export function useMoments(tripId: string | null, options: { realtime?: boolean } = {}) {
  const { realtime = false } = options;
  const qc = useQueryClient();
  const { user } = useSession();

  const query = useQuery({
    queryKey: ["moments", tripId],
    enabled: !!tripId && !!user,
    queryFn: () => momentsService.list(tripId!, user!.id),
  });

  useEffect(() => {
    if (!realtime || !tripId) return;
    const channel = momentsService.subscribe(tripId, () =>
      qc.invalidateQueries({ queryKey: ["moments", tripId] }),
    );
    return () => {
      supabase.removeChannel(channel);
    };
  }, [realtime, tripId, qc]);

  const toggle = useMutation({
    mutationFn: async ({ momentId, going }: { momentId: string; going: boolean }) => {
      if (going) {
        await momentsService.join(momentId, user!.id);
        track("live_moment_joined", { moment_id: momentId });
      } else {
        await momentsService.leave(momentId, user!.id);
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["moments", tripId] }),
  });

  return {
    moments: (query.data ?? []) as MomentWithState[],
    isPending: query.isPending,
    toggle,
  };
}
