import type { Tables } from "@guideless/types";

export type AddOn = Tables<"departure_add_ons">;

export interface AddOnParticipant {
  add_on_id: string;
  user_id: string;
  display_name: string | null;
  first_name: string | null;
}

export interface AddOnView extends AddOn {
  /** Confirmed participants across the departure ("6 going"). */
  going: number;
  /** Group members on it, when the caller is a trip member. */
  participants: AddOnParticipant[];
  /** The signed-in traveler's booking already holds it. */
  mine: boolean;
  /** ISO date of the add-on (trip end when undated). */
  date: string;
  /** Last day it can be bought. */
  bookableUntil: string;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Sales state for the UI. Pure. */
export function addOnState(
  a: Pick<AddOnView, "mine" | "bookableUntil" | "capacity" | "going">,
  todayISO: string,
): "mine" | "closed" | "full" | "open" {
  if (a.mine) return "mine";
  if (todayISO > a.bookableUntil) return "closed";
  if (a.capacity != null && a.going >= a.capacity) return "full";
  return "open";
}

/** "Maya, Tom and 4 others" — first names of group members on the add-on, excluding yourself. */
export function participantsLabel(
  participants: AddOnParticipant[],
  selfId: string | null,
): string | null {
  const others = participants.filter((p) => p.user_id !== selfId);
  const names = others
    .map((p) => (p.display_name?.split(" ")[0] || p.first_name || "").trim())
    .filter(Boolean);
  const isMine = participants.some((p) => p.user_id === selfId);
  if (names.length === 0) return isMine ? "You're in" : null;
  const head = names.slice(0, 2);
  const rest = names.length - head.length;
  const list =
    rest > 0 ? `${head.join(", ")} and ${rest} other${rest === 1 ? "" : "s"}` : head.join(" and ");
  return isMine ? `You, ${list}` : list;
}

/** Web purchase page (the app never takes card details itself). `site` has no trailing slash. */
export function purchaseUrl(bookingId: string, addOnId: string, site: string): string {
  return `${site.replace(/\/$/, "")}/account/bookings/${bookingId}/add-ons?add=${addOnId}`;
}
