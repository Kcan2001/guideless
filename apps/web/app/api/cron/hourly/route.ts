import { NextResponse } from "next/server";
import { postFreeActivities } from "@/lib/assistant/group-post";
import { getServerEnv } from "@/lib/env";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * The hourly run. Two jobs that both need to happen every hour, in one cron slot.
 *
 * 1. **The morning group post.** Every trip whose local morning it is gets the day's free
 *    activities, once. Hourly rather than daily because trips are in different time zones and a
 *    single daily run would land at 3am for somebody; the unique key on (trip_id, post_date) makes
 *    a second run in the same window a no-op.
 *
 * 2. **Purging stale shared locations.** Row-level security already hides a lapsed or stale
 *    position, so this is not a security control — it is us not keeping a position after telling
 *    somebody we had stopped using it. That distinction is the reason it runs at all.
 *
 * Neither job may fail the other: a purge that throws must not cost a group its morning post.
 */
export async function GET(req: Request): Promise<Response> {
  const secret = getServerEnv().CRON_SECRET;
  if (!secret)
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const started = Date.now();

  const [groupPost, locationsPurged] = await Promise.allSettled([
    postFreeActivities(),
    purgeStaleLocations(),
  ]);

  return NextResponse.json({
    groupPost:
      groupPost.status === "fulfilled" ? groupPost.value : { error: String(groupPost.reason) },
    locationsPurged:
      locationsPurged.status === "fulfilled"
        ? locationsPurged.value
        : `failed: ${String(locationsPurged.reason)}`,
    ms: Date.now() - started,
  });
}

async function purgeStaleLocations(): Promise<number> {
  const { data, error } = await createServiceRoleClient().rpc("purge_stale_trip_locations");
  if (error) throw error;
  return typeof data === "number" ? data : 0;
}
