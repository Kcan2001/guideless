import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { listStayOptionsToRefresh, refreshRatesForStayOption } from "@/lib/hotels/search";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Weekly hotel-rate refresh (vercel.json crons). Vercel calls with `Authorization: Bearer CRON_SECRET`.
 * Refreshes every active, hotel-linked stay option on departures in the next 400 days.
 *
 * WHY WEEKLY, AND NOT MORE OFTEN
 * This job exists to stop the figure on a tour page going stale-stale, and that page says "as of"
 * with the date, so a week-old estimate is an honest estimate. It is NOT what a traveler decides
 * on: opening the Trip Builder re-derives every tier from a fresh rate, and checkout re-checks once
 * more before charging. Running this four times a day bought nothing a traveler ever saw and spent
 * supplier calls we will want later — at twenty trips it was heading for about 1,900 requests a
 * day, and LiteAPI throttles well below that.
 */
/** Anything can be thrown. Say what it was rather than reducing it to "failed". */
function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const e = err as { message?: string; code?: string; details?: string; hint?: string };
    const parts = [e.code, e.message, e.details, e.hint].filter(Boolean);
    if (parts.length) return parts.join(" · ");
    try {
      return JSON.stringify(err).slice(0, 300);
    } catch {
      return "unserialisable error";
    }
  }
  return String(err);
}

export async function GET(req: Request) {
  const secret = getServerEnv().CRON_SECRET;
  if (!secret)
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const started = Date.now();
  const ids = await listStayOptionsToRefresh(400);
  let stored = 0;
  let skipped = 0;
  let noRates = 0;
  const failures: Array<{ stayOptionId: string; error: string }> = [];
  for (const id of ids) {
    try {
      const r = await refreshRatesForStayOption(id);
      stored += r.stored;
      if (r.skipped === "no_rates") noRates += 1;
      else if (r.skipped) skipped += 1;
      for (const s of r.suppliers)
        if (!s.ok) failures.push({ stayOptionId: id, error: s.error ?? "failed" });
    } catch (err) {
      // Supabase throws PostgrestError, which is a plain object rather than an Error, so the old
      // `instanceof Error ? … : "failed"` reported every database rejection as the word "failed"
      // and threw the reason away. A constraint violation is the most useful thing this endpoint
      // can tell us; do not let it be swallowed again.
      failures.push({ stayOptionId: id, error: describeError(err) });
    }
  }
  return NextResponse.json({
    stayOptions: ids.length,
    stored,
    skipped,
    // Answered but empty: the mapping or the dates are wrong, not a supplier outage.
    noRates,
    failures,
    ms: Date.now() - started,
  });
}
