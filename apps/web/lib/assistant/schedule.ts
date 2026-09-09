/**
 * The pure half of the morning group post: what time it is somewhere, and what to say.
 *
 * Separate from `group-post.ts` because that module is `server-only` (it holds the service-role
 * client) and this is arithmetic on a time zone plus some sentences — the two things most worth
 * testing and the two things that need no database at all.
 */

/** Local hours during which a trip's post may go out. Early enough to act on, not a 4am buzz. */
export const POST_FROM_HOUR = 7;
export const POST_UNTIL_HOUR = 10;

export interface FreeActivity {
  item_id: string;
  title: string;
  start_time: string | null;
  location_name: string | null;
  instructions: string | null;
}

/** Wall-clock date and time in a given IANA zone. */
export function localClock(zone: string, at = new Date()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  // en-CA renders midnight as 24 in some runtimes; the date has already rolled over, so 24 is 00.
  const hour = get("hour") === "24" ? "00" : get("hour");
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${hour}:${get("minute")}`,
  };
}

/** Whether it is this trip's morning right now — the reason the cron can fire hourly. */
export function isPostingHour(zone: string, at = new Date()): boolean {
  const hour = Number(localClock(zone, at).time.slice(0, 2));
  return hour >= POST_FROM_HOUR && hour < POST_UNTIL_HOUR;
}

/**
 * What the group reads. Written rather than generated: a language model is not needed to list
 * three itinerary rows, and using one would add cost, latency and a way for the most-read message
 * on the trip to come out wrong.
 */
export function composePost(activities: FreeActivity[]): string {
  const lines: string[] = [];
  lines.push(
    activities.length === 1
      ? "Free today, if you fancy it — no cost, nobody has to come:"
      : "Free today, if you fancy any of them — no cost, nobody has to come:",
  );
  for (const a of activities) {
    const when = a.start_time ? a.start_time.slice(0, 5) : "any time";
    const where = a.location_name ? ` — meet at ${a.location_name}` : "";
    lines.push(`\n${when} · ${a.title}${where}`);
    if (a.instructions) lines.push(a.instructions.trim());
  }
  lines.push("\nTurn up or don't. Your day is yours.");
  return lines.join("\n");
}
