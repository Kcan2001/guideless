import { describe, expect, it } from "vitest";
import { derivePaymentStatus, quoteBooking } from "./pricing";

describe("quoteBooking", () => {
  const dep = { priceAmount: 349500, depositAmount: 75000, currency: "USD" as const };

  it("multiplies per-traveler amounts and charges the deposit by default", () => {
    const q = quoteBooking({ ...dep, travelerCount: 2, paymentOption: "deposit" });
    expect(q.subtotal.amount).toBe(699000);
    expect(q.deposit.amount).toBe(150000);
    expect(q.dueNow.amount).toBe(150000);
    expect(q.balance.amount).toBe(549000);
  });

  it("charges the full amount when asked", () => {
    const q = quoteBooking({ ...dep, travelerCount: 1, paymentOption: "full" });
    expect(q.dueNow.amount).toBe(349500);
    expect(q.balance.amount).toBe(0);
  });

  it("falls back to full payment when a departure has no deposit", () => {
    const q = quoteBooking({
      ...dep,
      depositAmount: 0,
      travelerCount: 3,
      paymentOption: "deposit",
    });
    expect(q.dueNow.amount).toBe(1048500);
    expect(q.balance.amount).toBe(0);
  });

  it("rejects impossible traveler counts", () => {
    expect(() => quoteBooking({ ...dep, travelerCount: 0, paymentOption: "deposit" })).toThrow(
      RangeError,
    );
    expect(() => quoteBooking({ ...dep, travelerCount: 9, paymentOption: "deposit" })).toThrow(
      RangeError,
    );
  });
});

describe("derivePaymentStatus", () => {
  const base = { totalAmount: 699000, depositAmount: 150000, amountRefunded: 0 };

  it("walks unpaid → deposit_paid → partially_paid → paid", () => {
    expect(derivePaymentStatus({ ...base, amountPaid: 0 })).toBe("unpaid");
    expect(derivePaymentStatus({ ...base, amountPaid: 150000 })).toBe("deposit_paid");
    expect(derivePaymentStatus({ ...base, amountPaid: 400000 })).toBe("partially_paid");
    expect(derivePaymentStatus({ ...base, amountPaid: 699000 })).toBe("paid");
    expect(derivePaymentStatus({ ...base, amountPaid: 700000 })).toBe("paid");
  });

  it("treats a partial first payment below the deposit as partially paid", () => {
    expect(derivePaymentStatus({ ...base, amountPaid: 100 })).toBe("partially_paid");
  });

  it("handles refunds", () => {
    expect(derivePaymentStatus({ ...base, amountPaid: 150000, amountRefunded: 50000 })).toBe(
      "partially_refunded",
    );
    expect(derivePaymentStatus({ ...base, amountPaid: 150000, amountRefunded: 150000 })).toBe(
      "refunded",
    );
  });
});
