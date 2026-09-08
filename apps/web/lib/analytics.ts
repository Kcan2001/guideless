/**
 * Marketing + product analytics for the web app (master spec §46–47, docs/marketing.md).
 *
 * - GA4 (gtag) is the marketing sink. It loads with Consent Mode v2 defaults = denied, so before
 *   consent it only sends cookieless pings; `grantConsent()` upgrades it.
 * - PostHog is the product sink. It is initialised only after consent (see AnalyticsProvider).
 * - No PII in params — ids, currency, value, counts only.
 */
export type AnalyticsEvent =
  | "view_tour"
  | "view_departure"
  | "start_checkout"
  | "add_traveler"
  | "begin_payment"
  | "purchase"
  | "search_tours"
  | "filter_tours"
  | "view_destination"
  | "add_add_on" // props: departure_id, add_on_id
  | "remove_add_on" // props: departure_id, add_on_id
  | "newsletter_signup"
  | "social_link_click"
  | "cta_click" // props: placement, target
  | "faq_expanded" // props: question (the id, never free text)
  | "compare_viewed"; // props: section

export type AnalyticsParams = Record<string, string | number | boolean | undefined>;

export type ConsentState = "granted" | "denied" | "unknown";
export const CONSENT_STORAGE_KEY = "guideless-consent-v1";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    posthog?: { capture: (event: string, props?: Record<string, unknown>) => void };
  }
}

export function readConsent(): ConsentState {
  if (typeof window === "undefined") return "unknown";
  try {
    const v = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return v === "granted" || v === "denied" ? v : "unknown";
  } catch {
    return "unknown";
  }
}

export function writeConsent(state: Exclude<ConsentState, "unknown">): void {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, state);
  } catch {
    // Private mode / blocked storage: the banner simply shows again next visit.
  }
  window.dispatchEvent(new CustomEvent("guideless:consent", { detail: state }));
}

/** Google Consent Mode v2 update. Safe to call before gtag has loaded (queued in dataLayer). */
export function applyGtagConsent(state: Exclude<ConsentState, "unknown">): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  const gtag =
    window.gtag ??
    function gtagQueue(...args: unknown[]) {
      window.dataLayer!.push(args);
    };
  const value = state === "granted" ? "granted" : "denied";
  gtag("consent", "update", {
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
    analytics_storage: value,
  });
}

export function track(event: AnalyticsEvent, params: AnalyticsParams = {}): void {
  if (typeof window === "undefined") return;
  if (typeof window.gtag === "function") window.gtag("event", event, params);
  window.posthog?.capture(event, params);
}
