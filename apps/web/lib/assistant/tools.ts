import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import {
  placeSearchSchema,
  reservationRequestSchema,
  travelerPlanSchema,
} from "@guideless/validation";
import type { AssistantContext } from "@/lib/assistant/context";
import { getPlacesProvider, PlacesError } from "@/lib/places";
import { getReservationProvider, ReservationError } from "@/lib/reservations";
import { createClient } from "@/lib/supabase/server";

/**
 * What the assistant can do, and the wall around it.
 *
 * Every argument here is untrusted input. A tool call is a model's guess at a JSON object, and it
 * is validated with the same Zod schemas a browser form would be — not because the model is
 * adversarial, but because it is fallible in exactly the ways a form is: a time zone it invented, a
 * date that does not exist, a title the length of a novel.
 *
 * The writes run as the signed-in traveler, so row-level security is the real boundary. If the
 * model somehow produced another traveler's booking id, the insert would fail rather than succeed
 * quietly — the policy decides, not this file.
 */

export interface ToolAction {
  tool: string;
  summary: string;
  /** Rendered as a card under the answer, so a traveler sees what happened, not just prose. */
  detail?: Record<string, unknown>;
}

export interface ToolOutcome {
  /** What the model sees. Plain text: it reasons better over sentences than over raw JSON. */
  content: string;
  isError?: boolean;
  action?: ToolAction;
}

export const ASSISTANT_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_places",
    description:
      "Look up real places near a point — cafés, restaurants, bars, sights, shops — with distance " +
      "and, where known, whether they are open right now. This is a LIVE lookup, not our own " +
      "curated recommendation: say so when you use it. Use it when our recommendations do not " +
      "cover what was asked, or when the question depends on opening hours or distance.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: {
          type: "string",
          description: "What to look for, in plain words: 'ice cream', 'dinner near the old town'.",
        },
        latitude: { type: "number", description: "Search around here. Default to where they are." },
        longitude: { type: "number" },
        radius_meters: {
          type: "integer",
          description: "How far to look, 100–20000. Use 1500 for 'near me' on foot.",
        },
        open_now: { type: "boolean", description: "Only places open at the moment." },
        limit: {
          type: "integer",
          description: "How many to return, 1–10. Three is usually plenty.",
        },
      },
      required: ["query", "latitude", "longitude"],
    },
    strict: true,
  },
  {
    name: "add_to_my_day",
    description:
      "Add something to THIS traveler's own plans. Private to them: it never appears on the " +
      "group's itinerary and no one else sees it. It shows up in their app and in their calendar " +
      "feed. Only call this when they have actually said yes to something.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string", description: "Short name, as they would recognise it." },
        notes: { type: "string" },
        plan_date: { type: "string", description: "YYYY-MM-DD. Omit for 'sometime this trip'." },
        start_time: { type: "string", description: "HH:mm, local to the place, 24-hour." },
        end_time: { type: "string", description: "HH:mm, local to the place, 24-hour." },
        location_name: { type: "string" },
        address: { type: "string" },
        latitude: { type: "number" },
        longitude: { type: "number" },
        place_ref: {
          type: "string",
          description: "The ref from search_places, when it came from there.",
        },
        recommendation_id: {
          type: "string",
          description: "The [id] of one of our recommendations, when it came from there.",
        },
      },
      required: ["title"],
    },
    strict: true,
  },
  {
    name: "request_reservation",
    description:
      "Draft a booking request for a place — a table, a time slot — for the traveler to send " +
      "themselves. We do NOT hold the booking and no money changes hands. Tell them that plainly " +
      "and give them the message to send.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        place_ref: { type: "string", description: "The ref from search_places." },
        place_name: { type: "string" },
        party_size: { type: "integer" },
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "HH:mm, 24-hour, local to the place." },
        notes: {
          type: "string",
          description: "Anything they asked for: outside, quiet, allergies.",
        },
      },
      required: ["place_ref", "place_name", "party_size", "date", "time"],
    },
    strict: true,
  },
];

