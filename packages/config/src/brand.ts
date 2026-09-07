/**
 * Guideless Tours brand copy and product terminology.
 *
 * UI language should be consistent with the brand: organized, not escorted.
 * Prefer "Included: Welcome Experience" over "Mandatory Group Activity".
 * "Your Guide" always refers to the digital itinerary, never a person.
 */
export const brand = {
  name: "Guideless Tours",
  shortName: "Guideless",
  tagline: "Travel organized. Explore independently.",
  taglineSecondary: "Everything planned. Nothing forced.",
  description:
    "Guideless Tours organizes the logistics, connects you with a small group, and gives you the tools to explore on your own. No tour guide. No rigid schedule. Just a better way to travel.",
  supportEmail: "hello@guidelesstravel.com",
  /** Bump when terms / cancellation policy / waiver text changes; stored on each booking. */
  termsVersion: "2026-09",
} as const;

/** Public social profiles. Used in the footer, Organization JSON-LD (`sameAs`) and share links. */
export const social = {
  instagram: {
    handle: "guidelesstravel",
    url: "https://www.instagram.com/guidelesstravel/",
  },
} as const;

/**
 * UTM conventions for every link we control (docs/marketing.md). Keep the vocabulary small so
 * GA4 reports stay readable: utm_source = platform, utm_medium = channel type, utm_campaign = theme.
 */
export const utm = {
  sources: ["instagram", "newsletter", "google", "partner"],
  mediums: ["social", "email", "cpc", "referral", "bio"],
} as const;

/** Preferred product vocabulary. Use these labels in web, mobile, email and admin UI. */
export const terminology = {
  trip: "Your Trip",
  route: "Your Route",
  group: "Your Group",
  guide: "Your Guide",
  liveMoments: "Live Moments",
  explore: "Explore",
  recommendations: "Recommendations",
  included: "Included",
  optional: "Optional",
  nextStop: "Your Next Stop",
  freeTime: "Free time",
  support: "Support",
} as const;

/** Copy for intentional empty states. Every major screen needs one. */
export const emptyStates = {
  noTrips: {
    title: "No trips booked yet.",
    body: "Find your next adventure.",
    cta: "Explore trips",
  },
  noMessages: {
    title: "Your group hasn't started chatting yet.",
    body: "Say hello — everyone's arriving from somewhere.",
  },
  noSupport: {
    title: "Need a hand? We're here.",
    body: "Start a request and we'll get back to you.",
    cta: "Contact Guideless",
  },
  noRecommendations: {
    title: "Nothing here yet.",
    body: "Recommendations appear once your route is finalized.",
  },
} as const;

/** Distinguish clearly between what Guideless handles and what the traveler books. */
export const responsibilityLabels = {
  guideless: "Guideless handles",
  traveler: "You book",
} as const;
