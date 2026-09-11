"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
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
 *
 * Staff tools are excluded: /admin is a signed-in internal surface, not a visitor journey, and the
 * banner sat over its controls. Analytics does not track admin pages either.
 */
export function ConsentBanner() {
  const pathname = usePathname();
  const consent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ref = useRef<HTMLDivElement | null>(null);
  const showing = ANALYTICS_CONFIGURED && consent === "unknown" && !pathname?.startsWith("/admin");

  /**
   * Reserve the space the banner floats over.
   *
   * It is `fixed`, so it sits outside the flow and covers whatever is at the bottom of the page. On
   * a short page that is the primary button: end-to-end testing found the banner intercepting
   * clicks on "Create account", which means a real visitor could not sign up without dismissing it
   * first. Padding the body by the banner's own height lets any page scroll clear of it.
   *
   * This never fired in CI, because the banner only renders when analytics is configured and CI
   * builds without those keys. It renders in production.
   */
  useEffect(() => {
    if (!showing) return;
    const el = ref.current;
    if (!el) return;
    const apply = () => {
      document.body.style.paddingBottom = `${el.offsetHeight + 32}px`;
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    window.addEventListener("resize", apply);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", apply);
      document.body.style.paddingBottom = "";
    };
  }, [showing]);

  if (!showing) return null;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-live="polite"
      aria-label="Cookie preferences"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl rounded border border-border bg-surface p-5 shadow-lg sm:flex sm:items-center sm:gap-6"
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
