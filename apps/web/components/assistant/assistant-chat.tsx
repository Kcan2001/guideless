"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles } from "lucide-react";
import { ASSISTANT_MESSAGE_MAX } from "@guideless/validation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";

/**
 * The conversation. A plain form, a list, and one fetch — no streaming, because a turn here is a
 * couple of sentences and the complexity of a stream buys nothing a person would notice.
 *
 * Two things it is careful about. It never renders a half-state as an answer: while a request is
 * in flight the question is already on screen and the reply is visibly pending, so nobody wonders
 * whether they pressed the button. And it shows what the assistant *did* — plans added, searches
 * run — as separate cards rather than trusting the prose to have mentioned it.
 */

interface Action {
  tool: string;
  summary: string;
  detail?: Record<string, unknown>;
}

interface Turn {
  role: "user" | "assistant";
  content: string;
  actions?: Action[];
  failed?: boolean;
}

export function AssistantChat({
  bookingId,
  initialTurns,
  messagesLeft: initialLeft,
  suggestions,
}: {
  bookingId: string;
  initialTurns: Turn[];
  messagesLeft: number;
  suggestions: string[];
}) {
  const [turns, setTurns] = useState<Turn[]>(initialTurns);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [messagesLeft, setMessagesLeft] = useState(initialLeft);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns, busy]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setDraft("");
    setBusy(true);
    setTurns((t) => [...t, { role: "user", content: message }]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookingId, message }),
      });
      const body = (await res.json()) as {
        reply?: string;
        actions?: Action[];
        messagesLeft?: number;
        error?: string;
      };
      if (!res.ok) {
        setTurns((t) => [
          ...t,
          {
            role: "assistant",
            content: body.error ?? "That didn't work. Try again.",
            failed: true,
          },
        ]);
        if (res.status === 429) setMessagesLeft(0);
        return;
      }
      setTurns((t) => [
        ...t,
        { role: "assistant", content: body.reply ?? "", actions: body.actions ?? [] },
      ]);
      if (typeof body.messagesLeft === "number") setMessagesLeft(body.messagesLeft);
    } catch {
      setTurns((t) => [
        ...t,
        {
          role: "assistant",
          content: "That didn't reach us. Check your connection and try again.",
          failed: true,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const out = messagesLeft <= 0;

  return (
    <div className="rounded border border-border bg-surface">
      <div className="max-h-[28rem] overflow-y-auto p-5" aria-live="polite">
        {turns.length === 0 && (
          <div className="py-6 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-teal" aria-hidden />
            <p className="mt-3 text-sm text-muted-foreground">
              Ask about your trip — where to eat tonight, what&rsquo;s near the hotel, what to do
              with a free morning. It knows your route and what we recommend; it is not our support
              team, and it can&rsquo;t change your booking.
            </p>
          </div>
        )}

        <ul className="grid gap-4">
          {turns.map((turn, i) => (
            <li
              key={i}
              className={turn.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  turn.role === "user"
                    ? "max-w-[85%] rounded rounded-br bg-ink px-4 py-2.5 text-sm text-cloud"
                    : turn.failed
                      ? "max-w-[85%] rounded rounded-bl border border-warning-border bg-warning-surface px-4 py-2.5 text-sm"
                      : "max-w-[85%] rounded rounded-bl bg-cloud px-4 py-2.5 text-sm"
                }
              >
                <p className="whitespace-pre-line">{turn.content}</p>
                {turn.actions?.map((a, j) => (
                  <p
                    key={j}
                    className="mt-2 rounded border border-aqua/50 bg-aqua/10 px-3 py-1.5 text-xs"
                  >
                    {a.summary}
                    {typeof a.detail?.message === "string" && (
                      <span className="mt-1 block whitespace-pre-line text-muted-foreground">
                        {a.detail.message}
                      </span>
                    )}
                  </p>
                ))}
              </div>
            </li>
          ))}
          {busy && (
            <li className="flex justify-start">
              <p className="rounded rounded-bl bg-cloud px-4 py-2.5 text-sm text-muted-foreground">
                Thinking&hellip;
              </p>
            </li>
          )}
        </ul>
        <div ref={endRef} />
      </div>

      {turns.length === 0 && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-border px-5 py-3">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void send(s)}
              disabled={busy || out}
              className="rounded border border-border px-3 py-1.5 text-xs hover:border-teal disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="border-t border-border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, shift-enter is a new line — what every chat box does.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(draft);
              }
            }}
            rows={2}
            maxLength={ASSISTANT_MESSAGE_MAX}
            disabled={busy || out}
            placeholder={out ? "That's today's questions used up." : "Ask about your trip…"}
            aria-label="Ask the trip assistant"
            className="min-h-0 resize-none"
          />
          <Button type="submit" size="sm" disabled={busy || out || draft.trim().length === 0}>
            <ArrowUp className="h-4 w-4" aria-hidden />
            <span className="sr-only">Send</span>
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {out
            ? "It resets tomorrow. Our team is there in the meantime."
            : `${messagesLeft} question${messagesLeft === 1 ? "" : "s"} left today. It can be wrong — check anything that matters.`}
        </p>
      </form>
    </div>
  );
}
