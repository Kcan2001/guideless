import { CalendarDays, Users } from "lucide-react";
import {
  formatDate,
  formatDateRange,
  formatMoney,
  quoteBooking,
  type PaymentOption,
} from "@guideless/utils";
import type { CheckoutDeparture } from "@/components/checkout/types";

export function OrderSummary({
  departure,
  travelerCount,
  paymentOption,
}: {
  departure: CheckoutDeparture;
  travelerCount: number;
  paymentOption: PaymentOption;
}) {
  const count = Math.min(Math.max(travelerCount, 1), 8);
  const q = quoteBooking({
    priceAmount: departure.priceAmount,
    depositAmount: departure.depositAmount,
    currency: departure.currency,
    travelerCount: count,
    paymentOption,
  });
  const money = (m: { amount: number; currency: typeof departure.currency }) =>
    formatMoney(m, { compact: true });

  return (
    <aside className="rounded-2xl border border-border bg-surface p-6 lg:sticky lg:top-6">
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
      </p>

      <dl className="mt-6 space-y-2 border-t border-border pt-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">
            {money(q.perTraveler)} × {count}
          </dt>
          <dd>{money(q.subtotal)}</dd>
        </div>
        {q.deposit.amount > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Deposit ({money(q.depositPerTraveler)} each)</dt>
            <dd>{money(q.deposit)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4 border-t border-border pt-3 font-semibold">
          <dt>Due today</dt>
          <dd className="font-heading text-lg">{money(q.dueNow)}</dd>
        </div>
        {q.balance.amount > 0 && (
          <div className="flex justify-between gap-4 text-muted-foreground">
            <dt>
              Balance due{" "}
              {departure.balanceDueDate ? formatDate(departure.balanceDueDate) : "before departure"}
            </dt>
            <dd>{money(q.balance)}</dd>
          </div>
        )}
      </dl>

      <p className="mt-5 text-xs text-muted-foreground">
        Prices per traveler. Flights are not included. Your seats are held for 30 minutes once you
        continue to payment.
      </p>
    </aside>
  );
}
