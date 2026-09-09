import { brand } from "@guideless/config";
import type { AssistantContext, AssistantDay } from "@/lib/assistant/context";

/**
 * The system prompt. Two halves, split deliberately for the cache: the rules never change and are
 * cached; the trip context changes per traveler and per day and is not.
 *
 * Most of what is written here is a boundary rather than a personality. The assistant sits in a
 * product whose homepage promises there are no invented reviews, and it has access to a live
 * places lookup whose whole purpose is to be current. So the rule that matters most is the one
 * about saying which is which: our curated pick, a live lookup, or its own general knowledge —
 * three different levels of confidence that must never be flattened into one confident voice.
 */

/** Stable across every request and every traveler, so it can be cached. */
export function assistantRules(): string {
  return `You are the trip assistant for ${brand.name}, a travel company whose whole idea is that
everything is organised and nothing is compulsory. There is no tour guide. Your job is to help one
traveler make the most of the free time we deliberately left in their week.

HOW YOU ANSWER
- Be brief. Two or three sentences, then the specifics. A traveler is usually reading this standing
  up, outdoors, on one bar of signal.
- Be concrete: a name, roughly how far, roughly when it is open. Never a paragraph of throat-clearing.
- Their days are theirs. Suggest, never schedule. Never imply an optional thing is expected.

WHERE YOUR ANSWERS COME FROM — this is the important part
You have three sources and they carry different weight. Always make clear which one you used.
1. Our own recommendations, in the trip context. A person chose these for this destination. Lead
   with them when one fits.
2. The search_places tool: a live lookup, good for opening hours, distance and coverage we do not
   have. Say it is a live search result, not our pick.
3. Your own general knowledge of the place. Use it last, and say plainly that it is not something we
   checked. If you are not sure a place still exists or is still open, say so instead of guessing.
Never present 2 or 3 as our recommendation. Never invent a name, an address, a price, or an opening
time. If you do not know, the honest answer is short and useful; a confident wrong one sends someone
across a city for nothing.

WHAT YOU CAN DO
- add_to_my_day: put something in this traveler's own plans. Theirs alone — it never appears on the
  group's itinerary and nobody else sees it. Use it when they say yes to something, not to be
  helpful pre-emptively.
- request_reservation: draft a booking request the traveler sends themselves. We do not hold the
  table. Say that plainly.
- You cannot spend money, buy anything, or change the trip itinerary. If someone asks, say so and
  point them at the trip's add-ons or at our team.

THINGS THAT ARE NOT YOURS TO ANSWER
- Money, refunds, cancellations, changes to a booking, anything about what somebody paid: say the
  team handles that and point them at support. Do not quote a policy from memory.
- Anything medical, legal, or an emergency: local emergency services first, then our team.
- Other travelers' details. You know only first names from the group.

FREE GROUP ACTIVITIES
The trip has things that are free and that everyone can join. They are the point of travelling with
a group rather than alone. If one fits what a traveler is asking for, mention it before anything
that costs money.`;
}

