import "server-only";

import type { Route } from "next";
import { redirect } from "next/navigation";
import type { z } from "zod";

/** FormData → plain object (first value wins; repeated keys become arrays only when needed). */
export function formToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of fd.entries()) {
    if (key.startsWith("$") || key === "returnTo") continue; // Next internals / navigation hints
    if (key in out) {
      const prev = out[key];
      out[key] = Array.isArray(prev) ? [...prev, value] : [prev, value];
    } else {
      out[key] = value;
    }
  }
  return out;
}

export type Parsed<T extends z.ZodTypeAny> =
  { ok: true; data: z.output<T> } | { ok: false; error: string };

export function parseForm<T extends z.ZodTypeAny>(schema: T, fd: FormData): Parsed<T> {
  const result = schema.safeParse(formToObject(fd));
  if (result.success) return { ok: true, data: result.data };
  const first = result.error.issues[0];
  const path = first?.path.length ? `${String(first.path.join("."))}: ` : "";
  return { ok: false, error: `${path}${first?.message ?? "Invalid input"}` };
}

/** Same-origin admin path from the form, else a fallback. */
export function returnTo(fd: FormData, fallback: string): string {
  const v = fd.get("returnTo");
  return typeof v === "string" && v.startsWith("/admin") ? v : fallback;
}

/** Redirect back with a one-line flash message rendered by <Flash />. */
export function flash(path: string, kind: "ok" | "error", message: string): never {
  const url = new URL(path, "http://x");
  url.searchParams.delete("ok");
  url.searchParams.delete("error");
  url.searchParams.set(kind, message);
  redirect((url.pathname + url.search + url.hash) as Route);
}

/** Human message for a Postgres/PostgREST error without leaking internals. */
export function dbErrorMessage(
  err: { code?: string; message?: string; hint?: string } | null,
): string {
  if (!err) return "Something went wrong.";
  if (err.hint === "departure_sold_out") return "That would exceed the departure's capacity.";
  if (err.code === "23505") return "That value already exists (duplicate).";
  if (err.code === "23503") return "That record is referenced elsewhere and cannot be removed.";
  if (err.code === "23514") return "A database rule rejected that change.";
  if (err.code === "42501") return "You don't have permission for that.";
  return err.message ?? "Something went wrong.";
}
