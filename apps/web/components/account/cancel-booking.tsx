import type { Currency, Tables } from "@guideless/types";
import { formatDate, formatMoney } from "@guideless/utils";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import type { RefundPreview } from "@/lib/bookings/cancellations";
import { requestCancellation, withdrawCancellation } from "@/lib/bookings/self-service";

type Request = Tables<"cancellation_requests">;

/**
 * "Cancel this booking" on the account page. Shows today's refund before asking for a reason;
 * submitting opens a request that staff confirm. A pending request can be withdrawn.
 */
export function CancelBooking({
  bookingId,
  currency,
  preview,
  pending,
  recent,
}: {
  bookingId: string;
  currency: Currency;
  preview: RefundPreview;
  pending: Request | null;
  recent: Request | null;
}) {
  const money = (amount: number) => formatMoney({ amount, currency }, { compact: true });

  if (pending) {
    return (
      <div className="mt-4 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
        <p className="font-medium">
          Cancellation requested {formatDate(pending.requested_at.slice(0, 10))}.
        </p>
        <p className="mt-1 text-muted-foreground">
          We&rsquo;ll confirm within two business days. The refund tier on the day you asked was{" "}
          {pending.refund_percentage_quoted}% of the trip price. Nothing changes until we confirm.
        </p>
        <form action={withdrawCancellation} className="mt-3">
          <input type="hidden" name="requestId" value={pending.id} />
          <Button type="submit" size="sm" variant="secondary">
            Withdraw request
          </Button>
        </form>
      </div>
    );
  }

  return (
    <details id={`cancel-${bookingId}`} className="mt-4 rounded-xl border border-border bg-surface">
      <summary className="cursor-pointer list-none p-4 text-sm font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
        Need to cancel this booking?
        <span className="sr-only"> Expand to see your refund and request a cancellation</span>
      </summary>
      <div className="border-t border-border p-4 text-sm">
        {recent && recent.status !== "pending" && (
          <p className="mb-3 text-muted-foreground">
            Your last request ({formatDate(recent.requested_at.slice(0, 10))}) was {recent.status}.
          </p>
        )}
        <p>
          If you cancel today, {preview.daysBefore} days before departure, the policy for this
          departure refunds <strong>{preview.refundPercentage}%</strong> of the trip price.
        </p>
        <dl className="mt-3 space-y-1">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Trip (paid so far {money(preview.basePaid)})</dt>
            <dd>{money(preview.baseRefund)} back</dd>
          </div>
          {preview.addOns.map((a) => (
            <div key={a.id} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">
                {a.title}
                {a.refundable
                  ? ` (refundable until ${formatDate(a.cancellableUntil)})`
                  : " (past its deadline)"}
              </dt>
              <dd>{a.refundable ? `${money(a.total)} back` : "no refund"}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4 border-t border-border pt-2 font-semibold">
            <dt>Total refund today</dt>
            <dd>{money(preview.totalRefund)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-muted-foreground">
          Refunds go back to your original payment method within 10 business days of our
          confirmation. Flights and anything you booked yourself are not part of this.
        </p>
        <form action={requestCancellation} className="mt-4 space-y-3">
          <input type="hidden" name="bookingId" value={bookingId} />
          <Field
            id={`cancel-reason-${bookingId}`}
            label="Why are you cancelling?"
            hint="A sentence is enough. It helps us plan better trips."
          >
            <Textarea
              id={`cancel-reason-${bookingId}`}
              name="reason"
              required
              minLength={3}
              maxLength={2000}
              rows={2}
            />
          </Field>
          <Button type="submit" size="sm" variant="secondary">
            Request cancellation
          </Button>
        </form>
      </div>
    </details>
  );
}
