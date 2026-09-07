import { describe, expect, it } from "vitest";
import { previewRefund, refundPercentageFor } from "./cancellations";

const policy = [
  { daysBeforeDeparture: 60, refundPercentage: 100 },
  { daysBeforeDeparture: 30, refundPercentage: 50 },
  { daysBeforeDeparture: 0, refundPercentage: 0 },
];

describe("refundPercentageFor", () => {
  it("picks the tier whose lower bound the day count has reached", () => {
    expect(refundPercentageFor(policy, 90)).toBe(100);
    expect(refundPercentageFor(policy, 60)).toBe(100);
    expect(refundPercentageFor(policy, 45)).toBe(50);
    expect(refundPercentageFor(policy, 3)).toBe(0);
  });
  it("treats past departures as zero days and unknown policies as no refund", () => {
    expect(refundPercentageFor(policy, -5)).toBe(0);
    expect(refundPercentageFor([], 100)).toBe(0);
  });
});

describe("previewRefund", () => {
  const base = {
    todayISO: "2027-03-01",
    startDate: "2027-05-14",
    endDate: "2027-05-22",
    policy,
    amountPaid: 100000,
  };

  it("refunds the base trip at the tier and separates add-ons by their own deadline", () => {
    const p = previewRefund({
      ...base,
      addOns: [
        // Day 2 boat, cancellable until 7 days before 2027-05-15 → 2027-05-08: refundable today.
        {
          id: "a",
          title: "Boat",
          total: 14500,
          status: "confirmed",
          dayNumber: 2,
          cancellableUntilDaysBefore: 7,
        },
        // Extra night on the last day with a 90-day deadline → 2027-02-21: already past.
        {
          id: "b",
          title: "Extra night",
          total: 21000,
          status: "confirmed",
          dayNumber: 9,
          cancellableUntilDaysBefore: 90,
        },
        // Pending rows never count.
        {
          id: "c",
          title: "Pending",
          total: 9000,
          status: "pending",
          dayNumber: null,
          cancellableUntilDaysBefore: 1,
        },
      ],
    });
    expect(p.daysBefore).toBe(74);
    expect(p.refundPercentage).toBe(100);
    expect(p.basePaid).toBe(100000 - 14500 - 21000);
    expect(p.baseRefund).toBe(64500);
    expect(p.addOns.map((a) => a.refundable)).toEqual([true, false]);
    expect(p.addOnsRefund).toBe(14500);
    expect(p.totalRefund).toBe(64500 + 14500);
  });

  it("applies a partial tier to the base only", () => {
    const p = previewRefund({ ...base, todayISO: "2027-04-10", addOns: [] });
    expect(p.daysBefore).toBe(34);
    expect(p.refundPercentage).toBe(50);
    expect(p.totalRefund).toBe(50000);
  });
});
