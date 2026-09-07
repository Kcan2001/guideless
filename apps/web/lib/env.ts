import { z } from "zod";

// First Zod consumer on both runtimes: disable the eval-based JIT before any schema parses so the
// web CSP (no 'unsafe-eval') never sees a probe. Mirrors packages/validation/src/index.ts.
z.config({ jitless: true });

/**
 * Validated environment access.
 *
 * `publicEnv` is safe in the browser (NEXT_PUBLIC_*). `serverEnv` must only be imported from
 * server code (Server Components, Server Actions, Route Handlers) — it contains secrets.
 * Import `server-only` at the top of any module that reads `serverEnv`.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_MAPS_KEY: z.string().optional(),
  NEXT_PUBLIC_GA_ID: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
});

// NEXT_PUBLIC_* values are inlined at build time only when referenced literally.
export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_GOOGLE_MAPS_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY,
  NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().optional(),
  /** Resend audience that mirrors newsletter_subscribers for Broadcasts (lib/marketing/newsletter.ts). */
  RESEND_AUDIENCE_ID: z.string().min(1).optional(),
  /** Salts the hashed caller id used by public-form rate limits (lib/rate-limit.ts). */
  RATE_LIMIT_SALT: z.string().min(8).optional(),
});

let cachedServerEnv: z.infer<typeof serverSchema> | undefined;

/** Lazily parsed so importing this module from client-safe code never touches secrets. */
export function getServerEnv(): z.infer<typeof serverSchema> {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv() must never be called in the browser");
  }
  cachedServerEnv ??= serverSchema.parse(process.env);
  return cachedServerEnv;
}

/** Throw a clear error when a required secret is missing for a privileged operation. */
export function requireServerEnv<K extends keyof z.infer<typeof serverSchema>>(key: K): string {
  const value = getServerEnv()[key];
  if (!value) throw new Error(`Missing required server environment variable: ${key}`);
  return value;
}
