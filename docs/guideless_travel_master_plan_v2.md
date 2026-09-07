# Guideless Travel — Product, UX & Architecture Plan v2

_Master brief for Claude Code. September 7, 2026. Supplied by Kyle; kept verbatim apart from
Markdown formatting. The implementation audit that answers §55 lives in `docs/plan-v2-audit.md`._

## 1. Executive decision

**Do not rebuild the existing platform. Evolve it.**

The current repository already has the core stack and much of the required functionality: public
site, trip pages, a seven-step booking flow, database-backed quotes, inventory holds, deposits/full
payment, add-ons, Stripe Checkout/webhooks, customer accounts, admin tools, an Expo app,
itinerary/maps/chat/Live Moments/support, analytics, RLS, email and monitoring.

The next phase is primarily a **product, UX, conversion and inventory-integration upgrade**.

Recommended stack remains: Next.js + TypeScript + App Router; Supabase + PostgreSQL + RLS; Next.js
Server Actions/Route Handlers + Supabase Edge Functions where appropriate; Stripe; React Native +
Expo; Vercel; GA4 + Consent Mode + PostHog + Firebase Analytics; Sentry; Resend.

Do not introduce microservices.

## 2. What Guideless actually sells

Guideless is not a traditional guided tour. It is **organized travel for people who don't want to
be on a guided tour.**

Guideless handles the annoying, coordination-heavy parts: hotels, trains/transportation between
destinations, selected experiences, airport/local transfers, included group moments, itinerary,
maps, recommendations, support, social connection with other travelers.

The traveler retains: their own flights when appropriate, their own free time, their activity
choices, their accommodation tier, their race/event choices, whether they participate in group
moments.

Core promise: **Everything planned. Nothing forced.**

Consumer-facing positioning: **Travel with a plan. Not a tour guide.**

Supporting: _Hotels, transportation, experiences and a group are organized for you. Explore
independently, meet people when you want, and build the trip you actually want to take._

## 3. The competitive lesson

**Amber Lounge** sells prestige, heritage, exclusivity, hospitality and access. Learn: lead with the
experience, editorial photography, make options tangible, communicate genuine scarcity, explain
exactly what is included. Do not copy: luxury-only positioning, opaque enquiry-first purchasing,
sales-team dependency.

**Senate Grand Prix** uses a package catalog with clear starting prices, named packages,
accommodation choices, multiple viewing options, partner/trust signals. Learn: make choices obvious,
make differences easy to compare, show prices early, use credibility signals.

**Go Privilege** explains hospitality products in detail. Learn: every Guideless paid option needs
(1) what is it (2) when (3) where (4) how long (5) who is it for (6) what's included (7) what's not
(8) where it fits in the itinerary (9) capacity (10) cancellation/change rules.

**EF Ultimate Break** is the strongest marketing reference: aspiration, social proof, destinations,
itinerary, accommodation, optional excursions, traveler photos, reviews, flights, FAQ, support, app
connectivity, customization. "We plan, you pack." Borrow the marketing structure, not the guided-tour
model. Guideless equivalent: **We plan the hard parts. You choose the rest.**

## 4. Why someone should book Guideless instead of doing it themselves

This must become the center of the homepage.

1. **We remove coordination** — hotel location, inter-city travel, reputable activities, group
   coordination, daily plan, confirmations, who to contact.
2. **You don't lose independence** — no guide, no bus, no mandatory meals, no rigid schedule.
3. **You can configure the trip** — hotel, room, event ticket, experiences, transfers, meals,
   upgrades.
4. **You can add things later** — boat, dinner, race upgrade, transfer, extra night, experience;
   even while traveling, subject to availability.
5. **You travel independently without being alone** — group access, pre-trip chat, member profiles,
   optional meetups, welcome drinks, optional group experiences.

## 5. Homepage redesign

**Hero.** Large real travel image/video. Headline: _Travel with a plan. Not a tour guide._
Subheadline: _Hotels, transportation, experiences and a group are organized for you. Explore
independently, meet people when you want, and build the trip you actually want to take._ Primary
CTA: Explore trips. Secondary: How Guideless works. Do not make "minimal intervention travel" the
main headline.

**The problem.** _You want to travel. You don't want to plan every damn thing._ Three-way compare:
Book everything yourself / Traditional group tour / Guideless.

**Why Guideless.** Four editorial blocks: Your trip, your choices · Travel with people, not a tour
group · Everything lives in the app · Keep adding to your trip.

