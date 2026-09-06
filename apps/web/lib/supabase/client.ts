"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@guideless/types";
import { publicEnv } from "@/lib/env";

/**
 * Browser Supabase client. Uses the anon key; every query is subject to RLS.
 * Prefer Server Components / Server Actions for data access; use this for realtime
 * subscriptions and client-side auth flows.
 */
export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
