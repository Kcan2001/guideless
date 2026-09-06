import type { SupportCategory, Tables } from "@guideless/types";
import { supabase } from "@/lib/supabase";

export type SupportThread = Tables<"support_threads">;
export type SupportMessage = Tables<"support_messages">;

export interface NewThreadInput {
  customerId: string;
  category: SupportCategory;
  subject: string;
  body: string;
  tripId?: string | null;
  context?: {
    itineraryItemId?: string;
    latitude?: number;
    longitude?: number;
    appVersion?: string;
  };
}

/** In-app support (spec §29). Staff see trip, booking and location context alongside the thread. */
export const supportService = {
  async listThreads(): Promise<SupportThread[]> {
    const { data, error } = await supabase
      .from("support_threads")
      .select("*")
      .order("last_message_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  async getThread(
    threadId: string,
  ): Promise<{ thread: SupportThread; messages: SupportMessage[] } | null> {
    const [{ data: thread, error }, { data: messages, error: mErr }] = await Promise.all([
      supabase.from("support_threads").select("*").eq("id", threadId).maybeSingle(),
      supabase.from("support_messages").select("*").eq("thread_id", threadId).order("created_at"),
    ]);
    if (error) throw error;
    if (mErr) throw mErr;
    if (!thread) return null;
    return { thread, messages: messages ?? [] };
  },

  async createThread(input: NewThreadInput): Promise<SupportThread> {
    const { data: thread, error } = await supabase
      .from("support_threads")
      .insert({
        customer_id: input.customerId,
        category: input.category,
        subject: input.subject.trim(),
        trip_id: input.tripId ?? null,
        status: "open",
        priority: input.category === "emergency" ? "urgent" : "normal",
        context: input.context ?? {},
      })
      .select("*")
      .single();
    if (error) throw error;
    const { error: mErr } = await supabase.from("support_messages").insert({
      thread_id: thread.id,
      sender_id: input.customerId,
      body: input.body.trim(),
      is_from_staff: false,
    });
    if (mErr) throw mErr;
    return thread;
  },

  async reply(threadId: string, senderId: string, body: string): Promise<SupportMessage> {
    const { data, error } = await supabase
      .from("support_messages")
      .insert({ thread_id: threadId, sender_id: senderId, body: body.trim(), is_from_staff: false })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  subscribe(threadId: string, onMessage: (m: SupportMessage) => void) {
    return supabase
      .channel(`support:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => onMessage(payload.new as SupportMessage),
      )
      .subscribe();
  },
};

export const SUPPORT_CATEGORY_LABELS: Record<SupportCategory, string> = {
  hotel: "Hotel",
  transportation: "Train, transfer or flight",
  activity: "An experience",
  booking: "My booking",
  payment: "Payment",
  lost_item: "Lost item",
  itinerary: "Itinerary question",
  emergency: "Urgent — I need help now",
  other: "Something else",
};
