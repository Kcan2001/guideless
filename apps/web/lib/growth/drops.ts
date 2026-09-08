/**
 * Trip drops. A departure with a future `opens_at` is visible and priced, but not bookable:
 * the page shows when it opens and offers the waitlist instead of a booking button.
 *
 * Pure so both the server page and the client countdown agree on what "open" means.
 */

export interface DropState {
  /** Bookable right now. */
  open: boolean;
  /** Set only while the drop is still ahead. */
  opensAt: Date | null;
  /** Whole seconds until it opens, 0 once open. */
  secondsUntil: number;
}

export function dropState(opensAt: string | null | undefined, now: Date = new Date()): DropState {
  if (!opensAt) return { open: true, opensAt: null, secondsUntil: 0 };
  const at = new Date(opensAt);
  if (Number.isNaN(at.getTime())) return { open: true, opensAt: null, secondsUntil: 0 };
  const ms = at.getTime() - now.getTime();
  if (ms <= 0) return { open: true, opensAt: null, secondsUntil: 0 };
  return { open: false, opensAt: at, secondsUntil: Math.ceil(ms / 1000) };
}

/**
 * "Opens in 3 days" / "Opens in 4 hours" / "Opens in 12 minutes". One unit, never a clock:
 * a countdown to the second on a page nobody is watching is noise.
 */
export function dropCountdown(secondsUntil: number): string {
  if (secondsUntil <= 0) return "Open now";
  const minutes = Math.round(secondsUntil / 60);
  if (minutes < 60) return `Opens in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `Opens in ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `Opens in ${days} day${days === 1 ? "" : "s"}`;
}
