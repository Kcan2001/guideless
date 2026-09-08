"use client";

import { useSyncExternalStore } from "react";
import { clearConsent, readConsent, type ConsentState } from "@/lib/analytics";

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
const getSnapshot = (): ConsentState => readConsent();
const getServerSnapshot = (): ConsentState => "unknown";

/**
 * The footer's "Cookie settings" control. The Privacy Policy tells visitors they can change or
 * withdraw analytics consent from the footer, and under GDPR withdrawing has to be as easy as
 * granting, so this clears the stored choice: analytics stops immediately and the banner returns.
 *
 * Hidden while there is no stored choice (the banner is already on screen) and when no analytics
 * tool is configured for the environment, which is when the banner never appears either.
 */
export function CookieSettingsButton() {
  const consent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!ANALYTICS_CONFIGURED || consent === "unknown") return null;

  return (
    <button
      type="button"
      onClick={clearConsent}
      className="text-left text-muted-foreground hover:text-link"
    >
      Cookie settings
    </button>
  );
}
