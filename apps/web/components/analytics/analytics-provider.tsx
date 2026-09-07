"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { applyGtagConsent, readConsent, type ConsentState } from "@/lib/analytics";

/**
 * Client-side glue for analytics:
 *  1. Replays the stored consent choice into GA4 (Consent Mode) on load.
 *  2. Boots PostHog only after consent is granted; opts it out again if consent is withdrawn.
 *  3. Sends a `$pageview` to PostHog on client-side route changes (GA4 handles its own).
 *
 * Renders nothing. Mount once in the root layout.
 */
export function AnalyticsProvider() {
  const pathname = usePathname();
  const search = useSearchParams();
  const booted = useRef(false);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

    async function apply(state: ConsentState) {
      if (state === "unknown") return;
      applyGtagConsent(state);
      if (!key) return;
      const { default: posthog } = await import("posthog-js");
      if (state === "granted") {
        if (!booted.current) {
          posthog.init(key, {
            api_host: host,
            capture_pageview: false, // sent manually below so it works with the App Router
            capture_pageleave: true,
            persistence: "localStorage+cookie",
            autocapture: false, // explicit events only (spec §47); keeps payloads free of PII
            mask_all_text: true,
            respect_dnt: true,
          });
          booted.current = true;
        } else {
          posthog.opt_in_capturing();
        }
        window.posthog = posthog;
        posthog.capture("$pageview");
      } else if (booted.current) {
        posthog.opt_out_capturing();
        window.posthog = undefined;
      }
    }

    void apply(readConsent());
    const onConsent = (e: Event) => void apply((e as CustomEvent<ConsentState>).detail);
    window.addEventListener("guideless:consent", onConsent);
    return () => window.removeEventListener("guideless:consent", onConsent);
  }, []);

  // Route change → PostHog pageview (only when booted, i.e. consented).
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    const url = pathname + (search?.toString() ? `?${search}` : "");
    if (lastPath.current === null) {
      lastPath.current = url; // first render is captured by apply()
      return;
    }
    if (lastPath.current !== url) {
      lastPath.current = url;
      window.posthog?.capture("$pageview");
    }
  }, [pathname, search]);

  return null;
}
