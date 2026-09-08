import "server-only";

import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Real screenshots of the Guideless app, captured from a simulator build and dropped into
 * public/app/<id>.png. A slot whose file is missing renders as a text card: the site never shows
 * a mock phone or a placeholder image (plan v2 §5).
 */
export interface AppScreen {
  id: "today" | "itinerary" | "map" | "group" | "add-on" | "support";
  title: string;
  body: string;
  /** Site-relative URL when the screenshot exists, else null. */
  src: string | null;
  alt: string;
}

const SCREENS: Array<Omit<AppScreen, "src">> = [
  {
    id: "today",
    title: "Today",
    body: "Where you are, what is next and how long until it starts. Free time is shown as free time.",
    alt: "The Guideless app's Today screen with the next itinerary item and the time until it",
  },
  {
    id: "itinerary",
    title: "Itinerary",
    body: "Every day of the route, with hotels, trains, included moments and optional extras.",
    alt: "The Guideless app's day-by-day itinerary",
  },
  {
    id: "map",
    title: "Map",
    body: "Hotels, meeting points, activities and recommendations on one map, with directions a tap away.",
    alt: "The Guideless app's trip map with hotel, activity and recommendation markers",
  },
  {
    id: "group",
    title: "Group",
    body: "Who is on the trip, the group chat, and Live Moments you can join on the spot.",
    alt: "The Guideless app's Group screen with members, chat rooms and Live Moments",
  },
  {
    id: "add-on",
    title: "Add an experience",
    body: "A boat day or a dinner, added from the app, with how many of your group are already going.",
    alt: "An add-on card in the Guideless app showing price and how many travelers are going",
  },
  {
    id: "support",
    title: "Support",
    body: "Message the people who organized your trip. They already see your itinerary.",
    alt: "The Guideless app's Support screen with a private thread",
  },
];

export function listAppScreens(): AppScreen[] {
  const dir = join(process.cwd(), "public", "app");
  return SCREENS.map((s) => {
    const file = join(dir, `${s.id}.png`);
    return { ...s, src: existsSync(file) ? `/app/${s.id}.png` : null };
  });
}
