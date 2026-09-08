import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { listStayOptionsToRefresh, refreshRatesForStayOption } from "@/lib/hotels/search";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Nightly hotel-rate refresh (vercel.json crons). Vercel calls with `Authorization: Bearer CRON_SECRET`.
 * Refreshes every active, hotel-linked stay option on departures in the next 400 days.
 */
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
      failures.push({ stayOptionId: id, error: err instanceof Error ? err.message : "failed" });
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
