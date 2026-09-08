import { brand } from "@guideless/config";
import type { LegalDocument } from "@/content/legal/types";

/**
 * Terms of Service for Guideless LLC, trading as Guideless Travel. Plain language on purpose.
 * Bump `brand.termsVersion` when anything here changes materially; every booking stores the
 * version the customer accepted.
 */
export const terms: LegalDocument = {
  slug: "terms",
  title: "Terms of Service",
  lede: "These are the terms between you and Guideless LLC when you browse our site, book a trip or use the Guideless Travel app. We have kept them short and readable. If something is unclear, ask us before you book.",
  version: brand.termsVersion,
  lastUpdated: "2026-09-06",
  sections: [
    {
      id: "who-we-are",
      title: "1. Who we are",
      paragraphs: [
        `${brand.legalName} operates the Guideless Travel brand, this website and the Guideless app. When these terms say "we", "us" or "Guideless", they mean ${brand.legalName}. When they say "you", they mean the person who makes a booking and, where relevant, each traveler on that booking.`,
        `You can reach us at ${brand.supportEmail}.`,
      ],
    },
    {
      id: "what-we-provide",
      title: "2. What we provide",
      paragraphs: [
        "Guideless organizes the logistics of a group trip: accommodation, trains and transfers between destinations, a small number of included experiences, and a welcome event on the first evening. We do not provide a tour guide. Your itinerary, timings and directions live in the app, which we call Your Guide.",
        "Everything not marked Included is optional. Free time is a deliberate part of every route. You decide how to spend it.",
        "Add-ons (for example a boat day, a wine afternoon, event tickets, a private transfer or an extra night) are optional extras you can choose at booking or later. Each add-on states its price, when it happens and its own cancellation deadline.",
      ],
    },
    {
      id: "booking-and-payment",
      title: "3. Booking and payment",
      list: [
        "A booking is confirmed when your payment is received and you see a confirmation number. Until then your places are held for a short time only.",
        "Prices are per traveler in the currency shown. The default is your own room; two travelers on one booking may choose to share a room and each receive the shared-room saving shown at checkout. A stay tier, where offered, changes the price per traveler as displayed.",
        "You may pay a deposit and the balance later, or pay in full. The balance is due by the date shown on your departure and in your account. Add-ons are paid in full when you choose them and are not part of the deposit.",
        "The price you accept at checkout is recorded on your booking and does not change afterwards, even if our published prices do.",
        "Payments are processed by Stripe. We never see or store your card details.",
        "Coupon and referral codes reduce the base trip price only, as shown at checkout. One code per booking.",
      ],
    },
    {
      id: "changes-by-you",
      title: "4. Changes you can make",
      list: [
        "You can update traveler details (names as they appear on passports, dates of birth, nationality, contact details, dietary and accessibility needs) from your account. Some suppliers need final details by a set date; we tell you when.",
        "You can add add-ons any time they are still on sale, including during the trip, from your account or the app.",
        "You can remove an add-on up to its stated cancellation deadline for a full refund of that add-on. After the deadline it is non-refundable.",
        "Room changes and traveler substitutions are handled by our team on request and depend on what hotels and rail operators allow.",
      ],
    },
    {
      id: "cancellation-by-you",
      title: "5. Cancelling your booking",
      paragraphs: [
        "Every departure publishes its cancellation policy before you book: a set of tiers that state what percentage of the trip price is refunded depending on how many days before departure you cancel. The tiers for your departure are shown on the departure page, at checkout and in your account.",
      ],
      list: [
        "Request a cancellation from your account. Your account shows, before you confirm, the refund percentage that applies on that day and which add-ons are still refundable.",
        "We confirm the cancellation within two business days. Refunds go back to the original payment method and usually arrive within 10 business days of confirmation.",
        "Deposits and balances follow the same tiers, and we charge no cancellation fee on top. No tier is 100%: refunding a payment costs us the processing fee, so the top tier sits below it rather than us inventing a fee to cover it.",
        "Optional extras follow their own deadlines instead of the tiers. Some, event tickets in particular, are non-refundable from the moment you buy them, and say so before you add them.",
        "If one traveler on a multi-traveler booking cancels, the tiers apply to that traveler's share, and the remaining travelers' room arrangement may change.",
      ],
    },
    {
      id: "changes-by-us",
      title: "6. Changes or cancellation by us",
      list: [
        "Each departure has a minimum number of travelers. If it is not reached by the booking deadline we may cancel the departure; you then choose a full refund or a transfer to another date.",
        "If we cancel a departure for any other reason within our control, you receive a full refund of everything you paid us. Flights and other arrangements you booked yourself are your responsibility, which is why we recommend travel insurance that covers them.",
        "We may replace a hotel, train or included experience with one of equal or better standard when a supplier changes plans. We tell you as soon as we know, through the app and by email.",
        "Events outside our reasonable control (strikes, extreme weather, natural disasters, epidemics, government action, supplier failure and similar) may force changes or cancellation. In those cases we refund what we can recover from suppliers and work with you on alternatives, but we are not liable for losses beyond that.",
      ],
    },
    {
      id: "your-responsibilities",
      title: "7. Your responsibilities",
      list: [
        "Flights, and getting to the first hotel and home from the last one, are yours to arrange. We tell you exactly when to arrive.",
        "Passports, visas, vaccinations and any entry requirements are your responsibility. Names on your booking must match your passport.",
        "Travel insurance covering medical care, cancellation and personal belongings is strongly recommended and required on some departures where stated.",
        "You are responsible for your own health, safety and behavior during the trip, for complying with local laws, and for the terms of the hotels, rail operators and activity providers you use.",
        "Timings in Your Guide are firm for trains and transfers. If you miss a departure, rebooking costs are yours.",
        "Travelers must be 18 or older at the start of the trip unless a departure states otherwise.",
      ],
    },
    {
      id: "group-and-live-moments",
      title: "8. Your Group and Live Moments",
      paragraphs: [
        "The group features of the app (the roster, group chat, Live Moments, seeing who chose the same add-ons) are optional. You choose what other travelers see about you.",
        "Be decent to each other. We may remove content or suspend a traveler from the group features for harassment, discrimination, threats or persistent disrespect, and in serious cases end their participation in the trip without refund. You can report messages or people from within the app.",
        "Live Moments suggested by travelers are their own plans, not services we provide.",
      ],
    },
    {
      id: "suppliers-and-liability",
      title: "9. Suppliers and liability",
      list: [
        "Hotels, rail operators, transfer companies and activity providers are independent businesses. We select and book them with care, but we do not run them, and we are not liable for their acts or omissions beyond what applicable law requires of a travel organizer.",
        "To the extent the law allows, our total liability to you for a booking is limited to the amount you paid us for that booking, and we are not liable for indirect or consequential losses such as missed flights you booked yourself, lost earnings or disappointment.",
        "Nothing in these terms limits liability that cannot be limited by law, including for death or personal injury caused by our negligence.",
      ],
    },
    {
      id: "app-and-content",
      title: "10. The app, the site and our content",
      paragraphs: [
        "You may use the Guideless app and website for your own trip planning and travel. The content, design and software are ours or our licensors' and may not be copied or resold. Recommendations in the app are suggestions, not endorsements, and prices at third-party venues can change.",
      ],
    },
    {
      id: "law-and-disputes",
      title: "11. Governing law and disputes",
      paragraphs: [
        "These terms are governed by the laws of Delaware, United States, without regard to conflict-of-law rules, and any court proceedings take place there unless consumer protection law where you live gives you additional rights, which these terms do not remove.",
        "If something goes wrong, tell us first. Most issues are resolved by email within a few days, and we would rather fix a trip than argue about one.",
      ],
    },
    {
      id: "changes-to-terms",
      title: "12. Changes to these terms",
      paragraphs: [
        `We may update these terms. The version number at the top changes when we do, and the version you accepted is stored on your booking. Changes do not reduce your rights on a booking you have already made.`,
      ],
    },
    {
      id: "contact",
      title: "13. Contact",
      paragraphs: [`${brand.legalName}, trading as ${brand.name}. Email: ${brand.supportEmail}.`],
    },
  ],
};
