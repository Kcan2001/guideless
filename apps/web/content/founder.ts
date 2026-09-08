/**
 * The founder block (plan v2 §5 "Trust"). Facts only, supplied by Kyle; no contact details.
 * Shown on the homepage and /about. No portrait exists, so surfaces pair it with a destination
 * photo rather than a placeholder avatar.
 */
export const founder = {
  name: "Kyle Cannon",
  role: "Founder",
  location: "Santa Monica, California",
  paragraphs: [
    "I am a web architect and full-stack engineer with more than ten years building web, mobile and cloud platforms. I have led engineering teams, co-founded and exited a startup, and shipped software at Meta and Comcast.",
    "Guideless comes from many miles in Europe and the same observation every time: nobody wanted a guide, and everybody wanted the annoying parts handled. So we book the hotels, the trains and one good evening at the start, then get out of the way.",
    "I built the whole platform, booking flow and companion app myself. The wine days in Avignon are personal too: I hold the WSET Level 4 Diploma in wine.",
  ],
} as const;

/** How Guideless operates. Each line is a commitment the product already keeps. */
export const operatingPrinciples = [
  {
    title: "No invented reviews.",
    body: "There are no testimonials on this site until real travelers have written them.",
  },
  {
    title: "Prices before conversations.",
    body: "Every trip shows its price, what is included and every optional extra before you talk to anyone.",
  },
  {
    title: "Add or change later.",
    body: "Reserve with a deposit, add experiences any time, and cancel from your account with the refund shown first.",
  },
  {
    title: "Support in the app.",
    body: "The people who organized your trip answer your messages, with your itinerary already in front of them.",
  },
] as const;
