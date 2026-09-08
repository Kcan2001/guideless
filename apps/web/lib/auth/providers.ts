import "server-only";

import { publicEnv } from "@/lib/env";

/**
 * Which third-party sign-in providers the Supabase project actually has switched on.
 *
 * The site used to show a "Continue with Google" button unconditionally, so anyone who pressed it
 * on a project without the provider configured got a raw Supabase error page. Asking the project
 * is better than a build-time flag: enabling Google in the dashboard is enough to make the button
 * appear, and disabling it makes the button go away, with no deploy either way.
 */
export interface AuthProviders {
  google: boolean;
}

const FALLBACK: AuthProviders = { google: false };

/** Cached for an hour: this changes when someone edits the project, not per request. */
export async function enabledAuthProviders(): Promise<AuthProviders> {
  try {
    const res = await fetch(`${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return FALLBACK;
    const body: unknown = await res.json();
    const external = (body as { external?: Record<string, unknown> })?.external ?? {};
    return { google: external.google === true };
  } catch {
    // A sign-in page that loads without the extra button beats one that fails to render.
    return FALLBACK;
  }
}
