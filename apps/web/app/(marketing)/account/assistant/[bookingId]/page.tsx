import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { formatDate } from "@guideless/utils";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import { SubmitButton } from "@/components/admin/submit-button";
import { Field, FormError, FormMessage, Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { assistantIsConfigured } from "@/lib/assistant/chat";
import { buildAssistantContext } from "@/lib/assistant/context";
import { addPlanAction, removePlanAction } from "@/lib/plans/actions";
import { listMyPlans } from "@/lib/plans/queries";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your trip assistant",
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The assistant, and the plans it writes to, on one page.
 *
 * They belong together: the point of the conversation is that something comes out of it, and a
 * traveler needs to see the list it is changing. The plans list is also a plain form, so the
 * feature works with the assistant switched off — which is the state every environment without an
 * API key is in, including a local checkout.
 */
export default async function AssistantPage(props: PageProps<"/account/assistant/[bookingId]">) {
  const [{ bookingId }, sp] = await Promise.all([props.params, props.searchParams]);
  if (!UUID.test(bookingId)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/account/assistant/${bookingId}`)}`);

  const ctx = await buildAssistantContext(bookingId);
  if (!ctx) notFound();

  const [plans, history] = await Promise.all([listMyPlans({ bookingId }), loadTurns(bookingId)]);
  const configured = assistantIsConfigured();
  const notice = typeof sp.notice === "string" ? sp.notice : null;
  const errorMsg = typeof sp.error_msg === "string" ? sp.error_msg : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link
        href="/account"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground no-underline hover:text-link"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to your account
      </Link>

      <p className="mt-6 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {ctx.tourName}
      </p>
      <h1 className="mt-2 font-heading text-3xl font-bold">Your trip assistant</h1>
      <p className="mt-2 text-muted-foreground">
        {ctx.phase === "during"
          ? `Day ${ctx.today?.dayNumber ?? ""} — it is ${ctx.localTime} where you are.`
          : ctx.phase === "before"
            ? `${formatDate(ctx.startDate)} to ${formatDate(ctx.endDate)}. Ask anything about getting ready.`
            : "Your trip has ended, but your plans are still here."}
      </p>

      {notice && (
        <div className="mt-6">
          <FormMessage message={notice} />
        </div>
      )}
      {errorMsg && (
        <div className="mt-6">
          <FormError message={errorMsg} />
        </div>
      )}

      <div className="mt-8">
        {configured ? (
          <AssistantChat
            bookingId={bookingId}
            initialTurns={history}
            messagesLeft={ctx.messagesLeftToday}
            suggestions={suggestionsFor(ctx.phase)}
          />
        ) : (
          <p className="rounded border border-border bg-surface p-6 text-sm text-muted-foreground">
            The assistant isn&rsquo;t switched on yet. Your own plans below work regardless, and our
            team answers anything at{" "}
            <Link href="/contact" className="text-link">
              contact
            </Link>
            .
          </p>
        )}
      </div>

      <section className="mt-12" id="plans">
        <h2 className="font-heading text-xl font-semibold">Your plans</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Yours alone — nobody else on the trip sees these, and they appear in your calendar
          download alongside the itinerary.
        </p>

        {plans.length > 0 ? (
          <ul className="mt-4 divide-y divide-border rounded border border-border bg-surface">
            {plans.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{p.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                    <span>
                      {p.plan_date ? formatDate(p.plan_date) : "No date yet"}
                      {p.start_time ? ` · ${p.start_time.slice(0, 5)}` : ""}
                    </span>
                    {p.location_name && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" aria-hidden />
                        {p.location_name}
                      </span>
                    )}
                    {p.source === "assistant" && <span>Suggested by the assistant</span>}
                  </p>
                  {p.notes && <p className="mt-1 text-sm text-muted-foreground">{p.notes}</p>}
                </div>
                <form action={removePlanAction}>
                  <input type="hidden" name="planId" value={p.id} />
                  <input type="hidden" name="bookingId" value={bookingId} />
                  <SubmitButton size="sm" variant="secondary" pendingText="Removing…">
                    Remove
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded border border-border bg-surface p-6 text-sm text-muted-foreground">
            Nothing yet. Add something below, or ask the assistant and say yes.
          </p>
        )}

        <details className="mt-4 rounded border border-border bg-surface p-5">
          <summary className="cursor-pointer text-sm font-medium">Add something yourself</summary>
          <form action={addPlanAction} className="mt-4 grid gap-4">
            <input type="hidden" name="bookingId" value={bookingId} />
            <input type="hidden" name="timezone" value={ctx.timezone} />
            <Field id="plan-title" label="What is it?">
              <Input
                id="plan-title"
                name="title"
                required
                maxLength={200}
                placeholder="Dinner at Oliviera"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="plan-date" label="Day (optional)">
                <Input
                  id="plan-date"
                  name="planDate"
                  type="date"
                  min={ctx.startDate}
                  max={ctx.endDate}
                />
              </Field>
              <Field id="plan-time" label="Time (optional)" hint={`Local time in ${ctx.timezone}`}>
                <Input id="plan-time" name="startTime" type="time" />
              </Field>
            </div>
            <Field id="plan-where" label="Where (optional)">
              <Input id="plan-where" name="locationName" maxLength={200} />
            </Field>
            <Field id="plan-notes" label="Notes (optional)">
              <Textarea id="plan-notes" name="notes" rows={2} maxLength={2000} />
            </Field>
            <div>
              <Button type="submit">Add to your plans</Button>
            </div>
          </form>
        </details>
      </section>
    </div>
  );
}

/** Openers that are actually answerable in each phase — a dead suggestion is worse than none. */
function suggestionsFor(phase: "before" | "during" | "after"): string[] {
  if (phase === "before") {
    return [
      "What should I pack?",
      "How do I get from the airport?",
      "What is there to do on the free day?",
    ];
  }
  if (phase === "during") {
    return ["Where's good for dinner tonight?", "What's near me right now?", "What's on tomorrow?"];
  }
  return [];
}

async function loadTurns(
  bookingId: string,
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const sb = await createClient();
  const { data: conversation } = await sb
    .from("ai_conversations")
    .select("id")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (!conversation) return [];
  const { data } = await sb
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversation.id)
    .order("created_at")
    .limit(40);
  return (data ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
}
