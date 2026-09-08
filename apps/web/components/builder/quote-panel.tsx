"use client";

import { useState } from "react";
import { CalendarDays, Users } from "lucide-react";
import type { BookingQuoteResult } from "@guideless/types";
import { formatDate, formatDateRange, formatMoney } from "@guideless/utils";
import type { CheckoutDeparture } from "@/components/checkout/types";
import { Input } from "@/components/ui/field";
import { problemMessage } from "@/lib/bookings/add-on-selection";
import type { QuoteState } from "@/lib/quote-client";
import { cn } from "@/lib/utils";

/**
 * The running total (plan v2 §15): included, your choices, total, deposit today, balance. Every
 * number comes from `quote_booking()`; this only renders lines. The same panel is the desktop
 * sidebar and the expanded mobile sheet, so the quote is fetched once by the builder.
 */
export function QuotePanel({
  departure,
  travelerCount,
  roomIndexes,
  state,
  code,
  onCode,
  compact = false,
  className,
}: {
  departure: CheckoutDeparture;
  travelerCount: number;
  roomIndexes: number[];
  state: QuoteState;
  code: string | null;
  onCode: (code: string | null) => void;
  /** Mobile sheet: tighter spacing, no heading block. */
  compact?: boolean;
  className?: string;
}) {
  const { quote, pending, error } = state;
  const [draftCode, setDraftCode] = useState(code ?? "");
  const money = (amount: number) =>
    formatMoney({ amount, currency: departure.currency }, { compact: true });
  const shared = roomIndexes.filter(
    (r, i) => roomIndexes.indexOf(r) !== i || roomIndexes.lastIndexOf(r) !== i,
  ).length;
  const included = quote?.lines.filter((l) => l.kind === "base") ?? [];
  const choices = quote?.lines.filter((l) => l.kind !== "base") ?? [];

  return (
    <aside
      className={cn(
        "rounded-2xl border border-border bg-surface",
        compact ? "p-5" : "p-6 lg:sticky lg:top-6",
        className,
      )}
      aria-live="polite"
      aria-busy={pending}
      data-testid="order-summary"
    >
      {!compact && (
        <>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {departure.routeNames.join(" → ")}
          </p>
          <h2 className="mt-1 font-heading text-2xl font-bold">{departure.tourName}</h2>
        </>
      )}
      <p className={cn("flex items-center gap-2 text-sm", !compact && "mt-2")}>
        <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
        {formatDateRange(departure.startDate, departure.endDate)}
      </p>
      <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" aria-hidden /> {travelerCount}{" "}
        {travelerCount === 1 ? "traveler" : "travelers"}
        {shared > 0 ? ` · ${shared} sharing` : " · own rooms"}
      </p>

      <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
        {quote ? (
          <>
            <Group label="Included">
              {included.map((line, i) => (
                <Line
                  key={`b-${i}`}
                  title={`${line.title}${line.quantity > 1 ? ` × ${line.quantity}` : ""}`}
                  value={money(line.total_amount)}
                />
              ))}
              {quote.stay_option_name && (
                <Line title={quote.stay_option_name} value="Included" muted />
              )}
            </Group>
            {choices.length > 0 && (
              <Group label="Your choices">
                {choices.map((line, i) => (
                  <Line
                    key={`c-${i}`}
                    title={`${line.title}${line.quantity > 1 && line.kind !== "discount" ? ` × ${line.quantity}` : ""}`}
                    value={
                      line.total_amount < 0
                        ? `−${money(-line.total_amount)}`
                        : `+${money(line.total_amount)}`
                    }
                    accent={line.kind === "discount"}
                  />
                ))}
              </Group>
            )}
            <div className="flex justify-between gap-4 border-t border-border pt-3">
              <dt className="text-muted-foreground">Total</dt>
              <dd className="font-heading text-lg font-bold" data-testid="quote-total">
                {money(quote.total_amount)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 font-semibold">
              <dt>{quote.payment_option === "deposit" ? "Deposit today" : "Due today"}</dt>
              <dd data-testid="quote-due-now">{money(quote.due_now_amount)}</dd>
            </div>
            {quote.balance_amount > 0 && (
              <div className="flex justify-between gap-4 text-muted-foreground">
                <dt>
                  Balance{" "}
                  {departure.balanceDueDate
                    ? `by ${formatDate(departure.balanceDueDate)}`
                    : "before departure"}
                </dt>
                <dd>{money(quote.balance_amount)}</dd>
              </div>
            )}
          </>
        ) : error ? (
          <p className="text-danger" role="alert">
            We couldn&rsquo;t price this right now. Your choices are safe; try again in a moment.
          </p>
        ) : (
          <div className="h-20 animate-pulse rounded-lg bg-sand/60" aria-hidden />
        )}
      </dl>

      {quote && quote.problems.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm text-danger" role="alert">
          {quote.problems.map((p, i) => (
            <li key={i}>{problemMessage(p)}</li>
          ))}
        </ul>
      )}

      <form
        className="mt-5 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onCode(draftCode.trim() ? draftCode.trim().toUpperCase() : null);
        }}
      >
        <label className="flex-1 text-xs text-muted-foreground">
          Have a code?
          <Input
            className="mt-1"
            value={draftCode}
            onChange={(e) => setDraftCode(e.target.value)}
            placeholder="Coupon or GL-XXXXXX"
            autoComplete="off"
            aria-label="Coupon or referral code"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-sand/60"
        >
          Apply
        </button>
      </form>
      {code && quote && quote.discount_amount > 0 && (
        <p className="mt-2 text-xs text-link">
          {quote.discount_kind === "referral"
            ? "Friend's referral applied."
            : `Code ${code} applied.`}
        </p>
      )}

      <p className="mt-5 text-xs text-muted-foreground">
        Per traveler, own room. Extras are paid today; the balance follows. Flights not included.
        Seats are held for 30 minutes once you continue to payment.
      </p>
    </aside>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function Line({
  title,
  value,
  muted = false,
  accent = false,
}: {
  title: string;
  value: string;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className={cn(accent ? "text-link" : "text-muted-foreground")}>{title}</dt>
      <dd className={cn(muted && "text-muted-foreground", accent && "text-link")}>{value}</dd>
    </div>
  );
}

export type { BookingQuoteResult };
