import { NextResponse } from "next/server";
import { assistantMessageSchema } from "@guideless/validation";
import { assistantIsConfigured, sendAssistantMessage } from "@/lib/assistant/chat";

export const runtime = "nodejs";
/** A turn with several tool rounds can take a while; the default 15s would cut it off. */
export const maxDuration = 60;

/**
 * One turn of the trip assistant, for both the web page and the app.
 *
 * There is no separate mobile endpoint: the app sends its Supabase access token as a bearer and
 * the same row-level security applies. The reason this is a route rather than a Supabase Edge
 * Function is the places and reservation adapters — they are TypeScript service modules the rest
 * of the web app already uses, and a second Deno copy of them would be two implementations of one
 * contract, which is how they drift.
 *
 * Every failure mode here answers with a sentence rather than a status code alone, because both
 * callers render it straight to a person.
 */
export async function POST(req: Request): Promise<Response> {
  if (!assistantIsConfigured()) {
    return NextResponse.json(
      { error: "The trip assistant is not switched on yet.", reason: "unconfigured" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send JSON.", reason: "bad_request" }, { status: 400 });
  }

  const parsed = assistantMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "That request was not valid.",
        reason: "bad_request",
      },
      { status: 400 },
    );
  }

  const result = await sendAssistantMessage(parsed.data.bookingId, parsed.data.message);
  if (!result.ok) {
    const status =
      result.reason === "quota"
        ? 429
        : result.reason === "not_eligible"
          ? 403
          : result.reason === "unconfigured"
            ? 503
            : 502;
    return NextResponse.json({ error: result.message, reason: result.reason }, { status });
  }

  return NextResponse.json({
    reply: result.reply,
    actions: result.actions,
    messagesLeft: result.messagesLeft,
  });
}
