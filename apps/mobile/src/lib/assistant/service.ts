import { supabase } from "@/lib/supabase";

/**
 * The trip assistant, from the app.
 *
 * This is the one feature that does not talk to Supabase directly. The model key must never reach
 * a phone, and the places and reservation adapters are TypeScript service modules on the web side
 * — so the app calls the same `/api/ai/chat` route the web page does, with its Supabase access
 * token as a bearer. Row-level security applies identically; the only difference is where the
 * session comes from.
 */

export const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://guidelesstravel.com";

export interface AssistantAction {
  tool: string;
  summary: string;
  detail?: Record<string, unknown>;
}

export interface AssistantTurn {
  role: "user" | "assistant";
  content: string;
  actions?: AssistantAction[];
  failed?: boolean;
}

export type AssistantReply =
  | { ok: true; reply: string; actions: AssistantAction[]; messagesLeft: number }
  | { ok: false; message: string; outOfMessages: boolean };

export const assistantService = {
  /** The conversation so far, read straight from the database — it is the traveler's own row. */
  async history(bookingId: string): Promise<AssistantTurn[]> {
    const { data: conversation } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("booking_id", bookingId)
      .maybeSingle();
    if (!conversation) return [];

    const { data } = await supabase
      .from("ai_messages")
      .select("role, content, actions")
      .eq("conversation_id", conversation.id)
      .order("created_at")
      .limit(40);

    return (data ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      actions: (m.actions ?? []) as unknown as AssistantAction[],
    }));
  },

  async messagesLeft(): Promise<number> {
    const { data } = await supabase.rpc("ai_messages_left");
    return typeof data === "number" ? data : 0;
  },

  async ask(bookingId: string, message: string): Promise<AssistantReply> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { ok: false, message: "Sign in first.", outOfMessages: false };

    try {
      const res = await fetch(`${SITE_URL}/api/ai/chat`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ bookingId, message }),
      });
      const body = (await res.json()) as {
        reply?: string;
        actions?: AssistantAction[];
        messagesLeft?: number;
        error?: string;
      };
      if (!res.ok) {
        return {
          ok: false,
          message: body.error ?? "That didn't work. Try again.",
          outOfMessages: res.status === 429,
        };
      }
      return {
        ok: true,
        reply: body.reply ?? "",
        actions: body.actions ?? [],
        messagesLeft: body.messagesLeft ?? 0,
      };
    } catch {
      // Offline is the normal case for this app, not an exception. Say so plainly: the assistant
      // is the one screen that genuinely cannot work without signal.
      return {
        ok: false,
        message: "You're offline. Your itinerary still works — the assistant needs a connection.",
        outOfMessages: false,
      };
    }
  },
};
