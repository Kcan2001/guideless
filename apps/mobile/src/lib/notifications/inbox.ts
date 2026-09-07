import { sortInbox, type Notification } from "@/lib/notifications/inbox-helpers";
import { supabase } from "@/lib/supabase";

export * from "@/lib/notifications/inbox-helpers";

/**
 * The in-app channel (spec §27). Rows are written by triggers and jobs; the dispatcher handles
 * push and email. RLS scopes reads and read-receipts to the signed-in user.
 */
export const inboxService = {
  async list(limit = 100): Promise<Notification[]> {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return sortInbox(data);
  },

  async markRead(id: string): Promise<void> {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .is("read_at", null);
    if (error) throw error;
  },

  async markAllRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) throw error;
  },

  subscribe(userId: string, onChange: () => void) {
    return supabase
      .channel(`inbox:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        onChange,
      )
      .subscribe();
  },
};
