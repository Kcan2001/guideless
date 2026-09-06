import { describe, expect, it } from "vitest";
import {
  applyAbandonedCheckout,
  applyRefund,
  applySuccessfulPayment,
  paymentKind,
  type BookingMoneyState,
} from "./payments";

const pending: BookingMoneyState = {
  status: "pending_payment",
  payment_status: "unpaid",
  total_amount: 699000,
  deposit_amount: 150000,
  amount_paid: 0,
  amount_refunded: 0,
};

describe("applySuccessfulPayment", () => {
  it("confirms a pending booking on deposit and clears the hold", () => {
    const patch = applySuccessfulPayment(pending, 150000);
    expect(patch).toEqual({
      status: "confirmed",
      payment_status: "deposit_paid",
      amount_paid: 150000,
      amount_refunded: 0,
      hold_expires_at: null,
    });
  });

  it("marks paid when the balance arrives and keeps the status", () => {
    const confirmed: BookingMoneyState = {
      ...pending,
      status: "confirmed",
      payment_status: "deposit_paid",
      amount_paid: 150000,
    };
    const patch = applySuccessfulPayment(confirmed, 549000);
    expect(patch.status).toBe("confirmed");
    expect(patch.payment_status).toBe("paid");
    expect(patch.amount_paid).toBe(699000);
  });

  it("is idempotent-friendly: a replayed amount is simply added (caller dedupes by intent id)", () => {
    expect(applySuccessfulPayment(pending, 699000).payment_status).toBe("paid");
  });

  it("rejects non-positive amounts", () => {
    expect(() => applySuccessfulPayment(pending, 0)).toThrow(RangeError);
    expect(() => applySuccessfulPayment(pending, 10.5)).toThrow(RangeError);
  });
});

describe("applyRefund", () => {
  const paid: BookingMoneyState = {
    ...pending,
    status: "confirmed",
    payment_status: "paid",
    amount_paid: 699000,
  };
  const now = new Date("2027-01-01T00:00:00Z");

  it("partially refunds without cancelling", () => {
    const patch = applyRefund(paid, 100000, now);
    expect(patch.status).toBe("confirmed");
    expect(patch.payment_status).toBe("partially_refunded");
    expect(patch.amount_refunded).toBe(100000);
    expect(patch.cancelled_at).toBeUndefined();
  });

  it("fully refunds → refunded + cancelled_at", () => {
    const patch = applyRefund(paid, 699000, now);
    expect(patch.status).toBe("refunded");
    expect(patch.payment_status).toBe("refunded");
    expect(patch.cancelled_at).toBe(now.toISOString());
  });

  it("never records more refunded than paid", () => {
    expect(applyRefund(paid, 900000, now).amount_refunded).toBe(699000);
  });
});

describe("applyAbandonedCheckout", () => {
  it("returns pending bookings to draft and releases the hold", () => {
    expect(applyAbandonedCheckout(pending)).toEqual({
      status: "draft",
      payment_status: "failed",
      amount_paid: 0,
      amount_refunded: 0,
      hold_expires_at: null,
    });
  });

  it("does nothing once money has been collected or the booking is not pending", () => {
    expect(applyAbandonedCheckout({ ...pending, amount_paid: 1 })).toBeNull();
    expect(applyAbandonedCheckout({ ...pending, status: "confirmed" })).toBeNull();
  });
});

describe("paymentKind", () => {
  it("classifies deposit / full / balance", () => {
    expect(paymentKind(pending, 150000)).toBe("deposit");
    expect(paymentKind(pending, 699000)).toBe("full");
    expect(paymentKind({ ...pending, amount_paid: 150000 }, 549000)).toBe("balance");
  });
});
