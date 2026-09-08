import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry-scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  sendDefaultPii: false,
  beforeSend: scrubEvent,
  ignoreErrors: ["ResizeObserver loop", "AbortError", /Loading chunk \d+ failed/],
  // Browser extensions run in the page and their unhandled rejections reach our global handler.
  // Their scripts are not served from this origin, so drop anything whose frames come from a
  // path we never ship (e.g. app:///executors/200.js, seen on /tours/:slug 2026-09-08).
  denyUrls: [
    /^chrome(?:-extension)?:\/\//,
    /^moz-extension:\/\//,
    /^safari-(?:web-)?extension:\/\//,
    /\/executors\//,
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
