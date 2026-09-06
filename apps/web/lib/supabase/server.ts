import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@guideless/types";
import { publicEnv, requireServerEnv } from "@/lib/env";

/**
 * Server Supabase client bound to the current request's auth cookies.
 * Use in Server Components, Server Actions and Route Handlers. Subject to RLS as the
 * signed-in user — this is the default and correct choice for almost everything.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component: cookies are read-only there. The proxy
            // (proxy.ts) refreshes sessions, so this is safe to ignore.
          }
        },
      },
    },
  );
}

/**
 * Privileged client using the service role key. BYPASSES RLS.
 *
 * Only for trusted server workflows: Stripe webhooks, refunds, notification fan-out,
 * admin bulk operations. Never import from a client component. Never use for a request
 * where the signed-in user's own permissions should apply — use createClient() instead.
 */
export function createServiceRoleClient() {
  return createSupabaseClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
