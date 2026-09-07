"use client";

import { useState } from "react";
import { Check, Copy, Gift } from "lucide-react";
import { formatMoney } from "@guideless/utils";
import type { Currency } from "@guideless/types";
import { Button } from "@/components/ui/button";

/**
 * "Bring a friend." The customer's referral code, what it does for both sides, and the credit
 * they've earned so far. Credit is applied automatically to the next quote.
 */
export function ReferralCard({
  code,
  balances,
  earnedCount,
  pendingCount,
  discountPercent = 5,
  rewardLabel = "$75",
}: {
  code: string | null;
  balances: { currency: string; amount: number }[];
  earnedCount: number;
  pendingCount: number;
  discountPercent?: number;
  rewardLabel?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable; the code is visible to select */
    }
  }

  return (
    <section
      aria-labelledby="referral-heading"
      className="rounded-xl border border-border bg-surface p-5"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aqua/25">
          <Gift className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id="referral-heading" className="font-heading text-lg font-semibold">
            Bring a friend
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            They get {discountPercent}% off the trip price with your code. You get {rewardLabel} of
            credit toward your next trip when they pay. No limit.
          </p>
          {code ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <code className="rounded-lg border border-border bg-cloud px-3 py-2 font-heading text-lg font-bold tracking-wider">
                {code}
              </code>
              <Button type="button" variant="secondary" size="sm" onClick={copy}>
                {copied ? (
                  <>
                    <Check className="h-4 w-4" aria-hidden /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" aria-hidden /> Copy code
                  </>
                )}
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Your code appears once your profile is set up.
            </p>
          )}
          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Credit available</dt>
              <dd className="font-medium">
                {balances.length === 0
                  ? "None yet"
                  : balances
                      .map((b) =>
                        formatMoney(
                          { amount: b.amount, currency: b.currency as Currency },
                          { compact: true },
                        ),
                      )
                      .join(" · ")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Friends booked</dt>
              <dd className="font-medium">
                {earnedCount}
                {pendingCount > 0 ? ` (+${pendingCount} awaiting payment)` : ""}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