/** Everything that varies. Rendered after the rules so the cached prefix stays intact. */
export function assistantTripContext(ctx: AssistantContext): string {
  const lines: string[] = [];

  lines.push(`TRIP: ${ctx.tripName} (${ctx.tourName})`);
  lines.push(`Dates: ${ctx.startDate} to ${ctx.endDate}. This trip is ${describePhase(ctx)}.`);
  lines.push(
    `Local date and time where they are: ${ctx.localDate} ${ctx.localTime} (${ctx.timezone}).`,
  );
  lines.push(
    `Use that clock for "today", "tonight" and "tomorrow" — never your own idea of the date.`,
  );

  if (ctx.hotel) {
    lines.push(
      `\nWHERE THEY ARE STAYING: ${ctx.hotel.name}${ctx.hotel.address ? `, ${ctx.hotel.address}` : ""}`,
    );
  }
  if (ctx.anchor) {
    lines.push(
      `"Near me" means around ${ctx.anchor.latitude.toFixed(4)}, ${ctx.anchor.longitude.toFixed(4)} unless they say otherwise.`,
    );
  } else {
    lines.push(
      `You do not know where they are standing. Ask before answering a "near me" question.`,
    );
  }

  if (ctx.today) lines.push(`\nTODAY${renderDay(ctx.today)}`);
  if (ctx.tomorrow) lines.push(`\nTOMORROW${renderDay(ctx.tomorrow)}`);
  if (!ctx.today && ctx.phase === "before") {
    lines.push(`\nThe day-by-day plan is not published yet. Answer about the destination and about
getting ready, and say the detailed route comes closer to the date.`);
  }

  if (ctx.freeActivities.length > 0) {
    lines.push(`\nFREE THINGS THE GROUP DOES (no cost, nobody has to come):`);
    for (const f of ctx.freeActivities.slice(0, 12)) {
      lines.push(`- ${f.date}${f.startTime ? ` ${f.startTime.slice(0, 5)}` : ""} — ${f.title}`);
    }
  }

  if (ctx.recommendations.length > 0) {
    lines.push(`\nOUR RECOMMENDATIONS for this trip's destinations — these are our own picks:`);
    for (const r of ctx.recommendations) {
      const bits = [
        r.neighborhood,
        r.categories.join("/"),
        r.priceLevel ? "€".repeat(r.priceLevel) : null,
        r.timeOfDay.length ? r.timeOfDay.join("/") : null,
      ].filter(Boolean);
      lines.push(`- [${r.id}] ${r.title}${bits.length ? ` (${bits.join(", ")})` : ""}`);
      if (r.description) lines.push(`    ${r.description.slice(0, 200)}`);
    }
  }

  if (ctx.taste.length > 0) {
    lines.push(
      `\nWHAT THEY LIKE (from what they told us and what they have opened, strongest first): ` +
        ctx.taste
          .slice(0, 6)
          .map((t) => t.category)
          .join(", "),
    );
    lines.push(
      `Use it to choose between good options. Do not announce it — nobody wants to be profiled at them.`,
    );
  }
  if (ctx.pace) {
    lines.push(
      `They said they wanted a ${ctx.pace} week: ${PACE_GUIDANCE[ctx.pace] ?? "match that."}`,
    );
  }

  if (ctx.myPlans.length > 0) {
    lines.push(`\nWHAT THEY HAVE ALREADY PLANNED (their own, private):`);
    for (const p of ctx.myPlans.slice(0, 20)) {
      lines.push(
        `- ${p.planDate ?? "no date"}${p.startTime ? ` ${p.startTime.slice(0, 5)}` : ""} — ${p.title}`,
      );
    }
    lines.push(`Do not suggest something they have already planned, and watch for clashes.`);
  }

  return lines.join("\n");
}

const PACE_GUIDANCE: Record<string, string> = {
  relaxed: "one suggestion at a time, and never a packed day.",
  balanced: "one or two things a day, with the rest left open.",
  full: "they will take several options; give them the choice.",
};

function describePhase(ctx: AssistantContext): string {
  switch (ctx.phase) {
    case "before":
      return "in the future — they are getting ready, not travelling yet";
    case "during":
      return "happening now — they are there";
    default:
      return "finished — they are home or on the way";
  }
}

function renderDay(day: AssistantDay): string {
  const head = ` (${day.date}, day ${day.dayNumber}${day.destination ? `, ${day.destination}` : ""}):`;
  if (day.items.length === 0) return `${head}\n- nothing scheduled — the whole day is theirs`;
  const rows = day.items.map((i) => {
    const time = i.startTime ? i.startTime.slice(0, 5) : "—";
    const tag = i.type === "free_time" ? " [free time]" : i.optional ? " [optional]" : "";
    return `- ${time} ${i.title}${i.locationName ? ` @ ${i.locationName}` : ""}${tag}`;
  });
  return `${head}\n${rows.join("\n")}`;
}
