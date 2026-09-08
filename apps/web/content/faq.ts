/**
 * The public FAQ (plan v2 §5). One source of truth: /faq renders all of it, the homepage a subset.
 * Every answer must stay true to docs/pricing.md, the Terms and what the product actually does.
 * Numbers that vary per departure (deposit, group-open date, tiers) are described, not quoted.
 */
export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const FAQ: FaqItem[] = [
  {
    id: "no-guide",
    question: "Is there really no guide?",
    answer:
      "Correct. Nobody walks you around with a flag. Your itinerary, hotel details, train times, maps, recommendations and support live in the Guideless app, and real people at Guideless answer when you message. You decide what to do with your days.",
  },
  {
    id: "alone",
    question: "Am I traveling alone?",
    answer:
      "You travel independently, but not alone. Everyone on your departure is in one group: welcome drinks on night one, a group chat that opens before the trip, and optional moments along the way. Join what you like and skip the rest.",
  },
  {
    id: "group-size",
    question: "How big are groups?",
    answer:
      "Small. Each trip page shows its range; routes run from roughly six to fourteen travelers, and event weekends such as the Monaco Grand Prix take more because everyone chooses their own hotel and race view. You always see the size before you book.",
  },
  {
    id: "included",
    question: "What is included in the base trip?",
    answer:
      "Your hotel in every city, trains and transfers between cities, the welcome drinks, the Guideless app with your full itinerary, access to your group, and support throughout. Each trip page lists exactly what Guideless handles and what you book yourself.",
  },
  {
    id: "flights",
    question: "Do I book my own flights?",
    answer:
      "Yes. Flying from many different cities is what makes a group work, so you book the flight that suits you. We tell you exactly when to land and where to walk when you do, and the welcome transfer is arranged around it.",
  },
  {
    id: "tiers",
    question: "What do Explorer, Classic, Premium and Elite mean?",
    answer:
      "Every trip starts at the minimum: the base price covers the Explorer tier. Explorer is the best price, more basic accommodation and maximum value. Classic is the standard Guideless experience. Premium means better hotels and upgraded experiences. Elite is luxury, the best available. You pick a tier for where you stay and, where an add-on comes in levels, for that add-on too. Anything without a tier is simply optional.",
  },
  {
    id: "hotel",
    question: "Can I choose my hotel?",
    answer:
      "On trips with stay options, yes. Pick the tier that fits how you want to spend the weekend, for example a hotel in Nice with the train to Monaco, or a room in Monaco itself. The price difference is shown before you choose.",
  },
  {
    id: "add-later",
    question: "Can I add experiences later?",
    answer:
      "Yes, at any time, including during the trip, subject to availability. Add a boat day, a dinner or a race upgrade from your account or the app. Add-ons are paid in full when you choose them and show how many of your group are already in.",
  },
  {
    id: "pay-separately",
    question: "Can I pay separately from friends?",
    answer:
      "Yes. Every booking is its own bill. Friends can join the same departure with completely separate bookings, choose different hotels or experiences, and still be in the same group and chat.",
  },
  {
    id: "couples",
    question: "Can couples or pairs share a room?",
    answer:
      "Yes. Your own room is the default price. Two travelers on one booking can choose to share a room and each pay less. Never more than two to a room.",
  },
  {
    id: "changes",
    question: "What if something changes?",
    answer:
      "If a train or hotel changes, the itinerary in your app updates and you are notified. If you need to change your own plans, message support from the app or your account and we will tell you what is possible.",
  },
  {
    id: "problems",
    question: "What happens if something goes wrong?",
    answer:
      "Message support in the app. We already see your trip, your itinerary and today's route, so you do not have to explain from scratch. Local emergency numbers are one tap away on every trip.",
  },
  {
    id: "app",
    question: "What is the Guideless app?",
    answer:
      "Your whole trip in your pocket: today's plan, the full itinerary, a map of everything, your documents, the group, chat and support. It also works offline for the itinerary and documents.",
  },
  {
    id: "chat-opens",
    question: "When does the group chat open?",
    answer:
      "Between 30 and 45 days before departure, depending on the trip. Until then the trip page shows an anonymized roster (how many are booked, how many are solo, how many countries) so you know who is coming without anyone being named.",
  },
  {
    id: "mandatory",
    question: "Are group activities mandatory?",
    answer:
      "No. Nothing is mandatory. Welcome drinks on the first evening are included; everything else is optional, and you see how many of your group are going before you decide.",
  },
  {
    id: "ages",
    question: "What ages are travelers?",
    answer:
      "Travelers must be 18 or older at the start of the trip unless a departure states otherwise. Beyond that there is no target age; each trip page shows an age range once enough people have booked.",
  },
  {
    id: "insurance",
    question: "Is travel insurance included?",
    answer:
      "No. Travel insurance covering medical care, cancellation and belongings is strongly recommended, and required on departures where stated. Our cancellation policy refunds what we control; insurance covers your flights and the rest.",
  },
  {
    id: "extend",
    question: "Can I extend my trip?",
    answer:
      "Often, yes. Where a trip offers extra nights they appear as add-ons you can book with the trip or later. For anything else, message support and we will tell you what we can arrange.",
  },
];

/** The six questions a first-time visitor asks, in the order they ask them. */
export const HOME_FAQ_IDS = [
  "no-guide",
  "alone",
  "included",
  "hotel",
  "add-later",
  "pay-separately",
] as const;

export function faqByIds(ids: readonly string[]): FaqItem[] {
  return ids.map((id) => FAQ.find((f) => f.id === id)).filter((f): f is FaqItem => Boolean(f));
}
