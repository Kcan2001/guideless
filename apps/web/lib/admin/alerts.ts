/**
 * Operational alert rules.
 *
 * Pure functions over data the caller has already fetched, so every rule is unit-tested and the
 * dashboard has no branching logic of its own. Each rule answers one question an operator would
 * otherwise have to ask a spreadsheet, and every alert carries the link to where it is fixed.
 *
 * Severity is about time, not tone: `warning` means someone must decide today, `info` means keep
 * an eye on it.
 */

export type AlertSeverity = "warning" | "info";

export interface Alert {
  severity: AlertSeverity;
  /** One sentence, written for the operator reading it at 8am. */
  text: string;
  href?: string;
  /** Groups alerts of the same kind in the UI and keeps tests readable. */
  kind: AlertKind;
}

export type AlertKind =
  | "below_minimum"
  | "seat_holds"
  | "holds_expiring"
  | "supplier_unconfirmed"
  | "balance_overdue"
  | "traveler_details"
  | "hotel_rates_stale"
  | "support_unassigned"
  | "support_open";

export interface AlertThresholds {
  /** Flag a departure under its minimum this many days out. */
  belowMinimumDays: number;
  /** Flag a supplier service still unconfirmed this many days out. */
  supplierDays: number;
  /** A hold inside this many minutes of expiry is money about to be released. */
  holdExpiryMinutes: number;
  /** Rates older than this are stale for a tier that is linked to a hotel. */
  rateStaleHours: number;
  /** A support thread nobody owns after this long needs an owner. */
  supportUnassignedHours: number;
}

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  belowMinimumDays: 45,
  supplierDays: 30,
  holdExpiryMinutes: 60,
  rateStaleHours: 48,
  supportUnassignedHours: 24,
};

/** Everything the rules need about one departure. Assembled by the caller from live queries. */
export interface DepartureFacts {
  departureId: string;
  tourName: string;
  startDate: string;
  daysUntil: number;
  minimumTravelers: number;
  confirmed: number;
  held: number;
  /** ISO timestamps of live seat and add-on holds on this departure. */
  holdExpiries: string[];
  supplierServicesUnconfirmed: number;
  balanceOverdueBookings: number;
  travelersMissingDetails: number;
  /**
   * Stay tiers linked to a hotel, with when their rates were last stored. `null` means the tier
   * has a hotel but no rate has ever been fetched.
   */
  hotelLinkedTiers: Array<{ name: string; lastRateAt: string | null }>;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Whole minutes from `now` until `iso`; negative once it has passed. */
export function minutesUntil(iso: string, now: Date): number {
  return Math.floor((new Date(iso).getTime() - now.getTime()) / 60_000);
}

function hoursSince(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / 3_600_000;
}

/**
 * Alerts for one departure. `now` is passed in rather than read from the clock so the rules are
 * deterministic in tests and consistent across a single page render.
 */
export function departureAlerts(
  d: DepartureFacts,
  now: Date,
  thresholds: AlertThresholds = DEFAULT_THRESHOLDS,
): Alert[] {
  const alerts: Alert[] = [];
  const href = `/admin/departures/${d.departureId}`;
  const where = `${d.tourName}, ${d.startDate}`;

  if (d.confirmed < d.minimumTravelers && d.daysUntil <= thresholds.belowMinimumDays) {
    alerts.push({
      kind: "below_minimum",
      severity: "warning",
      text: `${where}: ${d.confirmed} of ${d.minimumTravelers} minimum travelers, ${plural(d.daysUntil, "day")} out.`,
      href,
    });
  }

  const expiringSoon = d.holdExpiries.filter((iso) => {
    const mins = minutesUntil(iso, now);
    return mins >= 0 && mins <= thresholds.holdExpiryMinutes;
  }).length;
  if (expiringSoon > 0) {
    alerts.push({
      kind: "holds_expiring",
      severity: "warning",
      text: `${where}: ${plural(expiringSoon, "hold")} expiring within the hour.`,
      href,
    });
  } else if (d.held > 0) {
    alerts.push({
      kind: "seat_holds",
      severity: "info",
      text: `${where}: ${plural(d.held, "seat")} on hold.`,
      href,
    });
  }

  if (d.supplierServicesUnconfirmed > 0 && d.daysUntil <= thresholds.supplierDays) {
    alerts.push({
      kind: "supplier_unconfirmed",
      severity: "warning",
      text: `${where}: ${plural(d.supplierServicesUnconfirmed, "supplier booking")} still unconfirmed, ${plural(d.daysUntil, "day")} out.`,
      href: `${href}#suppliers`,
    });
  }

  if (d.balanceOverdueBookings > 0) {
    alerts.push({
      kind: "balance_overdue",
      severity: "warning",
      text: `${where}: ${plural(d.balanceOverdueBookings, "booking")} with the balance past due.`,
      href: `${href}#bookings`,
    });
  }

  if (d.travelersMissingDetails > 0) {
    alerts.push({
      kind: "traveler_details",
      severity: "warning",
      text: `${where}: ${plural(d.travelersMissingDetails, "traveler")} missing a date of birth or nationality.`,
      href: `${href}#travelers`,
    });
  }

  const staleTiers = d.hotelLinkedTiers.filter(
    (t) => t.lastRateAt === null || hoursSince(t.lastRateAt, now) > thresholds.rateStaleHours,
  );
  if (staleTiers.length > 0) {
    const never = staleTiers.every((t) => t.lastRateAt === null);
    alerts.push({
      kind: "hotel_rates_stale",
      severity: "warning",
      text: never
        ? `${where}: ${plural(staleTiers.length, "stay tier")} linked to a hotel with no rates yet — check the supplier mapping.`
        : `${where}: ${plural(staleTiers.length, "stay tier")} with rates older than ${thresholds.rateStaleHours} hours.`,
      href: `${href}#stays`,
    });
  }

  return alerts;
}

export interface SupportFacts {
  /** Threads waiting on staff, whatever their owner. */
  openThreads: number;
  /** Unassigned threads with the age in hours of the oldest. */
  unassigned: Array<{ id: string; ageHours: number }>;
}

export function supportAlerts(
  s: SupportFacts,
  thresholds: AlertThresholds = DEFAULT_THRESHOLDS,
): Alert[] {
  const alerts: Alert[] = [];
  const stale = s.unassigned.filter((t) => t.ageHours >= thresholds.supportUnassignedHours);
  if (stale.length > 0) {
    alerts.push({
      kind: "support_unassigned",
      severity: "warning",
      text: `${plural(stale.length, "support thread")} unassigned for more than ${thresholds.supportUnassignedHours} hours.`,
      href: "/admin/support",
    });
  }
  if (s.openThreads > 0) {
    alerts.push({
      kind: "support_open",
      severity: "info",
      text: `${plural(s.openThreads, "support thread")} waiting on staff.`,
      href: "/admin/support",
    });
  }
  return alerts;
}

/** Warnings first, then info; departures stay in the order the caller supplied. */
export function sortAlerts(alerts: Alert[]): Alert[] {
  return [...alerts].sort((a, b) => {
    if (a.severity === b.severity) return 0;
    return a.severity === "warning" ? -1 : 1;
  });
}

export function countBySeverity(alerts: Alert[]): { warning: number; info: number } {
  return {
    warning: alerts.filter((a) => a.severity === "warning").length,
    info: alerts.filter((a) => a.severity === "info").length,
  };
}
