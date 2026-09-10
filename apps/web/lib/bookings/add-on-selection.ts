import type { AddOnSelection } from "@guideless/validation";
import type { QuoteProblem, QuoteProblemCode } from "@guideless/types";
import { conflictsWith } from "./add-on-days";

/** Minimal add-on shape the selection helpers need (works for catalog rows and mobile payloads). */
export interface SelectableAddOn {
  id: string;
  /** "per_traveler" | "per_booking" (database rows type this as string). */
  pricing_basis: string;
  tier_group: string | null;
  /** First and last day the option covers. A conflict needs an overlapping day, not just a group. */
  day_number?: number | null;
  end_day_number?: number | null;
}

/** Normalise the optional day fields so the conflict rule can read them off any caller's row. */
function scoped(a: SelectableAddOn) {
  return {
    id: a.id,
    tier_group: a.tier_group,
    day_number: a.day_number ?? null,
    end_day_number: a.end_day_number ?? null,
  };
}

/** Room layout helpers: one 1-based room number per traveler, at most two per room. */
export function defaultRooms(travelerCount: number): number[] {
  return Array.from({ length: travelerCount }, (_, i) => i + 1);
}

/** Keep a room layout valid when the traveler list changes length. */
export function fitRooms(rooms: number[], travelerCount: number): number[] {
  const next = rooms.slice(0, travelerCount);
  while (next.length < travelerCount) next.push(next.length + 1);
  return normalizeRooms(next);
}

/** Renumber rooms 1..n in order of first appearance so the layout is canonical. */
export function normalizeRooms(rooms: number[]): number[] {
  const map = new Map<number, number>();
  return rooms.map((r) => {
    if (!map.has(r)) map.set(r, map.size + 1);
    return map.get(r)!;
  });
}

/** Put traveler `a` into traveler `b`'s room (two max); returns the same layout if that room is full. */
export function shareRoom(rooms: number[], a: number, b: number): number[] {
  if (a === b || a < 0 || b < 0 || a >= rooms.length || b >= rooms.length) return rooms;
  const target = rooms[b]!;
  if (rooms.filter((r) => r === target).length >= 2) return rooms;
  const next = [...rooms];
  next[a] = target;
  return normalizeRooms(next);
}

/** Give traveler `a` a room of their own. */
export function ownRoom(rooms: number[], a: number): number[] {
  if (a < 0 || a >= rooms.length) return rooms;
  const next = [...rooms];
  next[a] = Math.max(...rooms) + 1;
  return normalizeRooms(next);
}

export function roomOccupancy(rooms: number[]): Map<number, number[]> {
  const out = new Map<number, number[]>();
  rooms.forEach((r, i) => out.set(r, [...(out.get(r) ?? []), i]));
  return out;
}

/** Travelers (0-based) currently in shared rooms. */
export function sharedTravelers(rooms: number[]): Set<number> {
  const out = new Set<number>();
  for (const idx of roomOccupancy(rooms).values())
    if (idx.length === 2) idx.forEach((i) => out.add(i));
  return out;
}

// ── Add-on selection reducers ─────────────────────────────────────────────────

export function isSelectedFor(
  selection: AddOnSelection[],
  addOnId: string,
  travelerIndex: number,
): boolean {
  return selection.some(
    (s) => s.addOnId === addOnId && (s.travelerIndexes ?? []).includes(travelerIndex),
  );
}

export function quantityOf(selection: AddOnSelection[], addOnId: string): number {
  return selection.find((s) => s.addOnId === addOnId)?.quantity ?? 0;
}

/**
 * Toggle a per-traveler add-on for one traveler (1-based).
 *
 * Selecting one option drops that traveler from anything it conflicts with — same exclusive group
 * *and* an overlapping day. Saturday's yacht and Sunday's yacht therefore coexist, while a
 * three-day pass clears every race view across the days it covers.
 */
