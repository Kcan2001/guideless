import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { getServerEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Fixed-window rate limit for public forms, counted in the database (`check_rate_limit`, migration
 * 034) so it holds across serverless instances. The key is the form name plus a salted hash of the
 * caller's IP: no IP is stored. Fails open on infrastructure errors (logged) so a limiter outage
 * never blocks a customer; the forms it guards are low-risk inserts, not money.
 */
export async function withinRateLimit(
  form: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "local";
  const ip = forwarded.split(",")[0]?.trim() || "local";
  const salt = getServerEnv().RATE_LIMIT_SALT ?? "guideless-dev-salt";
  const digest = createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
  const key = `${form}:${digest}`;

  const sb = await createClient();
  const { data, error } = await sb.rpc("check_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate limit check failed; allowing", { form, error: error.message });
    return true;
  }
  return data === true;
}

export const RATE_LIMITED_MESSAGE =
  "That's a lot of requests from this connection in a short time. Please wait a little and try again.";
