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
  /**
   * The Terms edition a booking accepted, stored on the booking row. Dated, not month-numbered:
   * a month string cannot tell two revisions apart when both ship in the same month, and the whole
   * point of the field is to prove which document a given customer agreed to. Bump on the day the
   * Terms, the cancellation policy or the waiver text changes materially.
   */
  termsVersion: "2026-09-09",
  /** The Privacy Policy revises on its own schedule; it is not part of the booking contract. */
  privacyVersion: "2026-09-09",
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

/**
 * The four public tiers (ADR-014). These are the canonical definitions: web, admin, mobile and any
 * curation step read them from here rather than restating them, because a tier the company cannot
 * define consistently is a tier it cannot sell.
 *
 * A tier is a **market position, not a property attribute.** It is drawn relative to what a given
 * trip on given dates actually costs. During the Monaco Grand Prix a three-star in Monte Carlo is
 * Premium, because the tier there is set by access and scarcity rather than by the room. The same
 * property in an ordinary week is Explorer. Never map a star rating straight onto a tier.
 *
 * `blurb` is customer-facing. `rubric` is the internal instruction used when deciding what belongs
 * in a tier for a specific departure; it is never shown to a traveler.
 */
export const optionTiers = {
  explorer: {
    name: "Explorer",
    blurb: "The best price. Simpler rooms, everything that matters still included.",
    rubric:
      "The value position for this trip on these dates. Comfortable and well located for the price, never the cheapest thing available. If the destination is expensive on these dates, this rung may be a nearby town with easy transport rather than a worse room in the centre.",
  },
  classic: {
    name: "Classic",
    blurb: "The standard Guideless trip. What most people book.",
    rubric:
      "The default. A clearly better room or a better address than Explorer, without paying for scarcity. If this rung and Explorer differ only by price, one of them is wrong.",
  },
  premium: {
    name: "Premium",
    blurb: "Better rooms, better addresses, upgraded experiences.",
    rubric:
      "Buys proximity or quality that Classic cannot. On an event trip this is usually the first rung actually inside the event's town, even when the property itself is unremarkable, because on those dates being there is the upgrade.",
  },
  elite: {
    name: "Elite",
    blurb: "The best available. Luxury, and the addresses that sell out first.",
    rubric:
      "The best that can genuinely be bought for these dates. Not merely the most expensive: it has to be the one a traveler would choose if price were irrelevant.",
  },
} as const;

export type OptionTierKey = keyof typeof optionTiers;
