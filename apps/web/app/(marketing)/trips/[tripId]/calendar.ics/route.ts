import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { getMyTrip } from "@/lib/data/trips";
import { buildCalendar, type CalendarEvent } from "@/lib/trips/ics";

/**
 * A traveler's own trip as an .ics file, for Google Calendar, Apple Calendar or anything else.
 *
 * Signed in only, and it reads through `getMyTrip`, so row-level security decides what comes back:
 * a trip id in the URL is not a capability. Nothing here is cached, because a calendar that keeps
 * serving last week's itinerary after staff move a train is worse than no calendar.
 *
 * This is a download rather than a subscribable feed. A feed would need a long-lived unguessable
 * token, which is a credential in a URL that lands in a calendar app and is then out of our hands.
 * If subscription is wanted later it deserves its own revocable token, not this route with the
 * auth taken off.
 */
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ tripId: string }> },
): Promise<NextResponse> {
  const { tripId } = await ctx.params;
  if (!UUID.test(tripId)) return new NextResponse("Not found", { status: 404 });

  const detail = await getMyTrip(tripId);
  // Not a member, not signed in, or no such trip: all the same answer, so the response cannot be
  // used to discover which trip ids exist.
  if (!detail) return new NextResponse("Not found", { status: 404 });

  const site = publicEnv.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  const tripUrl = site ? `${site}/trips/${tripId}` : null;
  const zone = detail.trip.timezone ?? "UTC";
  const events: CalendarEvent[] = [];

  for (const day of detail.days) {
    for (const item of day.items) {
      events.push({
        // Stable per item, so re-importing updates the entry instead of adding a second one.
        uid: `${item.id}@guidelesstravel.com`,
        title: item.title,
        description: [item.description, item.instructions].filter(Boolean).join("\n\n") || null,
        location: item.location_name ?? day.destination?.name ?? null,
        date: day.date,
        startTime: item.start_time ? item.start_time.slice(0, 5) : null,
        endTime: item.end_time ? item.end_time.slice(0, 5) : null,
        timezone: item.timezone ?? zone,
        url: tripUrl,
      });
    }
  }

  // Group moments are optional and often the reason people came, so they belong in the calendar
  // beside the trains rather than only in the app.
  for (const moment of detail.moments) {
    if (!moment.start_at) continue;
    const starts = new Date(moment.start_at);
    events.push({
      uid: `moment-${moment.id}@guidelesstravel.com`,
      title: moment.title,
      description: moment.description ?? null,
      location: moment.location_name ?? null,
      date: starts.toISOString().slice(0, 10),
      startTime: starts.toISOString().slice(11, 16),
      endTime: moment.end_at ? new Date(moment.end_at).toISOString().slice(11, 16) : null,
      // Live Moments are stored as instants, so they are already correct in UTC.
      timezone: "UTC",
      url: tripUrl,
    });
  }

  const name = detail.trip.name ?? "Your Guideless trip";
  const ics = buildCalendar(events, {
    name,
    description: "Your Guideless itinerary. Times are shown in the local zone of each stop.",
  });

  return new NextResponse(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="guideless-trip.ics"`,
      "cache-control": "no-store",
    },
  });
}
