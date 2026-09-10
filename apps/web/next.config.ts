import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const supabaseWs = supabaseUrl.replace(/^http/, "ws");

/**
 * Content Security Policy (docs/security.md). Next.js inlines small runtime scripts without nonces
 * on statically generated pages, so script-src keeps 'unsafe-inline'; everything else is locked
 * down. Upgrading to nonce-based 'strict-dynamic' is the next hardening step once marketing pages
 * can afford to render dynamically.
 */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://checkout.stripe.com",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://*.posthog.com https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: http://127.0.0.1:54321",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseUrl} ${supabaseWs} https://*.supabase.co wss://*.supabase.co https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://*.posthog.com https://api.stripe.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io`,
  "frame-src https://js.stripe.com https://checkout.stripe.com",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; let Next compile them.
  transpilePackages: [
    "@guideless/config",
    "@guideless/types",
    "@guideless/utils",
    "@guideless/validation",
  ],
  typedRoutes: true,
  images: {
    // Next 16 will only serve a quality it has been told about. `PhotoHero` asks for 78 and the
    // rest of the site takes the 75 default, so without this the hero photo on every marketing
    // page — the largest image we serve — silently falls back instead of being optimised.
    qualities: [70, 75, 78],
    remotePatterns: [
      // Supabase Storage (public buckets and signed URLs).
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "54321", pathname: "/storage/v1/object/**" },
      // Hotel photography, hosted by the supplier rather than copied into the repo: these are the
      // property's own current images and they change when the property changes them.
      { protocol: "https", hostname: "static.cupid.travel", pathname: "/hotels/**" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              process.env.NODE_ENV === "development"
                ? csp.replace("upgrade-insecure-requests", "")
                : csp,
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), payment=(self)",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Source maps upload only when SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT are set (CI/Vercel).
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: { treeshake: { removeDebugLogging: true }, automaticVercelMonitors: false },
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  telemetry: false,
});
