import type { CancellationPolicy, CancellationWindow } from "./types";

/**
 * Reading a supplier's cancellation ladder.
 *
 * Suppliers return a list of steps: from a moment onwards, cancelling costs an amount. Our model
 * held one deadline until a LiteAPI probe showed 116 of 200 real rates carrying more than one
 * window, the deepest with five. Everything that needs to know when a rate stops being free, or
 * what cancelling on a given day costs, goes through here rather than reaching into the shape.
 *
 * Pure, no server dependencies, safe to unit test.
 */

/**
 * The ladder, ascending by `from`, with legacy single-deadline rows folded in.
 *
 * Windows without a usable timestamp are dropped rather than guessed at: a window we cannot place
 * in time is worse than no window, because it would silently sort to one end.
 */
export function cancellationWindows(policy: CancellationPolicy | null): CancellationWindow[] {
  if (!policy) return [];
  const raw = policy.windows?.length
    ? policy.windows
    : policy.deadline
      ? [{ from: policy.deadline, penaltyAmount: policy.penaltyAmount ?? 0 }]
      : [];
  return raw
    .filter((w) => w && typeof w.from === "string" && !Number.isNaN(Date.parse(w.from)))
    .map((w) => ({ from: w.from, penaltyAmount: Math.max(0, Math.round(w.penaltyAmount || 0)) }))
    .sort((a, b) => Date.parse(a.from) - Date.parse(b.from));
}

/**
 * When free cancellation ends: the earliest window's start. Null when the rate is free to cancel
 * right up to the stay, and also null when it was never refundable — those two are distinguished
 * by `NormalizedRate.refundable`, not by this.
 */
export function freeUntil(policy: CancellationPolicy | null): string | null {
  return cancellationWindows(policy)[0]?.from ?? null;
}

/** The calendar day free cancellation ends, for grouping equivalent products. */
export function freeUntilDay(policy: CancellationPolicy | null): string {
  return freeUntil(policy)?.slice(0, 10) ?? "";
}

/**
 * What cancelling at `when` costs, in minor units. The applicable window is the latest one that
 * has already started. Before the first window, nothing.
 *
 * `refundable: false` rates are the caller's job: a rate that was never refundable has no windows
 * and this returns 0, which is not the same as free.
 */
export function penaltyAt(policy: CancellationPolicy | null, when: Date | string): number {
  const at = typeof when === "string" ? Date.parse(when) : when.getTime();
  if (Number.isNaN(at)) return 0;
  let penalty = 0;
  for (const w of cancellationWindows(policy)) {
    if (Date.parse(w.from) <= at) penalty = w.penaltyAmount;
    else break;
  }
  return penalty;
}

/** True when cancelling at `when` costs nothing. */
export function isFreeAt(policy: CancellationPolicy | null, when: Date | string): boolean {
  const first = freeUntil(policy);
  if (!first) return true;
  const at = typeof when === "string" ? Date.parse(when) : when.getTime();
  return !Number.isNaN(at) && at < Date.parse(first);
}

/**
 * A one-line summary for staff screens. Never shown to a traveler: what a customer is told comes
 * from the departure's own published refund ladder, not from what a supplier charges us.
 */
export function describeLadder(policy: CancellationPolicy | null, currency = "USD"): string {
  const windows = cancellationWindows(policy);
  if (!windows.length) return policy?.description ?? "No cancellation windows given";
  const money = (minor: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
  const steps = windows.map((w) => `${w.from.slice(0, 10)} → ${money(w.penaltyAmount)}`);
  return `Free until ${windows[0].from.slice(0, 10)}, then ${steps.join(", ")}`;
}
