"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { readConsent, writeConsent, type ConsentState } from "@/lib/analytics";

const ANALYTICS_CONFIGURED = !!(
  process.env.NEXT_PUBLIC_GA_ID || process.env.NEXT_PUBLIC_POSTHOG_KEY
);

function subscribe(onChange: () => void) {
  window.addEventListener("guideless:consent", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("guideless:consent", onChange);
    window.removeEventListener("storage", onChange);
  };
}
const getSnapshot = (): ConsentState | "server" => readConsent();
const getServerSnapshot = (): ConsentState | "server" => "server";

/**
 * Minimal, calm cookie consent (GDPR / ePrivacy — we sell to EU travelers and run EU trips).
 * Only appears when no choice is stored and at least one analytics tool is configured.
 * Essential cookies (auth, checkout) need no consent and are not gated here.
 */
export function ConsentBanner() {
  const consent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!ANALYTICS_CONFIGURED || consent !== "unknown") return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie preferences"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl rounded-2xl border border-border bg-surface p-5 shadow-lg sm:flex sm:items-center sm:gap-6"
    >
      <p className="text-sm text-muted-foreground sm:flex-1">
        We use analytics cookies to understand which trips people look at and to improve the site.
        No ads, no selling data. Essential cookies for sign-in and checkout are always on.{" "}
        <a href="/privacy" className="text-link">
          Privacy policy
        </a>
      </p>
      <div className="mt-4 flex gap-2 sm:mt-0">
        <Button size="sm" variant="secondary" onClick={() => writeConsent("denied")}>
          Essential only
        </Button>
        <Button size="sm" onClick={() => writeConsent("granted")}>
          Accept analytics
        </Button>
      </div>
    </div>
  );
}
