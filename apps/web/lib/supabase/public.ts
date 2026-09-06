import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@guideless/types";
import { publicEnv } from "@/lib/env";

let client: ReturnType<typeof createClient<Database>> | undefined;

/**
 * Anonymous, cookie-less Supabase client for PUBLIC marketing pages.
 *
 * Because it never touches request cookies, pages that use it can be statically generated and
 * revalidated (ISR). RLS applies as the `anon` role, so only published/public rows are visible.
 * For anything user-specific use `createClient()` from ./server.ts instead.
 */
export function createPublicClient() {
  client ??= createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  return client;
}
