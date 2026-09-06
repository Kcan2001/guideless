import type { DeepLink } from "@guideless/types";

/**
 * Maps the shared DeepLink shape (docs/api.md) onto Expo Router paths in this app.
 * Kept pure and tested; used by push responses and `guideless://` URLs alike.
 */
export function deepLinkToPath(link: DeepLink): string | null {
  switch (link.kind) {
    case "trip":
      return `/itinerary/${link.tripId}`;
    case "itinerary_item":
      return `/item/${link.itemId}`;
    case "chat_room":
      return `/chat/${link.roomId}`;
    case "support_thread":
      return `/support/${link.threadId}`;
    case "live_moment":
      return "/group"; // Live Moments list on the Group tab
    case "payment":
      return null; // handled on the web (/account)
    default:
      return null;
  }
}

/** Parses `guideless://trip/{id}/itinerary/{itemId}`-style URLs (spec §67) into a DeepLink. */
export function parseDeepLinkUrl(url: string): DeepLink | null {
  const path =
    url
      .replace(/^[a-z]+:\/\//i, "")
      .replace(/^\/+/, "")
      .split(/[?#]/)[0] ?? "";
  const seg = path.split("/").filter(Boolean);
  if (seg[0] === "trip" && seg[1]) {
    if (seg[2] === "itinerary" && seg[3])
      return { kind: "itinerary_item", tripId: seg[1], itemId: seg[3] };
    if (seg[2] === "moment" && seg[3])
      return { kind: "live_moment", tripId: seg[1], momentId: seg[3] };
    return { kind: "trip", tripId: seg[1] };
  }
  if (seg[0] === "chat" && seg[1]) return { kind: "chat_room", roomId: seg[1] };
  if (seg[0] === "support" && seg[1]) return { kind: "support_thread", threadId: seg[1] };
  if (seg[0] === "booking" && seg[1]) return { kind: "payment", bookingId: seg[1] };
  return null;
}