**Show the actual app.** _Your entire trip. In your pocket._ Real screenshots: Today, Itinerary, Map,
Group, Add an experience, Support. No fake generic phone mockups.

**Show the configurator.** _Start with a trip. Make it yours._ Example: Monaco Grand Prix — Base
$1,890 · Nice hotel Included · Grandstand K +$1,290 · Friday boat +$210 · Airport transfer +$120 ·
Total $3,510. CTA: Build this trip.

**Independent, not alone.** Group chat, welcome drinks, optional dinner, boat group, member count,
meetup.

**Trips.** Editorial cards: image, destination, title, dates, duration, group size, starting price,
next departure, availability.

**Trust/social proof.** Until real reviews exist: founder story, legitimate beta feedback, actual
photography, transparent philosophy. **Never invent reviews.**

**FAQ.** Is there really no guide? Am I traveling alone? Group size? What is included? Own flights?
Choose hotel? Add experiences later? Pay separately from friends? Couples? Changes? Problems? The
app? When does chat open? Group activities mandatory? Ages? Insurance? Extend?

## 6. Website information architecture

Public: `/`, `/trips`, `/tours/[slug]`, `/tours/[slug]/build`, `/destinations`,
`/destinations/[slug]`, `/how-it-works`, `/why-guideless`, `/about`, `/journal`, `/faq`, `/contact`,
`/reviews`, `/group-travel`, `/terms`, `/privacy`, `/cancellation`, `/travel-insurance`.

Customer: `/account`, `/account/trips/[id]`, `/account/trips/[id]/add`,
`/account/trips/[id]/payments`, `/account/profile`.

Admin: tours, versions, departures, bookings, travelers, groups, inventory, hotels, experiences,
suppliers, itinerary, Live Moments, support, payments, content, analytics.

## 7–12. Monaco Grand Prix page

New hero: _The Monaco Grand Prix. Your way._ Sub: _Stay in Nice or Monaco. Choose your race view.
Meet the group. Explore the Riviera on your own terms._ Facts: Jun 3–7, 2027 · 5 days · 12–50
travelers · from $1,890. Primary: Build my trip. Secondary: See itinerary.

Immediately show the value: base trip includes accommodation, Nice ↔ Monaco train pass, welcome
drinks, Guideless app, group access, trip support. Then: _Add only what you want._

Comparison block: Traditional Monaco package (one large package) vs Guideless (start with
essentials; choose where you stay, how you watch the race, which experiences, transfers, group
moments).

Accommodation as tier cards — VALUE Nice ("Spend less on the room. Spend more on the weekend."),
PREMIUM Monaco ("Wake up in the middle of the action."), LUXURY Monaco only if real inventory
exists. Show hotel example, neighborhood, station distance, train time, breakfast, room type,
photos. Do not call something "5★" without a real property/rate behind it.

Race options as experiences: Grandstand K $1,290/person (section, view, days, seating, location,
transport, restrictions, availability); Harbour Terrace $3,490; Yacht $5,950 (yacht, viewing, food,
drinks, transfer, exact day).

"Add later": _Not sure yet? That's fine. Reserve your trip now and add experiences later from your
account or the Guideless app, subject to availability._ On the trip page and in the builder.

## 13–18. Trip Builder

Configure a trip, not fill out a checkout form. URL `/tours/monaco-grand-prix/build`. Desktop: main
selection area + persistent right-side trip summary. Mobile: selection screen + sticky bottom total +
expandable summary.

Steps: Dates · Stay · Race · Experiences · Transfers · Travelers · Review · Payment. Human
language ("Where do you want to stay?"). Not a huge form.

Persistent price summary with Included / Your choices / Total / Deposit today / Balance.

Rich add-on cards: name, price/person, day and time, route, description, includes, not included,
"8 people from your group are going", photos, map, duration, capacity, cancellation terms, age
restrictions, meeting point.

