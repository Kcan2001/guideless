import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { buildAssistantContext, type AssistantContext } from "@/lib/assistant/context";
import { costMicros } from "@/lib/assistant/cost";
import { assistantRules, assistantTripContext } from "@/lib/assistant/prompt";
import { ASSISTANT_TOOLS, runAssistantTool, type ToolAction } from "@/lib/assistant/tools";
import { getServerEnv } from "@/lib/env";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

/**
 * One turn of the trip assistant.
 *
 * The order of operations is the whole design and is not negotiable:
 *
 *   1. Build the context as the traveler, so RLS decides what the model can possibly know.
 *   2. Claim one message against today's allowance — atomically, before any billable call.
 *   3. Run the model, executing tools until it stops asking for them.
 *   4. Record what it cost, whatever happened, including when it failed.
 *
 * Step 2 before step 3 is the part people get wrong. Checking the quota after the call means a
 * runaway client has already spent the money by the time it is told to stop.
 */

export const MAX_TOOL_ROUNDS = 5;
const MAX_TOKENS = 2000;

export type AssistantResult =
  | { ok: true; reply: string; actions: ToolAction[]; messagesLeft: number }
  | { ok: false; reason: "not_eligible" | "quota" | "unconfigured" | "failed"; message: string };

export function assistantIsConfigured(): boolean {
  return Boolean(getServerEnv().ANTHROPIC_API_KEY);
}

export async function sendAssistantMessage(
  bookingId: string,
  message: string,
): Promise<AssistantResult> {
  const env = getServerEnv();
  if (!env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      reason: "unconfigured",
      message: "The trip assistant is not switched on yet.",
    };
  }

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return { ok: false, reason: "not_eligible", message: "Sign in first." };
  }

  // RLS decides this: a booking that is not theirs produces no context at all.
  const ctx = await buildAssistantContext(bookingId);
  if (!ctx) {
    return {
      ok: false,
      reason: "not_eligible",
      message: "That trip is not one of yours.",
    };
  }

  // The meter runs on the service role, because a client that could spend its own allowance could
  // also decline to.
  const service = createServiceRoleClient();
  const { data: claimed, error: claimError } = await service.rpc("ai_claim_message", {
    p_user_id: user.id,
    p_booking_id: bookingId,
  });
  if (claimError || claimed !== true) {
    return {
      ok: false,
      reason: "quota",
      message:
        "That is all the questions for today. The assistant resets tomorrow — and our team is " +
        "there in the meantime.",
    };
  }

  const history = await loadHistory(sb, ctx, user.id);
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;
  const actions: ToolAction[] = [];

  const messages: Anthropic.MessageParam[] = [...history, { role: "user", content: message }];

  try {
    let reply = "";
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
      const response = await anthropic.messages.create({
        model: env.ASSISTANT_MODEL,
        max_tokens: MAX_TOKENS,
        thinking: { type: "adaptive" },
        output_config: { effort: "low" },
        system: [
          // The rules never change, so they are the cached prefix. The trip context changes per
          // traveler and per day and deliberately sits after the breakpoint.
          { type: "text", text: assistantRules(), cache_control: { type: "ephemeral" } },
          { type: "text", text: assistantTripContext(ctx) },
        ],
        tools: ASSISTANT_TOOLS,
        messages,
      });

      inputTokens += response.usage.input_tokens;
      outputTokens += response.usage.output_tokens;
      cacheReadTokens += response.usage.cache_read_input_tokens ?? 0;
      cacheWriteTokens += response.usage.cache_creation_input_tokens ?? 0;

      // A safety decline is an answer, not a crash — and it must not look like a bug to a traveler.
      if (response.stop_reason === "refusal") {
        reply = "I can't help with that one. Our team can — there's a link to them in the app.";
        break;
      }

      reply = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();

      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );
      if (response.stop_reason !== "tool_use" || toolUses.length === 0) break;

      messages.push({ role: "assistant", content: response.content });

      // All results go back in one user message: splitting them teaches the model to stop asking
      // for tools in parallel.
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const use of toolUses) {
        const outcome = await runAssistantTool(use.name, use.input, ctx);
        if (outcome.action) actions.push(outcome.action);
        results.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: outcome.content,
          is_error: outcome.isError,
        });
      }
      messages.push({ role: "user", content: results });

      if (round === MAX_TOOL_ROUNDS) {
        // Out of rounds: answer with what we have rather than looping on somebody's bill.
        reply ||=
          "I looked into that but couldn't finish. Ask me again and I'll try a different way.";
      }
    }

    if (!reply) reply = "I didn't get anywhere with that one. Try asking it a different way?";

    await persist(service, ctx, user.id, message, reply, actions);
    const left = await recordCost(service, user.id, {
      model: env.ASSISTANT_MODEL,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
    });
    return { ok: true, reply, actions, messagesLeft: left };
  } catch (err) {
    // The message was already claimed and the tokens already spent, so the cost is recorded even
    // though the traveler got nothing. An unbilled failure would make the admin screen a lie.
    await recordCost(service, user.id, {
      model: env.ASSISTANT_MODEL,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
    });
    const status = err instanceof Anthropic.APIError ? err.status : undefined;
    console.error("assistant turn failed", { status, bookingId });
    return {
      ok: false,
      reason: "failed",
      message:
        status === 429
          ? "The assistant is busy right now. Try again in a moment."
          : "That didn't work. Nothing was changed — try again in a moment.",
    };
  }
}

/** The last few turns, oldest first. Enough for a conversation, not enough to be a bill. */
async function loadHistory(
  sb: Awaited<ReturnType<typeof createClient>>,
  ctx: AssistantContext,
  userId: string,
): Promise<Anthropic.MessageParam[]> {
  const { data: conversation } = await sb
    .from("ai_conversations")
    .select("id")
    .eq("booking_id", ctx.bookingId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!conversation) return [];

  const { data: rows } = await sb
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(12);

  return (rows ?? [])
    .reverse()
    .map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));
}

async function persist(
  service: ReturnType<typeof createServiceRoleClient>,
  ctx: AssistantContext,
  userId: string,
  question: string,
  reply: string,
  actions: ToolAction[],
): Promise<void> {
  const { data: conversation } = await service
    .from("ai_conversations")
    .upsert(
      { user_id: userId, booking_id: ctx.bookingId, trip_id: ctx.tripId, title: ctx.tripName },
      { onConflict: "user_id,booking_id" },
    )
    .select("id")
    .single();
  if (!conversation) return;

  await service.from("ai_messages").insert([
    { conversation_id: conversation.id, user_id: userId, role: "user", content: question },
    {
      conversation_id: conversation.id,
      user_id: userId,
      role: "assistant",
      content: reply,
      actions: actions as unknown as never,
    },
  ]);
}

async function recordCost(
  service: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  usage: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  },
): Promise<number> {
  await service.rpc("ai_record_cost", {
    p_user_id: userId,
    p_input_tokens: usage.inputTokens,
    p_output_tokens: usage.outputTokens,
    p_cost_micros: costMicros(usage.model, usage),
  });
  const { data } = await service.rpc("ai_messages_left", { p_user_id: userId });
  return typeof data === "number" ? data : 0;
}
