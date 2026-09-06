import type { ErrorEvent } from "@sentry/nextjs";

const SENSITIVE_KEYS =
  /pass(word)?|token|secret|authorization|cookie|passport|card|cvc|iban|date_of_birth|dob|email|phone/i;

function scrubValue(v: unknown): unknown {
  if (v == null) return v;
  if (typeof v === "string") return v.length > 0 ? "[redacted]" : v;
  if (typeof v === "object") return scrubObject(v as Record<string, unknown>);
  return v;
}

function scrubObject<T>(obj: T): T {
  if (Array.isArray(obj)) return obj.map((v) => scrubValue(v)) as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEYS.test(k)
      ? scrubValue(v)
      : typeof v === "object" && v !== null
        ? scrubObject(v)
        : v;
  }
  return out as T;
}

/**
 * beforeSend for every Sentry runtime (spec §112: never log passwords, tokens, card data, passport
 * numbers or personal information). Keeps ids and diagnostic metadata; redacts sensitive keys.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent | null {
  if (event.request) {
    delete event.request.cookies;
    if (event.request.headers) {
      for (const h of Object.keys(event.request.headers)) {
        if (SENSITIVE_KEYS.test(h)) event.request.headers[h] = "[redacted]";
      }
    }
    if (event.request.data && typeof event.request.data === "object") {
      event.request.data = scrubObject(event.request.data as Record<string, unknown>);
    }
    if (typeof event.request.url === "string") {
      event.request.url = event.request.url.replace(
        /([?&](code|token|access_token|refresh_token)=)[^&#]+/gi,
        "$1[redacted]",
      );
    }
  }
  if (event.user) event.user = { id: event.user.id };
  if (event.extra) event.extra = scrubObject(event.extra);
  if (event.contexts) event.contexts = scrubObject(event.contexts);
  return event;
}
