import { brand } from "@guideless/config";
import type { LegalDocument } from "@/content/legal/types";

/**
 * The Booking Agreement: the contract for one trip, as opposed to the Terms of Service, which
 * cover using the site and the app. It states the things a trip contract must state and the
 * Terms do not — who is the organiser, what is protected if we fail, what happens when a trip
 * changes materially, how to complain and by when.
 *
 * DRAFT PENDING LEGAL REVIEW. Several clauses turn on a question that has not been settled:
 * whether Guideless sells as an agent for suppliers or as the organiser of a package. Clauses
 * that depend on it are marked in `docs/legal/README.md`. Do not treat this as legal advice, and
 * have a travel-business attorney review it before the first sale. Placeholders in [BRACKETS]
 * must be completed or the clause removed before publishing.
 *
 * Bump `brand.termsVersion` when anything material changes; every booking stores the version the
 * traveler accepted.
 */
export const bookingAgreement: LegalDocument = {
  slug: "booking-agreement",
  title: "Booking Agreement",
  lede: "This is the contract for your trip. Our Terms of Service cover using the site and the app; this covers what we owe each other once you book. It is written to be read, not to be survived.",
  version: brand.termsVersion,
  lastUpdated: "2026-09-09",
  sections: [
    {
      id: "parties-and-scope",
      title: "1. Who this is between, and what it covers",
      paragraphs: [
        `This agreement is between ${brand.legalName}, trading as ${brand.name}, and the person who makes a booking. It applies to each booking separately, including bookings made with a friend's trip code: joining a friend's group puts you on the same departure and in the same group, but each booking is its own contract and each party pays for itself.`,
        "It takes effect when we confirm your booking and issue a confirmation number, and it continues until the trip ends and any refund or complaint arising from it is settled. Our Terms of Service and Privacy Policy also apply; where this agreement and the Terms of Service differ about a booking, this agreement wins.",
      ],
    },
    {
      id: "lead-traveler",
      title: "2. Booking for other people",
      list: [
        "One person may book for up to eight travelers. That person is the lead traveler, and by booking they confirm that every traveler on the booking has agreed to this agreement and to the Terms of Service.",
        "We deal with the lead traveler on money, changes and cancellation, and the lead traveler is responsible for paying the whole booking.",
        "Every traveler can still use the app, the group and support in their own name once they are on a booking.",
        "The lead traveler is responsible for passing on what we send: itinerary changes, deadlines and travel documents.",
      ],
    },
    {
      id: "what-we-organise",
      title: "3. What we organise, and what we do not",
      paragraphs: [
        "We organise accommodation, travel between the destinations on the route, a small number of included experiences, airport or local transfers where the trip says so, and one included group moment. Your itinerary, timings, directions, tickets and confirmations live in the app.",
        "There is no tour guide. Nobody accompanies the group during the day, counts heads or escorts you between places. This is the point of the trip and it changes what you should expect from us: we are responsible for arranging what we said we would arrange and for helping when something goes wrong, not for supervising you.",
      ],
      list: [
        "Flights are yours to book, along with getting to the first hotel and home from the last one. We tell you the times to plan around.",
        "Free time is a deliberate part of every route and is not a service we provide.",
        "Recommendations in the app are suggestions. We do not run those places, take a commission on them, or guarantee their prices or opening hours.",
        "Activities suggested by other travelers, including Live Moments, are their plans, not ours.",
      ],
    },
    {
      id: "organiser-status",
      title: "4. Our status and your financial protection",
      paragraphs: [
        "[LEGAL REVIEW REQUIRED — this section must be completed before the first sale and its wording depends on whether Guideless sells as the organiser of a package or as an agent for the suppliers. It must state: our status; any seller-of-travel registration number and the state that issued it; whether traveler money is held in a trust or client account or covered by a bond; and, for sales that fall under the EU Package Travel Directive, the insolvency protection in place and who to contact if we fail.]",
        "Until that is settled and stated here, we will not describe your money as protected, because we would rather say nothing than say something we cannot stand behind.",
      ],
    },
    {
      id: "price-and-payment",
      title: "5. Price, deposit and balance",
      list: [
        "Prices are per traveler in the currency shown, and your own room is the default. Two travelers on one booking may share one room and each receive the shared-room saving shown at checkout. No room takes more than two travelers.",
        "You may pay a deposit and the balance later, or pay in full. The deposit amount and the balance due date are shown on the departure, at checkout and in your account. Optional extras are paid in full when you choose them and never count toward the deposit.",
        "The price you accept at checkout is recorded on your booking and does not change afterwards. If a hotel, rail operator or activity provider raises its price after you book, that is our cost, not yours. We do not add surcharges.",
        "If the balance is not paid by its due date and we cannot reach you, we may treat the booking as cancelled by you, and the cancellation tiers below apply.",
        "Card payments are handled by Stripe. We never see or store your card details.",
        "Coupon and referral codes reduce the base trip price only, one per booking. Account credit is applied automatically to the base trip price, is not cash, cannot be transferred or withdrawn, and is voided if the booking that earned it is cancelled or refunded.",
      ],
    },
    {
      id: "changes-you-make",
      title: "6. Changes you make",
      list: [
        "You can update traveler details from your account. Names must match the passport used to travel; some suppliers need final details by a date we will tell you.",
        "You can add optional extras whenever they are still on sale, including during the trip, and remove one up to its stated deadline for a full refund of that extra.",
        "You may transfer your place to someone else if they meet the conditions of the trip and any supplier whose booking must be renamed allows it. We charge you what the suppliers charge us to make the change, no more, and we tell you the amount before you commit. Some components, event tickets in particular, cannot be renamed at all.",
        "Room and traveler changes depend on what hotels and rail operators allow; we ask on your behalf and tell you what it costs.",
      ],
    },
    {
      id: "cancelling",
      title: "7. If you cancel",
      paragraphs: [
        "Every departure publishes its cancellation tiers before you book: what percentage of the trip price comes back depending on how many days before departure you cancel. Your account shows the percentage that applies on the day you ask, before you confirm.",
      ],
      list: [
        "Request a cancellation from your account. We confirm within two business days, and refunds go back to the original payment method, usually within 10 business days of confirmation.",
        "Some components are non-refundable from the moment they are bought, whatever the tiers say — event tickets are the clearest example, and race-week accommodation is often the same. Anything in that position is marked as non-refundable at the point of sale and is excluded from the percentage above. [CONFIRM PER DEPARTURE: the tiers and the non-refundable list must agree with what the suppliers actually allow.]",
        "If one traveler on a booking cancels, the tiers apply to their share, and the room arrangement for the others may change and be repriced.",
        "If you abandon the trip after it starts, or are removed under clause 11, no refund is due for what you do not use.",
      ],
    },
    {
      id: "changes-we-make",
      title: "8. If we change or cancel the trip",
      list: [
        "We may replace a hotel, train or included experience with one of equal or better standard, and we tell you as soon as we know, in the app and by email.",
        "If we have to make a significant change before departure — a different destination, a materially shorter trip, a lower standard of accommodation for most of the trip, or a change that defeats the reason you booked — you may accept it, move to another departure, or cancel and receive a full refund of everything you have paid us. Tell us within [NUMBER] days of our notice. Choosing a refund does not stop you claiming for a loss the change caused.",
        "Each departure has a minimum number of travelers. If it is not reached by the booking deadline we may cancel it, and you choose a full refund or another date. We will tell you no later than [NUMBER] days before departure.",
        "If we cancel for any other reason within our control, you get a full refund of everything you paid us.",
        "Events outside our reasonable control — extreme weather, strikes, disease, government action, the failure of a supplier, or an event organiser moving or cancelling the event a trip is built around — may force a change or cancellation. We refund what we can recover from suppliers and help you find an alternative, but we are not liable beyond that. This is why we recommend insurance that covers your flights.",
        "For a trip built around a scheduled event, the date depends on the organiser's calendar. If the event moves, we move the trip with it where we can and tell you promptly; if you cannot travel on the new dates, the significant-change rights above apply.",
      ],
    },
    {
      id: "your-responsibilities",
      title: "9. What you are responsible for",
      list: [
        "Passports, visas, vaccinations and entry requirements for every country on the route, including any country you transit. Requirements depend on your nationality and change; check them close to departure.",
        "Being where the itinerary says, when it says. Trains and transfers do not wait. If you miss one, getting yourself to the next place is at your cost.",
        "Telling us before you book about any medical condition, mobility need, allergy or dietary requirement that affects what we book for you, so we can say honestly whether the trip works for you. Some routes involve walking on uneven ground, stairs without lifts, and long days.",
        "Your own behaviour, and complying with local law and with the terms of the hotels and providers you use.",
        "Travel insurance. We strongly recommend cover for medical care abroad, cancellation, delay and belongings, bought when you book rather than later. Some departures require it, and say so. We do not sell insurance and we do not advise on which policy to buy.",
        "Being 18 or older at the start of the trip, unless the departure says otherwise.",
      ],
    },
    {
      id: "help-when-things-go-wrong",
      title: "10. Help when something goes wrong",
      paragraphs: [
        "If you are in difficulty during the trip, contact us through support in the app, which reaches a person who can already see your itinerary and your bookings. Emergency numbers for every destination are in the app and do not need a signal to read.",
        "We will help without undue delay: information about medical services and local authorities, help contacting your insurer or your family, and help arranging alternatives when travel is disrupted. Where the difficulty is caused by something you did deliberately or negligently, we may charge a reasonable fee for that help, and we will tell you before we do.",
      ],
    },
    {
      id: "behaviour",
      title: "11. Behaviour, and when we can end your trip",
      paragraphs: [
        "The group is optional but it is shared. Harassment, discrimination, threats, or behaviour that puts other travelers, suppliers or you at risk can end your participation in the trip, with no refund and no responsibility for us to get you home. We will use the least drastic response that resolves the problem, and we will explain our reasoning in writing.",
        "The same applies to the group features in the app: we can remove content or suspend an account, and you can report a message or a person from inside the app.",
      ],
    },
    {
      id: "complaints",
      title: "12. If you want to complain",
      list: [
        "Tell us during the trip, through support in the app, so we have a chance to fix it while you are still there. Many problems can be solved the same day and cannot be solved afterwards.",
        `If it is not resolved, write to ${brand.supportEmail} within 30 days of the trip ending, with your confirmation number and what you would like us to do. We acknowledge within [NUMBER] business days and aim to answer fully within [NUMBER] days.`,
        "[LEGAL REVIEW: state any alternative dispute resolution body or scheme Guideless belongs to, if it joins one, and any regulator a traveler may escalate to.]",
      ],
    },
    {
      id: "liability",
      title: "13. Responsibility and limits",
      list: [
        "Hotels, rail operators, transfer companies, activity providers and event organisers are independent businesses. We choose them with care and hold agreements with them, but we do not run them.",
        "[LEGAL REVIEW REQUIRED: if Guideless is a package organiser, it is responsible for the proper performance of the whole package regardless of which supplier fails, and this clause must say so. If it sells as an agent, the position differs. This is the single most important clause to settle, and it must be settled before the first sale.]",
        "To the extent the law allows, our liability for a booking is limited to what you paid us for it, and we are not liable for indirect losses such as flights you booked yourself, lost earnings, or disappointment.",
        "Nothing here limits liability that cannot be limited by law, including for death or personal injury caused by our negligence, or for fraud.",
        "Where an international convention limits a carrier's liability, our liability for that part of the trip is limited in the same way.",
      ],
    },
    {
      id: "your-content",
      title: "14. Reviews, photos and your data",
      list: [
        "After the trip you may write a review. Only travelers who actually took the trip can, and we publish it with your first name and the trip you took. We may decline to publish content that is abusive or identifies someone without their consent, but we do not edit a review to make it kinder to us.",
        "If you share photos with your group, you keep them. You give us permission to show them to travelers on that trip, and we ask separately before using anything in marketing.",
        "How we handle your personal data, including what your group can see about you, is in the Privacy Policy. You choose what is visible on your profile.",
      ],
    },
    {
      id: "law",
      title: "15. Law and where disputes are heard",
      paragraphs: [
        "This agreement is governed by the laws of Delaware, United States, without regard to conflict-of-law rules, and proceedings take place there — except that if you live somewhere whose consumer law gives you the right to bring a claim locally or gives you protections that cannot be signed away, you keep those rights and this clause does not remove them.",
        "[LEGAL REVIEW: for sales into the EU and UK, confirm whether this choice of law and forum is enforceable against consumers there, and whether the trips fall under the EU Package Travel Directive. If they do, mandatory local rights apply whatever this clause says.]",
      ],
    },
    {
      id: "changes-to-this-agreement",
      title: "16. Changes to this agreement",
      paragraphs: [
        "We may update this agreement. The version at the top changes when we do, and the version you accepted is stored on your booking. A change never reduces your rights on a booking you have already made.",
      ],
    },
    {
      id: "contact",
      title: "17. Contact",
      paragraphs: [
        `${brand.legalName}, trading as ${brand.name}. Email: ${brand.supportEmail}. [ADD: registered office address, and any seller-of-travel registration number, once clause 4 is settled.]`,
      ],
    },
  ],
};
