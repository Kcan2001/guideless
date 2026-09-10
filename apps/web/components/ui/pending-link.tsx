"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Dims the anchor and stops further clicks while its own spinner is mounted. */
export const PENDING_CLASS =
  "has-[[role=status]]:pointer-events-none has-[[role=status]]:opacity-70";

/**
 * A link that says it is working.
 *
 * Some of our routes are server-rendered per request — the Trip Builder loads a departure, its
 * stay tiers, its add-ons, live availability and any saved draft before it can paint. On a slow
 * connection that is a real wait, and a plain link gives no sign it registered the click, so
 * people press it again. Kyle: "shouldn't have people clicking the buttons over and over."
 *
 * `useLinkStatus` reports the pending state of the enclosing `<Link>`, so this stays a real
 * anchor: middle-click, open-in-new-tab, prefetch and the browser's own affordances all keep
 * working, which a button calling `router.push` would throw away.
 *
 * Use it for links into dynamic routes. A link to a statically rendered page is served from the
 * cache and there is nothing to wait for; a spinner there would be theatre.
 */

export function LinkPending({
  children,
  pendingLabel,
  spinnerFirst,
}: {
  children: ReactNode;
  pendingLabel?: string;
  spinnerFirst: boolean;
}) {
  const { pending } = useLinkStatus();
  if (!pending) return <>{children}</>;

  const spinner = <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />;
  return (
    <>
      {spinnerFirst && spinner}
      <span>{pendingLabel ?? children}</span>
      {!spinnerFirst && spinner}
      {/* Announced once, rather than the label changing under a screen reader mid-read. */}
      <span className="sr-only" role="status">
        Loading
      </span>
    </>
  );
}

// Generic over the route so `typedRoutes` keeps checking hrefs through this wrapper; a plain
// ComponentProps<typeof Link> erases it and every template-literal href becomes an error.
export function PendingLink<RouteType>({
  children,
  className,
  pendingLabel,
  spinnerFirst = false,
  ...props
}: ComponentProps<typeof Link<RouteType>> & {
  /** Replaces the label while navigating, e.g. "Opening…". Defaults to keeping the label. */
  pendingLabel?: string;
  /** Put the spinner before the label, for links whose own icon sits on the right. */
  spinnerFirst?: boolean;
}) {
  return (
    <Link
      {...props}
      // `:has()` lets the anchor itself dim and stop taking clicks while its child spinner is
      // mounted, which is the part that actually stops the second and third press.
      className={cn(PENDING_CLASS, className)}
    >
      <LinkPending pendingLabel={pendingLabel} spinnerFirst={spinnerFirst}>
        {children}
      </LinkPending>
    </Link>
  );
}
