import { brand } from "@guideless/config";
import type { LegalDocument } from "@/content/legal/types";

/** Privacy Policy for Guideless LLC, trading as Guideless Travel. */
export const privacy: LegalDocument = {
  slug: "privacy",
  title: "Privacy Policy",
  lede: "Organizing a trip means we hold personal details for you and the people you travel with. This policy explains what we collect, why, who processes it for us and the choices you have. No surprises.",
  version: brand.privacyVersion,
  lastUpdated: "2026-09-08",
  sections: [
    {
      id: "who",
      title: "1. Who is responsible",
      paragraphs: [
        `${brand.legalName}, trading as ${brand.name}, is the data controller for the personal data described here. Contact: ${brand.supportEmail}.`,
      ],
    },
    {
      id: "what-we-collect",
      title: "2. What we collect",
      list: [
        "Account: email address, password (stored hashed by our authentication provider), display name and any profile details you choose to add, such as a short bio, home country, interests, travel style and languages.",
        "Traveler details for each person on a booking: name as on the passport, date of birth, nationality, email, phone, dietary requirements and accessibility needs. Hotels and rail operators require most of these.",
        "Emergency contact for the lead traveler: name, relationship, phone and optional email.",
        "Payments: handled by Stripe. We receive the amount, currency, status and the last four digits of the card; we never see or store full card numbers.",
        "Booking history, add-ons chosen, room arrangement, referral codes used and credits earned.",
        "Messages you send in group chat, Live Moments you create or join, RSVPs, support conversations and any attachments you upload.",
        "App and device information: a push notification token if you allow notifications, app version, and crash reports (with personal fields removed) if the app fails.",
        "Location: only while the app is open and only if you grant permission, to show what is near you and how far your next stop is. We do not track your location in the background and do not store a location history.",
        "Newsletter: if you subscribe, your email address, where on the site you subscribed from and the date you did. You do not need an account to subscribe, and every email carries a one-click unsubscribe link.",
        "Website usage: cookies and similar technologies for analytics, only after you accept them in the consent banner. Essential cookies for signing in and checkout always apply.",
      ],
    },
    {
      id: "why",
      title: "3. Why we use it",
      list: [
        "To run your trip: booking hotels, trains, transfers and experiences in your name and sharing with those suppliers only what they need.",
        "To keep you informed: booking confirmations, payment reminders, itinerary changes, trip reminders and support replies. Operational messages are part of the service; group and news messages follow your notification preferences.",
        "To make the group work: other travelers on your trip see your display name and only the profile fields you switch on. They never see your email, phone, date of birth or documents.",
        "For safety: emergency contacts are used only in an emergency; staff can see traveler details to help during the trip.",
        "To meet legal and accounting duties, prevent fraud and enforce our terms.",
        "To improve the product, using analytics that is aggregated wherever possible and, on the website, only with your consent.",
      ],
    },
    {
      id: "who-we-share-with",
      title: "4. Who we share it with",
      paragraphs: [
        "We share data with processors that act on our instructions, and with suppliers who deliver parts of your trip. We do not sell personal data.",
      ],
      list: [
        "Supabase (database, authentication, file storage) and Vercel (website hosting).",
        "Stripe (payments), Resend (email delivery), Expo (app builds and push notifications).",
        "Sentry (error reporting with personal fields scrubbed), PostHog (product analytics) and Google Analytics 4 (website analytics, only with consent).",
        "Hotels, rail operators, transfer and activity providers for your departure: names, dates, room arrangement, dietary and accessibility needs, and a contact phone where the supplier requires it.",
        "Authorities where the law requires, and professional advisers under confidentiality.",
      ],
    },
    {
      id: "retention",
      title: "5. How long we keep it",
      list: [
        "Booking, payment and invoice records: as long as tax and accounting law requires, usually seven years.",
        "Traveler details, emergency contacts and support conversations: for the trip and a reasonable period afterwards to handle questions, then deleted or anonymized.",
        "Group chat and Live Moments: for the trip and up to twelve months after it ends, unless you delete your messages sooner.",
        "Newsletter subscriptions: until you unsubscribe. We keep the unsubscribed record itself so we do not email you again by mistake.",
        "Analytics: in aggregated form; individual identifiers are removed or expire according to each tool's retention setting.",
      ],
    },
    {
      id: "your-rights",
      title: "6. Your choices and rights",
      list: [
        "You can view and edit most of your data in your account and in the app (profile, traveler details, notification preferences, what the group sees).",
        `You can ask us to access, correct, export or delete your personal data by emailing ${brand.supportEmail}. We verify the request, then act within 30 days. Financial records that the law requires us to keep are anonymized rather than deleted.`,
        "You can withdraw analytics consent at any time from Cookie settings in the footer, which stops analytics immediately and brings the banner back. You can turn off push notifications in your device settings, and unsubscribe from the newsletter with the link in any of its emails.",
        "If you are in the EU or UK you also have the right to complain to your data protection authority. We would appreciate the chance to resolve it first.",
      ],
    },
    {
      id: "cookies",
      title: "7. Cookies and consent",
      paragraphs: [
        "The website uses essential cookies to keep you signed in and to complete checkout. Analytics cookies (Google Analytics 4 and PostHog) are set only after you choose “Accept analytics” in the banner; choosing “Essential only” keeps them off. You can change your choice later from the footer.",
      ],
    },
    {
      id: "children",
      title: "8. Age",
      paragraphs: [
        "Our trips and accounts are for adults. We do not knowingly collect data from anyone under 18. If a departure admits younger travelers with an adult, their details are entered by the adult who books.",
      ],
    },
    {
      id: "security",
      title: "9. Security",
      paragraphs: [
        "Data is encrypted in transit and at rest. Access to traveler details is restricted by role and by row-level security in our database: travelers see their own trip, staff see the trips they work on, and nobody else sees anything. Sensitive fields never appear in logs or error reports.",
      ],
    },
    {
      id: "transfers",
      title: "10. International transfers",
      paragraphs: [
        `${brand.legalName} is based in the United States and our trips run in Europe, so your data moves between the two: to hotels and rail operators in the countries you visit, and to processors that operate in the US or EU. We rely on their standard contractual safeguards and share only what each party needs.`,
      ],
    },
    {
      id: "changes",
      title: "11. Changes to this policy",
      paragraphs: [
        "We will post changes here and update the version and date at the top. If a change materially affects how we use your data, we tell you by email first.",
      ],
    },
    {
      id: "contact",
      title: "12. Contact",
      paragraphs: [`${brand.legalName}, trading as ${brand.name}. Email: ${brand.supportEmail}.`],
    },
  ],
};