export function toggleTraveler(
  selection: AddOnSelection[],
  catalog: SelectableAddOn[],
  addOnId: string,
  travelerIndex: number,
): AddOnSelection[] {
  const addOn = catalog.find((a) => a.id === addOnId);
  if (!addOn || addOn.pricing_basis !== "per_traveler") return selection;
  const selected = isSelectedFor(selection, addOnId, travelerIndex);
  let next = selection.map((s) =>
    s.addOnId === addOnId
      ? { ...s, travelerIndexes: (s.travelerIndexes ?? []).filter((i) => i !== travelerIndex) }
      : s,
  );
  if (!selected) {
    if (addOn.tier_group) {
      const clashing = new Set(
        catalog.filter((a) => conflictsWith(scoped(a), scoped(addOn))).map((a) => a.id),
      );
      next = next.map((s) =>
        clashing.has(s.addOnId)
          ? { ...s, travelerIndexes: (s.travelerIndexes ?? []).filter((i) => i !== travelerIndex) }
          : s,
      );
    }
    const existing = next.find((s) => s.addOnId === addOnId);
    if (existing) {
      existing.travelerIndexes = [...(existing.travelerIndexes ?? []), travelerIndex].sort(
        (a, b) => a - b,
      );
    } else {
      next.push({ addOnId, travelerIndexes: [travelerIndex] });
    }
  }
  return next.filter((s) => (s.travelerIndexes?.length ?? 0) > 0 || (s.quantity ?? 0) > 0);
}

/** Set the quantity of a per-booking add-on (0 removes it). */
export function setQuantity(
  selection: AddOnSelection[],
  catalog: SelectableAddOn[],
  addOnId: string,
  quantity: number,
): AddOnSelection[] {
  const addOn = catalog.find((a) => a.id === addOnId);
  if (!addOn || addOn.pricing_basis !== "per_booking") return selection;
  const q = Math.max(0, Math.min(8, Math.round(quantity)));
  let next = selection.filter((s) => s.addOnId !== addOnId);
  if (q > 0) {
    if (addOn.tier_group) {
      const clashing = new Set(
        catalog.filter((a) => conflictsWith(scoped(a), scoped(addOn))).map((a) => a.id),
      );
      next = next.filter((s) => !clashing.has(s.addOnId));
    }
    next.push({ addOnId, quantity: q });
  }
  return next;
}

/** Drop travelers that no longer exist and add-ons no longer in the catalog. */
export function fitSelection(
  selection: AddOnSelection[],
  catalog: SelectableAddOn[],
  travelerCount: number,
): AddOnSelection[] {
  const ids = new Set(catalog.map((a) => a.id));
  return selection
    .filter((s) => ids.has(s.addOnId))
    .map((s) =>
      s.travelerIndexes
        ? { ...s, travelerIndexes: s.travelerIndexes.filter((i) => i >= 1 && i <= travelerCount) }
        : s,
    )
    .filter((s) => (s.travelerIndexes?.length ?? 0) > 0 || (s.quantity ?? 0) > 0);
}

// ── Problem copy ──────────────────────────────────────────────────────────────

const PROBLEM_COPY: Record<QuoteProblemCode, string> = {
  traveler_count: "A booking holds 1 to 8 travelers.",
  invalid_payment_option: "Please choose how you'd like to pay.",
  departure_not_found: "This departure is no longer available.",
  room_index: "Something is off with the room layout. Reset the rooms and try again.",
  room_capacity: "A room holds at most two travelers.",
  stay_option_unknown: "That stay option is no longer offered. Pick another.",
  stay_option_full: "That stay option doesn't have enough rooms left for your group.",
  add_on_unknown: "One of your add-ons is no longer offered.",
  add_on_closed: "One add-on can no longer be booked for its date.",
  add_on_sold_out: "An add-on has fewer spots left than you selected.",
  tier_conflict: "Only one of those per traveler per day. Drop one to add the other.",
  code_invalid: "We don't recognise that code.",
  code_own_referral: "Your own referral code can't be used on your booking.",
  code_currency: "That code is for a different currency.",
};

export function problemMessage(problem: QuoteProblem): string {
  const base = PROBLEM_COPY[problem.code] ?? "Something needs another look.";
  if (problem.code === "add_on_sold_out" && typeof problem.available === "number") {
    return `${base} Only ${problem.available} left.`;
  }
  return base;
}