Social information: aggregate, real counts only ("12 people in your group have added this", "Most
travelers choose Grandstand K"). Never fabricate scarcity or social proof.

Why an option costs more: every upgrade explains the price difference.

## 19–22. Payment and group model

Hierarchy: Tour → Departure → Group → Booking → Traveler(s). Two friends can join the same departure
with completely separate bookings. Never model a group as one financial booking.

Friend/group code ("Join a friend's trip", e.g. `KYLE-MONACO-27`) attaches the traveler to the same
departure/group; influences membership, chat, room coordination, shared-activity visibility; each
booking stays financially independent.

Multiple departures per tour ("Choose your departure": date, capacity, price, remaining).

Extend your trip: extra nights, pre/post destination, extra activities — first-class domain concept.

## 23–28. Pricing, products, inventory, status, snapshots, versioning

Database authoritative. Selection → server quote → pricing engine → Postgres → validated quote.
Final: configuration → revalidate inventory → authoritative quote → Stripe Checkout → webhook →
confirmed booking. Never calculate the final amount only in React.

Generic product model, categories: accommodation, transportation, transfer, experience,
event_ticket, dining, group_moment, upgrade, extension, insurance, other. Each product: variants,
price, inventory, availability, booking rules, cancellation rules, date, itinerary association.

Inventory with holds for scarce items (race seats, rooms, boats, private transfers): Select → Hold →
Countdown → Checkout → Confirm; expired/failed holds released.

Booking status: draft, pending_payment, payment_processing, confirmed, balance_due, paid, cancelled,
refunded, partially_refunded, completed. Stripe webhook authoritative for payment status.

Purchased-item snapshots (name, description, price, currency, supplier) for hotel, room, ticket,
experience, transfer, transportation. Tour versioning; historical departures never mutate.

## 29. Database domain model (target list)

users, profiles, roles · tours, tour_versions, departures, groups · bookings, booking_travelers,
travelers · itinerary_days, itinerary_items · products, product_variants, product_options,
inventory, inventory_holds · quotes, quote_items, booking_items · hotels, hotel_rooms,
hotel_supplier_mappings, hotel_rates · experiences, experience_variants · transportation, transfers
· payments, refunds · support_threads, support_messages · group_members, group_messages ·
live_moments, live_moment_attendees · notifications, documents · reviews, photos · audit_logs.

Do not destroy existing schema/data simply to match this list.

## 30–34. Hotel API strategy

Curated selection per destination and tier (2–4 approved hotels each); supplier APIs feed
availability/rates behind the scenes. Hotel supplier APIs → normalization layer → Guideless hotel
catalog → curated properties/tiers → Trip Builder.

Suppliers: Expedia Rapid Lodging (live rates, 700k properties, shop/price-check/book); Duffel Stays
(search → rates → quote → book; clean TypeScript flow); Booking.com Demand (managed-affiliate access
required — do not block MVP on it); Hotelbeds (B2B scale later).

```ts
interface HotelSupplier {
  searchHotels(input: HotelSearchInput): Promise<HotelSearchResult[]>;
  getHotelDetails(id: string): Promise<HotelDetails>;
  getRates(input: HotelRateInput): Promise<HotelRate[]>;
  revalidateRate(input: RevalidateInput): Promise<ValidatedRate>;
  book(input: HotelBookingInput): Promise<HotelBookingResult>;
  cancel(input: HotelCancellationInput): Promise<CancelResult>;
}
```

Rate lifecycle: cached rate in builder → refresh exact rate on select → quote → checkout → final
validation → book. Store supplier, property id, rate id, currency, amount, taxes, fees,
cancellation policy, fetched_at, expires_at, occupancy, rooms, check-in/out. Never trust a cached
rate at final payment.

Experiences: direct/contracted suppliers first; marketplace providers (Viator, GetYourGuide,
Hotelbeds Activities) later through an abstraction. Curation is the value.

## 35–44. Mobile app

Tabs: Today · Trip · Explore · Group · Support. Home answers "where am I, what's next, what can I
do". Live Moments kept (temporary, time/location-specific, optional; RSVP, count, map, push,
optional thread). Chat split: departure chat / activity chat / support chat (never mixed). Privacy
controls: display name, photo, bio, optional home city, who can message, member-list visibility;
never expose email, phone, payment, passport, private booking details. Contextual support (traveler,
trip, departure, day, booking, hotel, next activity, payments, supplier confirmations). Operational
updates with push + in-app + email. Pre-trip group opens 30–60 days before ("Your group is
forming"). Group onboarding questions (first name, photo, traveling from, excited about,
solo/couple/friends, interests). Post-trip: review, photos, recap, group stays open, referral, next
trip.

## 45–46. Analytics

Keep GA4 + Consent Mode + PostHog + Firebase. Add: tour_view, departure_selected, builder_started,
builder_step_viewed, hotel_selected, race_option_selected, addon_viewed, addon_added, addon_removed,
quote_updated, checkout_started, payment_started, booking_completed, post_booking_addon_viewed,
post_booking_addon_added. Include tour_id, departure_id, price, source, campaign, device,
configuration. Funnel: Homepage → Trip page → Build trip → Builder started → First selection →
Checkout → Payment → Booking, visible in admin.

