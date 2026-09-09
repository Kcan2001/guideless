/**
 * Product analytics for the trip companion app (master spec §47, docs/marketing.md).
 *
 * Sinks:
 *  - PostHog (`EXPO_PUBLIC_POSTHOG_KEY`) — the product analytics system of record.
 *  - GA4 via Firebase Analytics — only when the app was built with the Firebase config files
 *    (see app.config.ts → `extra.firebaseAnalytics`). Optional: a JS-only dev build or Expo Go
 *    simply skips it. Lets marketing see app + web in one GA4 property.
 *
 * Rules: explicit events only, no PII in properties (ids, counts, booleans). Never log tokens,
 * passport data or message contents.
 */
import Constants from "expo-constants";
import PostHog from "posthog-react-native";

export type ProductEvent =
  | "trip_opened"
  | "itinerary_item_viewed"
  | "recommendation_opened"
  | "map_opened"
  | "live_moment_joined"
  | "chat_opened"
  | "message_sent"
  | "support_started"
  | "document_opened"
  | "trip_completed"
  | "add_on_viewed" // props: departure_id, add_on_id
  | "add_on_add_tapped" // props: departure_id, add_on_id
  | "add_on_chat_opened" // props: add_on_id
  | "onboarding_completed" // props: counts and booleans only, never the answers
  | "onboarding_skipped"
  | "avatar_set" // props: where it was set, never the image or its URL
  | "review_submitted" // props: rating and whether a photo came with it, never the words
  | "survey_submitted" // props: which survey and how many scores, never the words
  | "assistant_asked" // props: how many actions it took, never the question or the answer
  | "assistant_opened"
  | "trip_photo_added"
  | "app_opened";

export type EventProps = Record<string, string | number | boolean | undefined>;

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
/** Set EXPO_PUBLIC_ANALYTICS_DEBUG=1 to send events from a dev build. */
const DISABLED_IN_DEV = __DEV__ && process.env.EXPO_PUBLIC_ANALYTICS_DEBUG !== "1";

export const posthog: PostHog | null = POSTHOG_KEY
  ? new PostHog(POSTHOG_KEY, {
      host: POSTHOG_HOST,
      disabled: DISABLED_IN_DEV,
      captureAppLifecycleEvents: true,
      // Screens are tracked explicitly (expo-router pathname) — see <ScreenTracker />.
    })
  : null;

// ── Firebase Analytics (optional native sink) ────────────────────────────────
type FirebaseAnalyticsApi = {
  getAnalytics: () => unknown;
  logEvent: (instance: unknown, name: string, params?: Record<string, unknown>) => Promise<void>;
  logScreenView: (
    instance: unknown,
    params: { screen_name: string; screen_class?: string },
  ) => Promise<void>;
  setUserId: (instance: unknown, id: string | null) => Promise<void>;
  setAnalyticsCollectionEnabled: (instance: unknown, enabled: boolean) => Promise<void>;
};

const firebaseEnabled = Constants.expoConfig?.extra?.firebaseAnalytics === true && !DISABLED_IN_DEV;
let firebase: { api: FirebaseAnalyticsApi; instance: unknown } | null | undefined;

function fb(): { api: FirebaseAnalyticsApi; instance: unknown } | null {
  if (firebase !== undefined) return firebase;
  firebase = null;
  if (!firebaseEnabled) return null;
  try {
    // Resolved lazily so a build without the native module never touches it at import time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const api = require("@react-native-firebase/analytics") as FirebaseAnalyticsApi;
    firebase = { api, instance: api.getAnalytics() };
  } catch (err) {
    if (__DEV__) console.warn("Firebase Analytics unavailable in this build:", err);
  }
  return firebase;
}

type DefinedProps = Record<string, string | number | boolean>;

/** Drop undefined values (PostHog wants JSON; GA4 keys are ≤ 40 chars). */
function clean(props: EventProps = {}): DefinedProps {
  const out: DefinedProps = {};
  for (const [k, v] of Object.entries(props)) if (v !== undefined) out[k.slice(0, 40)] = v;
  return out;
}

// ── Public API ───────────────────────────────────────────────────────────────
export function track(event: ProductEvent, props: EventProps = {}): void {
  const p = clean(props);
  posthog?.capture(event, p);
  const f = fb();
  if (f) void f.api.logEvent(f.instance, event, p).catch(() => undefined);
}

export function screen(name: string, props: EventProps = {}): void {
  posthog?.screen(name, clean(props));
  const f = fb();
  if (f)
    void f.api
      .logScreenView(f.instance, { screen_name: name.slice(0, 100) })
      .catch(() => undefined);
}

/** Pseudonymous id only (Supabase user id). Never an email. */
export function identify(userId: string): void {
  posthog?.identify(userId);
  const f = fb();
  if (f) void f.api.setUserId(f.instance, userId).catch(() => undefined);
}

export function reset(): void {
  posthog?.reset();
  const f = fb();
  if (f) void f.api.setUserId(f.instance, null).catch(() => undefined);
}

/** Honour an in-app "share usage data" toggle. */
export async function setEnabled(enabled: boolean): Promise<void> {
  if (posthog) {
    if (enabled) posthog.optIn();
    else posthog.optOut();
  }
  const f = fb();
  if (f) await f.api.setAnalyticsCollectionEnabled(f.instance, enabled).catch(() => undefined);
}
