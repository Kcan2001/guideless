import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Tables } from "@guideless/types";
import { supabase } from "@/lib/supabase";

export type ChatRoom = Tables<"chat_rooms">;
export type Message = Tables<"messages">;

export interface RoomSummary extends ChatRoom {
  lastMessage: Message | null;
  unread: number;
}

/**
 * Group chat over Supabase Realtime (ADR-010). RLS restricts rooms/messages to members;
 * announcements are staff-only to post. Moderation happens in admin.
 */
export const chatService = {
  async listRooms(tripId: string): Promise<RoomSummary[]> {
    const [{ data: rooms, error }, { data: membership }] = await Promise.all([
      supabase
        .from("chat_rooms")
        .select("*")
        .eq("trip_id", tripId)
        .eq("is_archived", false)
        .order("type"),
      supabase.from("chat_members").select("room_id, last_read_at").is("removed_at", null),
    ]);
    if (error) throw error;
    const lastRead = new Map((membership ?? []).map((m) => [m.room_id, m.last_read_at]));
    return Promise.all(
      (rooms ?? []).map(async (room) => {
        const since = lastRead.get(room.id);
        const [{ data: last }, { count }] = await Promise.all([
          supabase
            .from("messages")
            .select("*")
            .eq("room_id", room.id)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          since
            ? supabase
                .from("messages")
                .select("id", { count: "exact", head: true })
                .eq("room_id", room.id)
                .is("deleted_at", null)
                .gt("created_at", since)
            : supabase
                .from("messages")
                .select("id", { count: "exact", head: true })
                .eq("room_id", room.id)
                .is("deleted_at", null),
        ]);
        return { ...room, lastMessage: last ?? null, unread: count ?? 0 };
      }),
    );
  },

  async getRoom(roomId: string): Promise<ChatRoom | null> {
    const { data, error } = await supabase
      .from("chat_rooms")
      .select("*")
      .eq("id", roomId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async listMessages(roomId: string, limit = 100): Promise<Message[]> {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("room_id", roomId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data.reverse();
  },

  async sendMessage(roomId: string, senderId: string, body: string): Promise<Message> {
    const text = body.trim();
    if (!text) throw new Error("Message is empty");
    const { data, error } = await supabase
      .from("messages")
      .insert({ room_id: roomId, sender_id: senderId, body: text })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async markRead(roomId: string, userId: string): Promise<void> {
    await supabase
      .from("chat_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("room_id", roomId)
      .eq("user_id", userId);
  },

  /** Live inserts for one room. Returns the channel; call `supabase.removeChannel(channel)` to stop. */
  subscribe(roomId: string, onMessage: (m: Message) => void): RealtimeChannel {
    return supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        (payload) => onMessage(payload.new as Message),
      )
      .subscribe();
  },

  async report(reporterId: string, messageId: string, reason: string): Promise<void> {
    const { error } = await supabase
      .from("reports")
      .insert({ reporter_id: reporterId, message_id: messageId, reason });
    if (error) throw error;
  },

  async block(blockerId: string, blockedId: string): Promise<void> {
    const { error } = await supabase
      .from("user_blocks")
      .insert({ blocker_id: blockerId, blocked_id: blockedId });
    if (error && error.code !== "23505") throw error;
  },
};