## 47–51. Design system

Palette: Guideless Navy #071C25 · Deep Ocean #0B3440 · Aqua #22D6C5 · Cyan #24B9E8 · Mint #5BE0B1 ·
Warm Off-White #F3F2EC · White · Soft Gray #E8E8E3 · Text Gray #4C575B. ~70% warm white / 20% navy /
10% accent. Headings DM Sans or Manrope, body Inter (alt: Instrument Sans + Inter). Editorial,
modern, premium, adventurous, human, travel-magazine. Avoid gradients, glassmorphism, neon, pill
buttons, floating rounded-card grids, AI illustrations, stock-looking imagery. Photography dominates.
Builder: warm-white background, navy type, thin borders, strong selected state (navy border + aqua
indicator), sticky total, large images, comparison. Manual admin labels: BEST VALUE, MOST POPULAR,
SOCIAL, LUXURY. No AI recommendations yet.

## 52–53. Phase plan

1. **Positioning and marketing** — homepage, navigation, Why Guideless, How It Works, Group Travel,
   stronger Monaco page, FAQ, real app screenshots, visual system. Goal: a stranger understands the
   reason to book in 10 seconds.
2. **Trip Builder** — dedicated builder, stay/race/activities/transfers/travelers, group code, live
   quote, desktop summary, mobile sticky price, save/resume, checkout.
3. **Inventory** — supplier abstraction, Expedia Rapid/Duffel proof of concept, hotel catalog, live
   rates, price validation, booking, cancellation mapping.
4. **Mobile** — Today, Trip, Explore, Group, Support, push, offline itinerary, add-ons, Live Moments.
5. **Operations** — supplier console, manifests, rooming, inventory management, alerts, itinerary
   changes, reconciliation.
6. **Growth** — verified reviews, traveler photos, referral, destination SEO, journal, social,
   repeat-traveler recommendations.

## 54. Claude Code operating rules

Inspect before coding; audit first. Do not rewrite working systems without justification. Preserve
data. Reuse quote/payment logic; no pricing in React; DB/server authoritative for price; Stripe
webhook authoritative for payment. Supplier credentials and service-role keys server-side. Maintain
RLS. TypeScript strict. Reusable components. No generic AI visual design; real photography. Never
fabricate reviews, inventory or scarcity. No microservices. Incremental migrations. Tests around
pricing and booking. No AI for its own sake. Curated, not algorithmic.

## 55. First Claude prompt (this is the step being executed now)

Read the spec. Inspect the repository, schema, public site and Expo app. Do NOT start coding.
Produce an implementation audit: existing functionality, reusable components, existing database
structures, existing booking/quote logic, existing mobile functionality, gaps against this spec,
required migrations, required APIs/integrations, UI changes, risks, recommended order. The existing
seven-step checkout is valuable; evolve it into the Trip Builder. Pay particular attention to
homepage positioning, Monaco trip page, trip configuration, independent payment within shared
groups, post-booking add-ons, live hotel pricing, mobile/app integration. After the audit, propose
the first implementation milestone only. Wait for approval before implementing.

## 56–58. Follow-up prompts

- **Homepage:** implement the redesign; do not modify booking logic; real photography; design
  system; identify reusable components first.
- **Monaco Trip Builder:** reuse quote engine, holds, booking logic, Stripe; support departure
  selection, accommodation, race, activities, transfers, travelers, friend/group code, live quote,
  desktop summary, sticky mobile summary, deposit/full, save/resume, post-booking add-ons.
- **Hotel suppliers:** abstraction; prototype Duffel Stays and Expedia Rapid; normalize; search,
  details, rates, price validation, booking, cancellation; supplier ids separate from Guideless ids;
  rate expiry and cancellation rules; never trust cached prices at payment; compare existing schema
  first and recommend only necessary migrations.

## 59. Final product experience

Monaco Grand Prix. 5 days. 12–50 travelers. From $1,890. Stay in Nice or Monaco. Choose your race
view. Join a boat. Meet the group. Explore the Riviera. **Build your trip →** … pay a deposit …
"Your trip is 45 days away" … in the app: itinerary, hotel, trains, race ticket, group, chat,
recommendations … "12 people from your group are meeting at 11:30. Want to join?" — Join.

Not a tour. Not a generic travel marketplace. Not a hotel booking engine. A travel operating system
for people who want the logistics handled without having someone tell them what to do.
