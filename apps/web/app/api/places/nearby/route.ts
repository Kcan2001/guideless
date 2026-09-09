import { NextResponse } from "next/server";
import { z } from "zod";
import { nearbyPlaces } from "@/lib/places/nearby";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * "What's good near me, right now." Called by the app with the traveler's position.
 *
 * The position is a request parameter and is never written down. This endpoint reads a traveler's
 * taste and our recommendations, ranks, and answers — nothing about where they were standing
 * survives the response. Group location sharing is a separate, opt-in thing with its own table.
 *
 * Signed in only, because it reads `traveler_taste()`. An anonymous caller would get an unranked
 * list, which is not a feature worth opening a billable place lookup for.
 */

const query = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(100).max(20000).optional(),
  q: z.string().trim().max(120).optional(),
  openNow: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export async function GET(req: Request): Promise<Response> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = query.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "That request was not valid." },
      { status: 400 },
    );
  }

  const result = await nearbyPlaces({
    latitude: parsed.data.lat,
    longitude: parsed.data.lng,
    radiusMeters: parsed.data.radius,
    query: parsed.data.q,
    openNow: parsed.data.openNow,
  });

  return NextResponse.json(result, {
    // A position-specific answer is not something to cache anywhere between us and the phone.
    headers: { "cache-control": "no-store" },
  });
}
