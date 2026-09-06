import type { Currency, Money, PaymentStatus } from "@guideless/types";
import { money } from "./money";

/**
 * Booking pricing. Mirrors public.create_booking() in Postgres — the database is authoritative;
 * these helpers exist so the UI can show the same numbers before the booking row exists and so
 * the webhook can derive payment_status without a round trip.
 */

export type PaymentOption = "deposit" | "full";

export interface BookingQuote {
  travelerCount: number;
  perTraveler: Money;
  depositPerTraveler: Money;
  subtotal: Money;
  deposit: Money;
  /** What Stripe charges at checkout for the chosen option. */
  dueNow: Money;
  /** Remaining after `dueNow`; zero for full payment. */
  balance: Money;
  paymentOption: PaymentOption;
}

export function quoteBooking(input: {
  priceAmount: number;
  depositAmount: number;
  currency: Currency;
  travelerCount: number;
  paymentOption: PaymentOption;
}): BookingQuote {
  const { priceAmount, depositAmount, currency, travelerCount, paymentOption } = input;
  if (!Number.isInteger(travelerCount) || travelerCount < 1 || travelerCount > 8) {
    throw new RangeError(`travelerCount must be 1–8, got ${travelerCount}`);
  }
  const subtotal = money(priceAmount * travelerCount, currency);
  const deposit = money(depositAmount * travelerCount, currency);
  const dueNow = paymentOption === "full" || deposit.amount === 0 ? subtotal : deposit;
  return {
    travelerCount,
    perTraveler: money(priceAmount, currency),
    depositPerTraveler: money(depositAmount, currency),
    subtotal,
    deposit,
    dueNow,
    balance: money(subtotal.amount - dueNow.amount, currency),
    paymentOption,
  };
}

/**
 * Payment status after a successful charge or refund, from the booking's running totals.
 * Booking status (draft/pending/confirmed/…) is a separate concern and is NOT derived here.
 */
export function derivePaymentStatus(input: {
  totalAmount: number;
  depositAmount: number;
  amountPaid: number;
  amountRefunded: number;
}): PaymentStatus {
  const { totalAmount, depositAmount, amountPaid, amountRefunded } = input;
  const net = amountPaid - amountRefunded;
  if (amountRefunded > 0 && net <= 0) return "refunded";
  if (amountRefunded > 0) return "partially_refunded";
  if (amountPaid <= 0) return "unpaid";
  if (amountPaid >= totalAmount) return "paid";
  if (depositAmount > 0 && amountPaid >= depositAmount) {
    return amountPaid > depositAmount ? "partially_paid" : "deposit_paid";
  }
  return "partially_paid";
}
