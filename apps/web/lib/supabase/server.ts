import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import type { Database } from "@guideless/types";
import { publicEnv, requireServerEnv } from "@/lib/env";

/**
 * Server Supabase client bound to the current request's auth cookies.
 * Use in Server Components, Server Actions and Route Handlers. Subject to RLS as the
 * signed-in user — this is the default and correct choice for almost everything.
 *
 * A route handler called by the mobile app has no cookies: the app holds a bearer token instead.
 * When one is present it is used, and the client is still the anon key under RLS — a bearer token
 * changes who the caller is, never what they are allowed to do.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const bearer = await bearerToken();

  if (bearer) {
    return createSupabaseClient<Database>(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      },
    );
  }

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
 * The `Authorization: Bearer <supabase access token>` a mobile request carries, if any.
 * Never the service role key: a caller-supplied key is a caller-supplied privilege escalation.
 */
async function bearerToken(): Promise<string | null> {
  try {
    const value = (await headers()).get("authorization");
    if (!value?.toLowerCase().startsWith("bearer ")) return null;
    const token = value.slice(7).trim();
    // A JWT, and not the service role key by mistake or by design.
    if (!token || token.split(".").length !== 3) return null;
    if (token === process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
    return token;
  } catch {
    // No request scope (a build-time render): there is no bearer token to find.
    return null;
  }
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
