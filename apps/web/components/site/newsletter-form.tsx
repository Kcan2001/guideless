"use client";

import { useActionState, useEffect, useRef } from "react";
import { track } from "@/lib/analytics";
import { subscribeNewsletterAction, type NewsletterState } from "@/lib/marketing/newsletter";
import { Button } from "@/components/ui/button";

const initial: NewsletterState = { status: "idle" };

/**
 * Footer newsletter signup. Works without JavaScript (plain form POST to the Server Action);
 * with it, shows the result inline and fires the GA4/PostHog `newsletter_signup` event once.
 */
export function NewsletterForm({
  source = "footer",
}: {
  source?: "footer" | "checkout" | "account";
}) {
  const [state, action, pending] = useActionState(subscribeNewsletterAction, initial);
  const tracked = useRef(false);

  useEffect(() => {
    if (state.status === "ok" && !tracked.current) {
      tracked.current = true;
      track("newsletter_signup", { source });
    }
  }, [state.status, source]);

  if (state.status === "ok") {
    return (
      <p role="status" className="text-sm text-foreground">
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <input type="hidden" name="source" value={source} />
      {/* Honeypot: hidden from people, tempting for bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={`website-${source}`}>Website</label>
        <input
          id={`website-${source}`}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      <div className="flex-1">
        <label htmlFor={`newsletter-email-${source}`} className="sr-only">
          Email address
        </label>
        <input
          id={`newsletter-email-${source}`}
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          aria-invalid={state.status === "error" || undefined}
          aria-describedby={state.status === "error" ? `newsletter-error-${source}` : undefined}
          className="h-10 w-full rounded border border-border bg-cloud px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
        {state.status === "error" && (
          <p id={`newsletter-error-${source}`} role="alert" className="mt-1 text-xs text-danger">
            {state.message}
          </p>
        )}
      </div>
      <Button type="submit" size="sm" variant="secondary" disabled={pending} className="h-10">
        {pending ? "Joining…" : "Get new departures"}
      </Button>
    </form>
  );
}
