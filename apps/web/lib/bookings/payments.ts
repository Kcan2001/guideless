import type { BookingStatus, PaymentStatus } from "@guideless/types";
import { derivePaymentStatus } from "@guideless/utils";

/**
 * Pure state transitions applied by the Stripe webhook handler. No I/O, fully unit-tested.
 * The webhook is authoritative for payment state (ADR-004); these helpers just make the
 * arithmetic and status rules explicit.
 */

export interface BookingMoneyState {
  status: BookingStatus;
  payment_status: PaymentStatus;
  total_amount: number;
  deposit_amount: number;
  amount_paid: number;
  amount_refunded: number;
}

export interface BookingPatch {
  status: BookingStatus;
  payment_status: PaymentStatus;
  amount_paid: number;
  amount_refunded: number;
  hold_expires_at: string | null;
  cancelled_at?: string | null;
}

/** A successful charge lands. Draft/pending bookings become confirmed; holds are released. */
export function applySuccessfulPayment(b: BookingMoneyState, amount: number): BookingPatch {
  if (!Number.isInteger(amount) || amount <= 0)
    throw new RangeError(`amount must be a positive integer, got ${amount}`);
  const amount_paid = b.amount_paid + amount;
  const payment_status = derivePaymentStatus({
    totalAmount: b.total_amount,
    depositAmount: b.deposit_amount,
    amountPaid: amount_paid,
    amountRefunded: b.amount_refunded,
  });
  const status: BookingStatus =
    b.status === "draft" || b.status === "pending_payment" ? "confirmed" : b.status;
  return {
    status,
    payment_status,
    amount_paid,
    amount_refunded: b.amount_refunded,
    hold_expires_at: null,
  };
}

/** A refund lands. Fully refunded bookings become `refunded` (and are therefore cancelled). */
export function applyRefund(b: BookingMoneyState, totalRefunded: number, now: Date): BookingPatch {
  if (!Number.isInteger(totalRefunded) || totalRefunded < 0) {
    throw new RangeError(`totalRefunded must be a non-negative integer, got ${totalRefunded}`);
  }
  const amount_refunded = Math.min(totalRefunded, b.amount_paid);
  const payment_status = derivePaymentStatus({
    totalAmount: b.total_amount,
    depositAmount: b.deposit_amount,
    amountPaid: b.amount_paid,
    amountRefunded: amount_refunded,
  });
  const fullyRefunded = amount_refunded >= b.amount_paid && b.amount_paid > 0;
  const status: BookingStatus = fullyRefunded && b.status !== "completed" ? "refunded" : b.status;
  return {
    status,
    payment_status,
    amount_paid: b.amount_paid,
    amount_refunded,
    hold_expires_at: null,
    cancelled_at: status === "refunded" ? now.toISOString() : undefined,
  };
}

/** A checkout session expired or a payment failed before anything was collected. */
export function applyAbandonedCheckout(b: BookingMoneyState): BookingPatch | null {
  if (b.status !== "pending_payment" || b.amount_paid > 0) return null;
  return {
    status: "draft",
    payment_status: "failed",
    amount_paid: 0,
    amount_refunded: b.amount_refunded,
    hold_expires_at: null,
  };
}

/** Which payment "kind" a Stripe amount represents for this booking. */
export function paymentKind(b: BookingMoneyState, amount: number): "deposit" | "balance" | "full" {
  if (b.amount_paid === 0 && amount >= b.total_amount) return "full";
  if (b.amount_paid === 0) return "deposit";
  return "balance";
}
