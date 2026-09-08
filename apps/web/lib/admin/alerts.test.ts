import { describe, expect, it } from "vitest";
import {
  DEFAULT_THRESHOLDS,
  countBySeverity,
  departureAlerts,
  minutesUntil,
  sortAlerts,
  supportAlerts,
  type DepartureFacts,
} from "./alerts";

const NOW = new Date("2026-09-08T12:00:00Z");

function facts(over: Partial<DepartureFacts> = {}): DepartureFacts {
  return {
    departureId: "dep-1",
    tourName: "Monaco Grand Prix Weekend",
    startDate: "2027-06-03",
    daysUntil: 200,
    minimumTravelers: 12,
    confirmed: 20,
    held: 0,
    holdExpiries: [],
    supplierServicesUnconfirmed: 0,
    balanceOverdueBookings: 0,
    travelersMissingDetails: 0,
    hotelLinkedTiers: [],
    refundPercentages: [90, 70, 40, 0],
    ...over,
  };
}

const kinds = (fs: Partial<DepartureFacts>) => departureAlerts(facts(fs), NOW).map((a) => a.kind);

describe("departureAlerts", () => {
  it("is quiet when nothing needs attention", () => {
    expect(departureAlerts(facts(), NOW)).toEqual([]);
  });

  describe("below minimum", () => {
    it("warns inside the window", () => {
      expect(kinds({ confirmed: 5, daysUntil: 30 })).toContain("below_minimum");
    });

    it("stays quiet while there is still time to sell", () => {
      expect(kinds({ confirmed: 5, daysUntil: 200 })).not.toContain("below_minimum");
    });

    it("counts travelers, not bookings", () => {
      const [alert] = departureAlerts(facts({ confirmed: 5, daysUntil: 10 }), NOW);
      expect(alert.text).toContain("5 of 12 minimum travelers");
      expect(alert.text).toContain("10 days out");
    });
  });

  describe("holds", () => {
    it("warns when a hold expires within the hour", () => {
      const soon = new Date(NOW.getTime() + 20 * 60_000).toISOString();
      expect(kinds({ held: 2, holdExpiries: [soon] })).toContain("holds_expiring");
    });

    it("reports live holds as information when none are close to expiry", () => {
      const later = new Date(NOW.getTime() + 5 * 3_600_000).toISOString();
      const result = kinds({ held: 2, holdExpiries: [later] });
      expect(result).toContain("seat_holds");
      expect(result).not.toContain("holds_expiring");
    });

    it("ignores holds that already lapsed, since the job releases them", () => {
      const past = new Date(NOW.getTime() - 10 * 60_000).toISOString();
      expect(kinds({ held: 0, holdExpiries: [past] })).toEqual([]);
    });

    it("does not report the same holds twice", () => {
      const soon = new Date(NOW.getTime() + 5 * 60_000).toISOString();
      const result = kinds({ held: 3, holdExpiries: [soon] });
      expect(result).toContain("holds_expiring");
      expect(result).not.toContain("seat_holds");
    });
  });

  describe("suppliers", () => {
    it("warns inside 30 days", () => {
      expect(kinds({ supplierServicesUnconfirmed: 2, daysUntil: 14 })).toContain(
        "supplier_unconfirmed",
      );
    });

    it("stays quiet far out, when unconfirmed is normal", () => {
      expect(kinds({ supplierServicesUnconfirmed: 2, daysUntil: 120 })).not.toContain(
        "supplier_unconfirmed",
      );
    });

    it("links to the supplier section", () => {
      const [alert] = departureAlerts(facts({ supplierServicesUnconfirmed: 1, daysUntil: 5 }), NOW);
      expect(alert.href).toBe("/admin/departures/dep-1#suppliers");
    });
  });

  it("warns about overdue balances and missing traveler details", () => {
    const result = kinds({ balanceOverdueBookings: 3, travelersMissingDetails: 2 });
    expect(result).toContain("balance_overdue");
    expect(result).toContain("traveler_details");
  });

  describe("hotel rates", () => {
    it("distinguishes never fetched from stale", () => {
      const [never] = departureAlerts(
        facts({ hotelLinkedTiers: [{ name: "Nice", lastRateAt: null }] }),
        NOW,
      );
      expect(never.text).toContain("no rates yet");

      const old = new Date(NOW.getTime() - 72 * 3_600_000).toISOString();
      const [stale] = departureAlerts(
        facts({ hotelLinkedTiers: [{ name: "Nice", lastRateAt: old }] }),
        NOW,
      );
      expect(stale.text).toContain("older than 48 hours");
    });

    it("stays quiet for rates refreshed last night", () => {
      const fresh = new Date(NOW.getTime() - 6 * 3_600_000).toISOString();
      expect(kinds({ hotelLinkedTiers: [{ name: "Nice", lastRateAt: fresh }] })).toEqual([]);
    });

    it("ignores tiers with no hotel at all", () => {
      expect(kinds({ hotelLinkedTiers: [] })).toEqual([]);
    });
  });

  it("honours custom thresholds", () => {
    const tight = { ...DEFAULT_THRESHOLDS, belowMinimumDays: 10 };
    const result = departureAlerts(facts({ confirmed: 1, daysUntil: 30 }), NOW, tight);
    expect(result.map((a) => a.kind)).not.toContain("below_minimum");
  });
});

describe("supportAlerts", () => {
  it("warns only about threads unowned past the threshold", () => {
    const result = supportAlerts({
      openThreads: 4,
      unassigned: [
        { id: "a", ageHours: 40 },
        { id: "b", ageHours: 2 },
      ],
    });
    expect(result.map((a) => a.kind)).toEqual(["support_unassigned", "support_open"]);
    expect(result[0].text).toContain("1 support thread");
  });

  it("says nothing when the inbox is clear", () => {
    expect(supportAlerts({ openThreads: 0, unassigned: [] })).toEqual([]);
  });
});

describe("ordering and counting", () => {
  it("puts warnings first without reshuffling within a severity", () => {
    const alerts = [
      { kind: "seat_holds", severity: "info", text: "first info" },
      { kind: "below_minimum", severity: "warning", text: "first warning" },
      { kind: "support_open", severity: "info", text: "second info" },
    ] as const;
    const sorted = sortAlerts([...alerts]);
    expect(sorted.map((a) => a.text)).toEqual(["first warning", "first info", "second info"]);
  });

  it("counts by severity for the dashboard tile", () => {
    expect(
      countBySeverity([
        { kind: "below_minimum", severity: "warning", text: "" },
        { kind: "seat_holds", severity: "info", text: "" },
        { kind: "balance_overdue", severity: "warning", text: "" },
      ]),
    ).toEqual({ warning: 2, info: 1 });
  });
});

describe("minutesUntil", () => {
  it("is negative once the moment has passed", () => {
    expect(minutesUntil(new Date(NOW.getTime() - 60_000).toISOString(), NOW)).toBe(-1);
    expect(minutesUntil(new Date(NOW.getTime() + 90_000).toISOString(), NOW)).toBe(1);
  });

  it("flags a 100% refund tier, because the processing fee never comes back", () => {
    expect(kinds({ refundPercentages: [100, 50, 0] })).toContain("full_refund_tier");
    expect(kinds({ refundPercentages: [90, 70, 0] })).not.toContain("full_refund_tier");
  });
});
