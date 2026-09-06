/**
 * GA4 marketing events (master spec §46). No PII — ids, currency and value only.
 * PostHog product analytics is added in Milestone 7.
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
  | "view_destination";

export type AnalyticsParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function track(event: AnalyticsEvent, params: AnalyticsParams = {}): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", event, params);
}
