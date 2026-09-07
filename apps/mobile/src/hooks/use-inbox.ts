import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useSession } from "@/lib/auth/session";
import { inboxService, unreadCount } from "@/lib/notifications/inbox";
import { supabase } from "@/lib/supabase";

export const inboxKey = (userId: string) => ["inbox", userId] as const;

/** The in-app notification list with Realtime refresh; unread count for the bell. */
export function useInbox() {
  const { user } = useSession();
  const qc = useQueryClient();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: inboxKey(userId ?? "none"),
    enabled: !!userId,
    queryFn: () => inboxService.list(),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!userId) return;
    const channel = inboxService.subscribe(userId, () =>
      qc.invalidateQueries({ queryKey: inboxKey(userId) }),
    );
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  const markRead = useMutation({
    mutationFn: (id: string) => inboxService.markRead(id),
    onSuccess: () => userId && qc.invalidateQueries({ queryKey: inboxKey(userId) }),
  });
  const markAllRead = useMutation({
    mutationFn: () => inboxService.markAllRead(userId!),
    onSuccess: () => userId && qc.invalidateQueries({ queryKey: inboxKey(userId) }),
  });

  return {
    ...query,
    unread: query.data ? unreadCount(query.data) : 0,
    markRead,
    markAllRead,
  };
}
