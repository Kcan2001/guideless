"use client";

import { useState } from "react";
import { CalendarDays, Users } from "lucide-react";
import { formatDate, formatDateRange, formatMoney, type PaymentOption } from "@guideless/utils";
import type { AddOnSelection } from "@guideless/validation";
import type { CheckoutDeparture } from "@/components/checkout/types";
import { Input } from "@/components/ui/field";
import { problemMessage } from "@/lib/bookings/add-on-selection";
import { useBookingQuote } from "@/lib/quote-client";

/**
 * The running total. Every number here comes from `quote_booking()` in the database; the
 * component only renders lines and problems. Debounced, so toggling add-ons feels instant while
 * the previous quote stays visible until the new one lands.
 */
export function OrderSummary({
  departure,
  roomIndexes,
  stayOptionId,
  addOns,
  code,
  paymentOption,
  signedIn,
  onCode,
}: {
  departure: CheckoutDeparture;
  roomIndexes: number[];
  stayOptionId: string | null;
  addOns: AddOnSelection[];
  code: string | null;
  paymentOption: PaymentOption;
  signedIn: boolean;
  onCode: (code: string | null) => void;
}) {
  const rooms = roomIndexes.length ? roomIndexes : [1];
  const { quote, pending, error } = useBookingQuote({
    departureId: departure.id,
    roomIndexes: rooms,
    stayOptionId,
    addOns,
    code,
    paymentOption,
    applyCredit: signedIn,
  });
  const [draftCode, setDraftCode] = useState(code ?? "");
  const money = (amount: number) =>
    formatMoney({ amount, currency: departure.currency }, { compact: true });
  const count = rooms.length;
  const shared = rooms.filter(
    (r, i) => rooms.indexOf(r) !== i || rooms.lastIndexOf(r) !== i,
  ).length;

  return (
    <aside
      className="rounded-2xl border border-border bg-surface p-6 lg:sticky lg:top-6"
      aria-live="polite"
      aria-busy={pending}
    >
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {departure.routeNames.join(" → ")}
      </p>
      <h2 className="mt-1 font-heading text-2xl font-bold">{departure.tourName}</h2>
      <p className="mt-2 flex items-center gap-2 text-sm">
        <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
        {formatDateRange(departure.startDate, departure.endDate)}
      </p>
      <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" aria-hidden /> {count} {count === 1 ? "traveler" : "travelers"}
        {shared > 0 ? ` · ${shared} sharing` : " · own rooms"}
        {quote?.stay_option_name ? ` · ${quote.stay_option_name}` : ""}
      </p>

      <dl
        className="mt-6 space-y-2 border-t border-border pt-4 text-sm"
        data-testid="order-summary"
      >
        {quote ? (
          <>
            {quote.lines.map((line, i) => (
              <div key={`${line.kind}-${i}`} className="flex justify-between gap-4">
                <dt className={line.kind === "discount" ? "text-link" : "text-muted-foreground"}>
                  {line.title}
                  {line.quantity > 1 && line.kind !== "discount" ? ` × ${line.quantity}` : ""}
                </dt>
                <dd className={line.kind === "discount" ? "text-link" : undefined}>
                  {line.total_amount < 0
                    ? `−${money(-line.total_amount)}`
                    : money(line.total_amount)}
                </dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 border-t border-border pt-3">
              <dt className="text-muted-foreground">Trip total</dt>
              <dd data-testid="quote-total">{money(quote.total_amount)}</dd>
            </div>
            {quote.deposit_amount > 0 && quote.payment_option === "deposit" && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">
                  Deposit
                  {quote.add_ons_amount > 0 ? " + add-ons" : ""}
                </dt>
                <dd>{money(quote.due_now_amount)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4 border-t border-border pt-3 font-semibold">
              <dt>Due today</dt>
              <dd className="font-heading text-lg" data-testid="quote-due-now">
                {money(quote.due_now_amount)}
              </dd>
            </div>
            {quote.balance_amount > 0 && (
              <div className="flex justify-between gap-4 text-muted-foreground">
                <dt>
                  Balance due{" "}
                  {departure.balanceDueDate
                    ? formatDate(departure.balanceDueDate)
                    : "before departure"}
                </dt>
                <dd>{money(quote.balance_amount)}</dd>
              </div>
            )}
          </>
        ) : error ? (
          <p className="text-danger" role="alert">
            We couldn&rsquo;t price this right now. Your selections are safe; try again in a moment.
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
        Prices per traveler in their own room. Add-ons are paid today; the balance follows later.
        Flights are not included. Your seats are held for 30 minutes once you continue to payment.
      </p>
    </aside>
  );
}
