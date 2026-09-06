import * as Sentry from "@sentry/nextjs";

/** Next.js instrumentation hook: loads the right Sentry config per runtime (spec §74). */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

export const onRequestError = Sentry.captureRequestError;
