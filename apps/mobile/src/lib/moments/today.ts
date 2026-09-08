/**
 * Which Live Moments belong on the Trip home screen. Pure; unit-tested in today.test.ts.
 *
 * Today answers "what's happening that I could still join" — not the whole list. A moment that
 * started hours ago is gone, one three days out is noise. The Group tab keeps the full list.
 */

export interface MomentLike {
  start_at: string;
  status: string;
}

/** A moment is still joinable for this long after it starts (they have no end time). */
const GRACE_HOURS = 3;
/** How far ahead Today looks — far enough to cover tonight, not tomorrow's plans. */
const HORIZON_HOURS = 18;

const hours = (ms: number) => ms / 3_600_000;

/**
 * Moments worth showing right now, soonest first, with anything live pulled to the front.
 * `limit` caps what the screen renders; the caller compares against the full list to offer
 * "see the rest".
 */
export function momentsForToday<M extends MomentLike>(moments: M[], now: Date, limit = 2): M[] {
  const nowMs = now.getTime();
  const soon = moments.filter((m) => {
    const startMs = new Date(m.start_at).getTime();
    if (Number.isNaN(startMs)) return false;
    const ahead = hours(startMs - nowMs);
    return ahead > -GRACE_HOURS && ahead <= HORIZON_HOURS;
  });
  const sorted = [...soon].sort((a, b) => {
    const liveDiff = Number(b.status === "live") - Number(a.status === "live");
    if (liveDiff !== 0) return liveDiff;
    return new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
  });
  return sorted.slice(0, Math.max(0, limit));
}

/** How many joinable moments Today is not showing, for the "N more" link. */
export function momentsNotShown<M extends MomentLike>(moments: M[], now: Date, limit = 2): number {
  const nowMs = now.getTime();
  const joinable = moments.filter((m) => {
    const startMs = new Date(m.start_at).getTime();
    return !Number.isNaN(startMs) && hours(startMs - nowMs) > -GRACE_HOURS;
  });
  return Math.max(0, joinable.length - momentsForToday(moments, now, limit).length);
}
