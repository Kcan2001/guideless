/**
 * The founder block (plan v2 §5 "Trust"): why Guideless exists, not a résumé (Kyle, 2026-09-07).
 * Shown on the homepage and /about. No portrait exists, so surfaces pair it with a destination
 * photo rather than a placeholder avatar.
 *
 * SCOPE OF THE FOUNDER'S ROLE, decided 2026-09-10. Kyle is the founder and is named as one. He is
 * NOT a guide, a host, or a face in the marketing: no on-camera content, no "travel with Kyle", no
 * personality-led growth plan. He may be on a departure taking photographs and reviewing how it
 * ran, and he answers support. Nothing on any surface may imply a traveler will be accompanied,
 * shown around, or looked after by him — that is the opposite of what the company sells.
 */
export const founder = {
  name: "Kyle Cannon",
  role: "Founder",
  location: "Santa Monica, California",
  paragraphs: [
    "Guideless comes from many miles in Europe and the same observation every time: nobody wanted a guide, and everybody wanted the annoying parts handled. So we book the hotels, the trains and one good evening at the start, then get out of the way.",
    "I am not on your trip. There is no guide, and I am not a substitute for one — I built the thing that books it and I answer support when you message. You may see me on a departure with a camera, checking how it actually went. That is the extent of it, by design.",
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
