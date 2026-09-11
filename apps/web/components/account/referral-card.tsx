"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Gift } from "lucide-react";
import { formatMoney } from "@guideless/utils";
import type { Currency } from "@guideless/types";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export interface ReferralTier {
  referrals: number;
  credit: number;
  note: string | null;
  reached: boolean;
}

/**
 * "Bring a friend." The code, the ladder, and where the traveler stands on it. Credit is applied
 * automatically to the next quote. Every number here is real: earned counts come from confirmed
 * bookings, and the ladder is whatever staff have configured.
 */
export function ReferralCard({
  code,
  balances,
  earnedCount,
  pendingCount,
  discountPercent = 5,
  rewardLabel = "$75",
  tiers = [],
  currency = "USD",
}: {
  code: string | null;
  balances: { currency: string; amount: number }[];
  earnedCount: number;
  pendingCount: number;
  discountPercent?: number;
  rewardLabel?: string;
  tiers?: ReferralTier[];
  currency?: string;
}) {
  const [copied, setCopied] = useState(false);
  // The ladder and the traveler's place on it come from `referral_progress`, which is scoped to
  // the signed-in user by RLS. Fetched here so the account page needs no extra query.
  const [ladder, setLadder] = useState<ReferralTier[]>(tiers);
  const [earned, setEarned] = useState(earnedCount);
  useEffect(() => {
    let cancelled = false;
    createClient()
      .rpc("referral_progress", { p_currency: currency })
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        const p = data as { earned?: number; tiers?: ReferralTier[] };
        if (Array.isArray(p.tiers)) setLadder(p.tiers);
        if (typeof p.earned === "number") setEarned(p.earned);
      });
    return () => {
      cancelled = true;
    };
  }, [currency]);
  const next = ladder.find((t) => !t.reached) ?? null;
  const money = (amount: number) =>
    formatMoney({ amount, currency: currency as Currency }, { compact: true });

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
      className="rounded border border-border bg-surface p-5"
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
            They get {discountPercent}% off with your code. You get {rewardLabel} of credit when
            they pay, and more as friends add up.
          </p>
          {code ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <code className="rounded border border-border bg-cloud px-3 py-2 font-heading text-lg font-bold tracking-wider">
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

          {ladder.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-medium">
                {next
                  ? `${earned} booked. One more takes you to ${money(next.credit)}.`
                  : `${earned} booked — you have reached the top of the ladder.`}
              </p>
              <ol className="mt-3 grid gap-2 sm:grid-cols-2">
                {ladder.map((t) => (
                  <li
                    key={t.referrals}
                    className={
                      t.reached
                        ? "flex items-baseline justify-between gap-3 rounded border border-aqua/50 bg-aqua/10 px-3 py-2 text-sm"
                        : "flex items-baseline justify-between gap-3 rounded border border-border px-3 py-2 text-sm text-muted-foreground"
                    }
                  >
                    <span>
                      {t.referrals} friend{t.referrals === 1 ? "" : "s"}
                      {t.note && <span className="block text-xs">{t.note}</span>}
                    </span>
                    <span className="font-heading font-bold">{money(t.credit)}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-xs text-muted-foreground">
                Totals, not per friend: reaching a step tops your credit up to that amount.
              </p>
            </div>
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
