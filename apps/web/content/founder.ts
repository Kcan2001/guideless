/**
 * The founder block (plan v2 §5 "Trust"): why Guideless exists, not a résumé (Kyle, 2026-09-07).
 * Shown on the homepage and /about. No portrait exists, so surfaces pair it with a destination
 * photo rather than a placeholder avatar.
 */
export const founder = {
  name: "Kyle Cannon",
  role: "Founder",
  location: "Santa Monica, California",
  paragraphs: [
    "Guideless comes from many miles in Europe and the same observation every time: nobody wanted a guide, and everybody wanted the annoying parts handled. So we book the hotels, the trains and one good evening at the start, then get out of the way.",
  ],
} as const;

/** How Guideless operates. Each line is a commitment the product already keeps. */
export const operatingPrinciples = [
  {
    title: "Add or change later.",
    body: "Reserve with a deposit and add experiences any time, before you leave or during the trip.",
  },
  {
    title: "Support in the app.",
    body: "The people who organized your trip answer your messages, with your itinerary already in front of them.",
  },
] as const;
