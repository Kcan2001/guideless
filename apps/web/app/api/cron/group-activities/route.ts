import { NextResponse } from "next/server";
import { postFreeActivities } from "@/lib/assistant/group-post";
import { getServerEnv } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * The morning "here's what's free today" post, for every trip whose local morning it is.
 *
 * Runs hourly (vercel.json crons) rather than once a day, because trips are in different time
 * zones and a single daily run would land at 3am for somebody. Each trip is posted to once, inside
 * its own morning window, and the unique key on (trip_id, post_date) makes a retry a no-op.
 */
export async function GET(req: Request): Promise<Response> {
  const secret = getServerEnv().CRON_SECRET;
  if (!secret)
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const started = Date.now();
  const result = await postFreeActivities();
  return NextResponse.json({ ...result, ms: Date.now() - started });
}