/** Dispatch. Anything unknown is a bug on our side, and says so rather than failing silently. */
export async function runAssistantTool(
  name: string,
  input: unknown,
  ctx: AssistantContext,
): Promise<ToolOutcome> {
  switch (name) {
    case "search_places":
      return searchPlaces(input, ctx);
    case "add_to_my_day":
      return addToMyDay(input, ctx);
    case "request_reservation":
      return requestReservation(input, ctx);
    default:
      return { content: `There is no tool called ${name}.`, isError: true };
  }
}

async function searchPlaces(input: unknown, ctx: AssistantContext): Promise<ToolOutcome> {
  const raw = input as Record<string, unknown>;
  const parsed = placeSearchSchema.safeParse({
    query: raw.query,
    latitude: raw.latitude ?? ctx.anchor?.latitude,
    longitude: raw.longitude ?? ctx.anchor?.longitude,
    radiusMeters: raw.radius_meters ?? 2000,
    openNow: raw.open_now,
    limit: raw.limit ?? 5,
  });
  if (!parsed.success) {
    return {
      content: `That search was not valid: ${parsed.error.issues[0]?.message}`,
      isError: true,
    };
  }

  try {
    const provider = getPlacesProvider();
    const places = await provider.search(parsed.data);
    if (places.length === 0) {
      return {
        content:
          "The live search found nothing matching that nearby. Say so plainly and offer one of our " +
          "own recommendations instead if any fit.",
      };
    }
    const lines = places.map((p) => {
      const bits = [
        p.distanceMeters !== null ? `${p.distanceMeters} m away` : null,
        p.openNow === true ? "open now" : p.openNow === false ? "closed now" : "hours unknown",
        p.rating !== null ? `rated ${p.rating}/5 from ${p.ratingCount ?? 0}` : null,
        p.priceLevel !== null ? "€".repeat(p.priceLevel) : null,
      ].filter(Boolean);
      return `- ${p.name} (ref: ${p.ref})${p.address ? `, ${p.address}` : ""} — ${bits.join(", ")}`;
    });
    return {
      content:
        `Live search results (${provider.id}) — these are not our curated picks, and you must say ` +
        `so when you use them:\n${lines.join("\n")}`,
      action: {
        tool: "search_places",
        summary: `Searched for “${parsed.data.query}” nearby`,
        detail: { source: provider.id, results: places.length },
      },
    };
  } catch (err) {
    // A provider being down is not the traveler's problem to debug: the model is told to fall back
    // to what we curated rather than to apologise about an API.
    const reason = err instanceof PlacesError ? err.code : "unavailable";
    return {
      content:
        `The live place search is unavailable right now (${reason}). Answer from our own ` +
        `recommendations, and say that a live check was not possible.`,
      isError: true,
    };
  }
}

async function addToMyDay(input: unknown, ctx: AssistantContext): Promise<ToolOutcome> {
  const raw = input as Record<string, unknown>;
  const parsed = travelerPlanSchema.safeParse({
    title: raw.title,
    notes: raw.notes,
    planDate: raw.plan_date,
    startTime: normalizeTime(raw.start_time),
    endTime: normalizeTime(raw.end_time),
    // Never the model's idea of a zone: the trip's own, which is the only one that is true.
    timezone: ctx.timezone,
    locationName: raw.location_name,
    address: raw.address,
    latitude: raw.latitude,
    longitude: raw.longitude,
    placeRef: raw.place_ref,
    recommendationId: raw.recommendation_id,
  });
  if (!parsed.success) {
    return {
      content: `That could not be added: ${parsed.error.issues[0]?.message}. Ask for what is missing.`,
      isError: true,
    };
  }
  const plan = parsed.data;

  // A date outside the trip is almost always the model mis-reading "tomorrow"; refuse it rather
  // than quietly filing a plan in the wrong week.
  if (plan.planDate && (plan.planDate < ctx.startDate || plan.planDate > ctx.endDate)) {
    return {
      content: `${plan.planDate} is outside this trip (${ctx.startDate} to ${ctx.endDate}). Check the date with them.`,
      isError: true,
    };
  }

  const sb = await createClient();
  const { data, error } = await sb
    .from("traveler_plans")
    .insert({
      user_id: (await sb.auth.getUser()).data.user?.id ?? "",
      trip_id: ctx.tripId,
      booking_id: ctx.bookingId,
      title: plan.title,
      notes: plan.notes ?? null,
      plan_date: plan.planDate ?? null,
      start_time: plan.startTime ?? null,
      end_time: plan.endTime ?? null,
      timezone: plan.timezone,
      location_name: plan.locationName ?? null,
      address: plan.address ?? null,
      latitude: plan.latitude ?? null,
      longitude: plan.longitude ?? null,
      maps_url: plan.mapsUrl ?? null,
      source: "assistant",
      place_ref: plan.placeRef ?? null,
      recommendation_id: plan.recommendationId ?? null,
    })
    .select("id, title, plan_date, start_time")
    .single();

  if (error) {
    return {
      content: "That could not be saved. Tell them, and do not claim it was.",
      isError: true,
    };
  }

  // A plan is a strong taste signal — stronger than opening a listing — so it is recorded as one.
  await recordSignal(ctx, "plan_added", plan.recommendationId);

  const when = data.plan_date
    ? `${data.plan_date}${data.start_time ? ` at ${data.start_time.slice(0, 5)}` : ""}`
    : "no date yet";
  return {
    content: `Added "${data.title}" to their own plans (${when}). It is private to them.`,
    action: {
      tool: "add_to_my_day",
      summary: `Added “${data.title}” to your plans`,
      detail: { id: data.id, date: data.plan_date, time: data.start_time },
    },
  };
}

