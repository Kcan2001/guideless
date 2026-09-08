/**
 * Guideless Travel brand copy and product terminology.
 *
 * UI language should be consistent with the brand: organized, not escorted.
 * Prefer "Included: Welcome Experience" over "Mandatory Group Activity".
 * "Your Guide" always refers to the digital itinerary, never a person.
 */
export const brand = {
  name: "Guideless Travel",
  shortName: "Guideless",
  /** Legal entity for copyright lines, terms, invoices and the Stripe account business name. */
  legalName: "Guideless LLC",
  /** Consumer headline (plan v2 §2). "Minimal intervention travel" is category language, not the headline. */
  tagline: "Travel with a plan. Not a tour guide.",
  taglineSecondary: "Everything planned. Nothing forced.",
  /** Brand signature (Kyle, 2026-09-07): footer, social previews, app sign-in. Revisit after the first bookings. */
  signature: "Go together. Be guided by no one.",
  description:
    "Hotels, transportation, experiences and a group are organized for you. Explore independently, meet people when you want, and build the trip you actually want to take.",
  /** Category language, used as an eyebrow or secondary line only. */
  category: "Minimal intervention travel",
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
