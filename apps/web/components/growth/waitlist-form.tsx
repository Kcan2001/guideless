"use client";

import { useActionState, useEffect } from "react";
import { Bell } from "lucide-react";
import { joinWaitlistAction, type WaitlistState } from "@/lib/growth/waitlist";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";

/**
 * "Tell me when this opens." Used for a sold-out departure, a trip drop that has not landed,
 * and a tour with no open dates at all. The honeypot field is hidden from people, not from bots.
 */
export function WaitlistForm({
  tourId,
  departureId,
  source = "tour_page",
  label = "Get notified",
  className,
}: {
  tourId: string;
  departureId?: string;
  source?: string;
  label?: string;
  className?: string;
}) {
  const [state, action, pending] = useActionState<WaitlistState | null, FormData>(
    joinWaitlistAction,
    null,
  );

  // Recorded once when the join succeeds; the email never reaches analytics.
  useEffect(() => {
    if (state?.ok) track("waitlist_joined", { source });
  }, [state?.ok, source]);

  if (state?.ok) {
    return (
      <p className={className} role="status">
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className={className}>
      <input type="hidden" name="tourId" value={tourId} />
      {departureId && <input type="hidden" name="departureId" value={departureId} />}
      <input type="hidden" name="source" value={source} />
      <div className="flex flex-wrap items-start gap-2">
        <label className="sr-only" htmlFor={`waitlist-email-${departureId ?? tourId}`}>
          Email
        </label>
        <input
          id={`waitlist-email-${departureId ?? tourId}`}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="h-10 min-w-0 flex-1 rounded border border-border bg-surface px-3 text-sm"
        />
        <Button type="submit" size="sm" disabled={pending}>
          <Bell className="h-4 w-4" aria-hidden /> {pending ? "Adding…" : label}
        </Button>
      </div>
      {/* Hidden from people; bots fill it and are quietly accepted without a row. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={`waitlist-company-${departureId ?? tourId}`}>Company</label>
        <input
          id={`waitlist-company-${departureId ?? tourId}`}
          name="company"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      {state && !state.ok && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}