async function requestReservation(input: unknown, ctx: AssistantContext): Promise<ToolOutcome> {
  const raw = input as Record<string, unknown>;
  const parsed = reservationRequestSchema.safeParse({
    placeRef: raw.place_ref,
    placeName: raw.place_name,
    partySize: raw.party_size,
    date: raw.date,
    time: normalizeTime(raw.time),
    timezone: ctx.timezone,
    notes: raw.notes,
  });
  if (!parsed.success) {
    return {
      content: `That reservation request was not valid: ${parsed.error.issues[0]?.message}`,
      isError: true,
    };
  }

  try {
    const provider = getReservationProvider();
    const quote = await provider.quote(parsed.data);
    if (!quote) {
      return {
        content: "That place cannot be booked through us. Suggest they contact it directly.",
      };
    }
    // The one invariant the assistant may never cross. A provider that starts returning a price is
    // a decision nobody has taken, and it stops here rather than at a traveler's card.
    if (quote.price !== 0) {
      return {
        content:
          "That booking would cost money, and the assistant cannot spend money. Do not proceed.",
        isError: true,
      };
    }
    const outcome = await provider.confirm(quote.holdRef, parsed.data);
    if (outcome.status === "draft") {
      return {
        content:
          `We do not hold this booking. Give them this message to send themselves, and say plainly ` +
          `that it is not booked until the place replies:\n\n${outcome.message}`,
        action: {
          tool: "request_reservation",
          summary: `Drafted a request to ${parsed.data.placeName}`,
          detail: { message: outcome.message, place: parsed.data.placeName },
        },
      };
    }
    if (outcome.status === "confirmed") {
      return {
        content: `Booked. Reference ${outcome.reference}. ${outcome.instructions ?? ""}`.trim(),
        action: { tool: "request_reservation", summary: `Booked ${parsed.data.placeName}` },
      };
    }
    return { content: `That is not available: ${outcome.reason}` };
  } catch (err) {
    const reason = err instanceof ReservationError ? err.message : "it did not work";
    return { content: `The reservation could not be made — ${reason}.`, isError: true };
  }
}

/** "8:30" and "08:30" both arrive from a model; only one of them is a valid `time`. */
function normalizeTime(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const m = /^(\d{1,2}):(\d{2})/.exec(v.trim());
  if (!m) return undefined;
  return `${m[1]!.padStart(2, "0")}:${m[2]}`;
}

async function recordSignal(
  ctx: AssistantContext,
  kind: "plan_added",
  recommendationId?: string,
): Promise<void> {
  try {
    const sb = await createClient();
    const categories = recommendationId
      ? (ctx.recommendations.find((r) => r.id === recommendationId)?.categories ?? [])
      : [];
    await sb.from("traveler_signals").insert({
      user_id: (await sb.auth.getUser()).data.user?.id ?? "",
      kind,
      categories,
      ref_id: recommendationId ?? null,
    });
  } catch {
    // Taste is a nice-to-have. Losing one signal must never cost a traveler their answer.
  }
}
