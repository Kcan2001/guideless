import { brand } from "@guideless/config";
import type { LegalDocument } from "@/content/legal/types";

/**
 * The Booking Agreement: the contract for one trip, as opposed to the Terms of Service, which
 * cover using the site and the app. It states the things a trip contract must state and the
 * Terms do not — who is the organiser, what is protected if we fail, what happens when a trip
 * changes materially, how to complain and by when.
 *
 * NOT PUBLISHED. There is deliberately no route rendering this. It was briefly live and showed its
 * own review markers to customers, which is worse than not having the page: a contract full of
 * [BRACKETS] tells a traveler we do not know our own terms.
 *
 * THE BLOCKING QUESTION IS ANSWERED. This draft previously turned on whether Guideless sells as an
 * agent for suppliers or as the organiser of a package. It is the organiser: we contract suppliers
 * in our own name and sell a combined trip for one price, which is what clause 3 of the supplier
 * master agreement already assumes. Clauses 4 and 13 are written on that basis, and the ambiguity
 * is gone from both.
 *
 * WHAT STILL BLOCKS PUBLICATION — two facts nobody has, not two decisions nobody has made:
 *   1. Seller of Travel registration. California, Florida, Hawaii and Washington require one before
 *      selling to their residents; we hold none. Clause 4 must state a number or a restriction.
 *   2. The registered office address for clause 17.
 * Then a travel-business attorney reads the whole thing. Nothing here is legal advice.
 *
 * Bump `brand.termsVersion` when anything material changes; every booking stores the version the
 * traveler accepted.
 */
export const bookingAgreement: LegalDocument = {
  slug: "booking-agreement",
  title: "Booking Agreement",
  lede: "This is the contract for your trip. Our Terms of Service cover using the site and the app; this covers what we owe each other once you book. It is written to be read, not to be survived.",
  version: brand.termsVersion,
  lastUpdated: "2026-09-10",
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
      title: "4. Our status and your money",
      paragraphs: [
        `${brand.legalName} is the organiser of your trip, not an agent booking it for you. We contract the hotels, trains, transfers and included experiences in our own name and sell you one trip at one price. Your contract for the whole of it is with us, and clause 13 says what that means when a supplier lets us down.`,
        "Your money is not held in a trust or escrow account. Card payments go to us through Stripe and we pay suppliers out of them, which means that if Guideless failed before your trip, money you had paid would not be ring-fenced. We would rather write that plainly than imply a protection we do not have, and it is the reason we recommend travel insurance that covers supplier failure on every departure.",
        "[KYLE — BEFORE THE FIRST SALE: California, Florida, Hawaii and Washington require a Seller of Travel registration before selling to their residents, and we hold none. Either register (California is the one that matters: a CST number, roughly $100 plus a Travel Consumer Restitution Fund contribution) or block residents of those four states at checkout. This clause must then state the number and the state that issued it, or state the restriction. It cannot be published as it stands.]",
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
        "Coupon and referral codes reduce the base trip price only, one per booking. Referrals are flat amounts on every trip: $50 off for the friend booking, $100 of credit for the person who referred them.",
        "Account credit is applied automatically to the base trip price. It is not cash, cannot be transferred or withdrawn, and does not expire. Credit you EARNED is reversed if the booking that earned it is cancelled. Credit you SPENT on a booking comes back to your balance in full if that booking is cancelled — the refund tiers govern money you paid by card, not credit.",
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
        "No tier is 100%. The card networks keep their processing fee when we refund you, so a full refund costs us money on every cancellation; we would rather show you a real number than advertise a round one and find a fee to charge instead.",
        "The tiers differ by departure, and on some they are far lower than you may expect. Where we buy rooms or tickets a supplier will not refund at any notice — a Grand Prix weekend is the clearest case — the most we can return is what we can actually recover, and the published top tier can be as low as 20% even months ahead. That figure is on the departure page and at checkout before you pay, and it is the figure that governs. It is also the strongest reason to insure those trips.",
        "Optional extras follow their own deadlines, not the tiers. Most can be removed for a full refund until a stated number of days before they happen. Some are non-refundable from the moment you buy them, because we buy them in your name and cannot give them back — event tickets are the clear case. Which one applies is written on the extra before you add it and again in your account.",
        "Tiers differ by departure, because the risk does. A touring route commits us to little until about a month out, so its early tiers are generous. An event weekend is prepaid much earlier and cannot be resold, so it steps down sooner.",
        "If one traveler on a booking cancels, the tiers apply to their share, and the room arrangement for the others may change and be repriced.",
        "If you abandon the trip after it starts, or are removed under clause 11, no refund is due for what you do not use.",
      ],
    },
    {
      id: "changes-we-make",
      title: "8. If we change or cancel the trip",
      list: [
        "We may replace a hotel, train or included experience with one of equal or better standard, and we tell you as soon as we know, in the app and by email.",
        "If we have to make a significant change before departure — a different destination, a materially shorter trip, a lower standard of accommodation for most of the trip, or a change that defeats the reason you booked — you may accept it, move to another departure, or cancel and receive a full refund of everything you have paid us. Tell us within seven days of our notice, or sooner if the trip departs in less than a fortnight. Choosing a refund does not stop you claiming for a loss the change caused.",
        "Each departure has a minimum number of travelers. If it is not reached by the booking deadline we may cancel it, and you choose a full refund or another date. We will tell you within seven days of that deadline, and never later than 21 days before departure.",
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
        "Travel insurance. We strongly recommend cover for medical care abroad, cancellation, delay and belongings, bought when you book rather than later. We do not make it a condition of booking and we do not check it. We do not sell insurance and we do not advise on which policy to buy.",
        "Being 18 or older on the departure date, unless the departure says otherwise. We check the date of birth you give us against that date, so you may book at 17 if you turn 18 before you travel. Give us a false date of birth and the booking is cancelled without refund, you lose your deposit, and any venue with its own age check that turns you away is neither refundable by us nor our responsibility.",
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
        `If it is not resolved, write to ${brand.supportEmail} within 30 days of the trip ending, with your confirmation number and what you would like us to do. We acknowledge within two business days and aim to answer fully within 14 days.`,
      ],
    },
    {
      id: "liability",
      title: "13. Responsibility and limits",
      list: [
        "We are the organiser of your package. We are responsible to you for the proper performance of every part of the trip we sold you — the nights, the journeys between cities, the transfers and the experiences listed as Included — whichever supplier actually performs it. If something is not delivered as described, come to us. You do not have to chase a hotel or a rail operator yourself.",
        "Hotels, rail operators, transfer companies, activity providers and event organisers are independent businesses. We choose them with care and hold agreements with them, but we do not run them, and that is our problem to manage rather than yours.",
        "What we are not responsible for: anything you buy directly from a supplier or a venue, anything outside the trip we organised, and the separate terms you agree to yourself when you use a facility at your own risk.",
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
        "If you live in the EU or the UK, what we sell you is a package under the Package Travel Directive and the rights it gives you apply whatever this clause says. That includes the right to terminate without a fee, with a refund inside fourteen days, if a main characteristic of the package changes significantly before you travel, and the right to transfer your booking to someone else at reasonable notice. Those rights are yours; nothing here removes them.",
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
        `${brand.legalName}, trading as ${brand.name}. Email: ${brand.supportEmail}. [KYLE: registered office address, and the Seller of Travel registration number from clause 4, before this page goes live.]`,
      ],
    },
  ],
};
