import type { Tables } from "@guideless/types";

export type Notification = Tables<"notifications">;

/** Unread first, newest first within each group. Pure. */
export function sortInbox<T extends Pick<Notification, "read_at" | "created_at">>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ua = a.read_at ? 1 : 0;
    const ub = b.read_at ? 1 : 0;
    if (ua !== ub) return ua - ub;
    return b.created_at.localeCompare(a.created_at);
  });
}

/** "just now", "5 min", "3 h", "yesterday", "12 May". Short, for a list row. */
export function relativeTime(iso: string, now = new Date()): string {
  const mins = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function unreadCount<T extends Pick<Notification, "read_at">>(rows: T[]): number {
  return rows.filter((r) => !r.read_at).length;
}
