# Roadmap: from MVP to the product we are selling

_Written 2026-09-06 after Milestone 7. Companion to docs/product.md and the master spec
(§90–95). This is the plan for what comes next and why; it does not change anything already
shipped._

## 1. The proposition, stated plainly

Guideless sells **a group without a guide**. We book the hotels, the trains and one or two
anchoring moments (a welcome drink at 8 pm in Nice on day one). Everything else is optional and
visible: you can see who else is going, what they added on, and choose to join them or not.

The two examples that should drive every design decision:

- **Nice → Avignon → Paris, 1 November.** Welcome drinks at 8 pm in a bar in Nice. Some travelers
  added the boat trip for day two; the app shows "6 of your group are on the boat tomorrow". Others
  keep it cheap and just show up for drinks.
- **Monaco Grand Prix.** One group of ~50. Some in a Nice 3★, some in a Monaco 5★. A welcome
  drink brings everyone together; race viewing is a menu (grandstand, terrace, yacht), and couples
  meet couples, solos meet solos.

Those two examples need four things the MVP does not have yet: **add-ons with live pricing**,
**accommodation tiers inside one group**, **the group visible before the trip** and **a map**.

## 2. What exists today vs. what the pitch needs

| Area            | Shipped (M1–M7 + Live Moments + notifications)                                                                            | Missing for the pitch                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Marketing site  | Home, how it works, trips list with filters, tour detail with itinerary/FAQ/JSON-LD, destinations, departure page, OG/SEO | Add-on menu on the tour page, "who's going" signal, reviews, event-anchored landing pages (Grand Prix)                     |
| Booking         | 6-step wizard, seat holds, deposit or full payment, Stripe Checkout + webhook, balance payment, coupons table             | **Add-ons in the wizard with a live total**, accommodation tier choice, "my own room" / roommate matching, referral credit |
| Account (web)   | Bookings, pay balance, pre-trip checklist, trip dashboard `/trips/[id]`                                                   | Buy add-ons after booking, see the group roster before activation, manage traveler details inline                          |
| Mobile: trip    | Trip home (now/next), itinerary by day, item detail, hotel card, Explore recommendations, offline cache                   | **Map**, documents tab, add-ons ("Add to my trip"), tickets/vouchers                                                       |
| Mobile: group   | Group chat rooms, member list with opt-in profile fields, Live Moments (join/suggest), realtime                           | Opt-in interests + travel style on profiles, "I'm in" on optional activities, roommate pairing, photo sharing              |
| Mobile: support | Threads, staff replies, push for replies                                                                                  | Emergency card per destination (numbers, hospital, embassy)                                                                |
| Notifications   | Triggers + dispatcher (Expo push, Resend), lifecycle reminders, preferences                                               | In-app inbox screen                                                                                                        |
| Admin           | Tours/versions, departures, bookings, travelers, live itinerary, Live Moments, social queue, issues feed                  | Add-on catalog + manifests per add-on, stay-option capacity, group roster tools, referral/creator dashboard                |
| Data model      | Tours, versions, departures, bookings, travelers, trips (snapshots), groups, chat, moments, notifications, suppliers      | **`departure_add_ons` / `booking_add_ons`**, **`departure_stay_options`**, profiles interests, referrals, reviews          |

Spec §103 explicitly reserved room for add-ons, tiers and referral pricing; the data model
does not block any of this.

## 3. What competitors do (and what we take from each)

| Company                                                              | Model                                                                                                                                                                                                         | Take                                                                                                                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **WeRoad** (Airbnb-backed, €130M 2025)                               | Peer-aged "coordinator", not a guide. WhatsApp group opens 15 days before. Core logistics fixed; dinners and optional activities decided by the group. ~60% repeat rate. WeMeet city events feed acquisition. | Open the group **before** the trip. Indicative add-on prices at booking, confirmed later. Local meetups as a funnel. Repeat rate is the business.   |
| **Flash Pack** (30–49, premium)                                      | Max 16, guided, boutique hotels, "curated add-ons" from cooking classes to yoga. Sells group chemistry; 80% of groups stay in touch.                                                                          | Sell the friendships, not the itinerary. Keep the add-on list short and curated.                                                                    |
| **Contiki** (18–35)                                                  | "Free Time Add-Ons" listed with approximate prices ~21 days out in My Contiki; paid in the first days of the trip; 48h cancellation. Festival trips (Oktoberfest) as event anchors.                           | An add-on window and cancellation rule per add-on. Event-anchored departures sell themselves.                                                       |
| **G Adventures / Intrepid**                                          | No single supplement (same-sex twin share), "My Own Room" as a paid add-on. Single supplements modeled as departure add-ons in their API.                                                                     | Roommate matching by default, private room as an add-on, both first-class in the data model.                                                        |
| **TrovaTrip**                                                        | Creators host trips; host travels free and keeps a cut; operator runs logistics.                                                                                                                              | A host/ambassador program: "bring 10, travel free" fills a departure and seeds its social core.                                                     |
| **JoinMyTrip / Unite Strangers**                                     | Peer-hosted trips with strangers; identity verification; accept/decline travel buddies.                                                                                                                       | Trust signals on the roster (verified, trips completed) before people commit.                                                                       |
| **Grand Prix operators** (Roadtrips, GP Grand Tours, F1 Experiences) | Packages from ~$8,895 pp; 3–5★ in Monaco or cheaper in Nice; race viewing tiers from grandstand to circuit-berthed yacht; sold as luxury, no community.                                                       | Our angle: same weekend, tiered stays and viewing as add-ons, **one group** across tiers, half the price for the Nice tier. Nobody sells the group. |

Nobody in this list sells "the group, without a guide, pay only for what you do". Guided
operators charge for the guide; peer-hosted platforms have no logistics muscle. That gap is the
positioning.

## 4. Product plan

### Milestone 9: Add-ons with live pricing (the boat)

Backend

- `departure_add_ons`: departure_id, title, description, kind (`activity` | `transfer` |
  `ticket` | `dinner` | `room_upgrade` | `extra_night`), price_amount, currency, pricing basis
  (`per_traveler` | `per_booking`), capacity (nullable), sales window (`bookable_from`,
  `bookable_until`, default: until 48h before start), cancellation rule, linked
  `tour_itinerary_item_id` / day + time, `supplier_service_id`, visibility, position, is_active.
- `booking_add_ons`: booking_id, add_on_id, traveler_id (nullable for per-booking), quantity,
  unit_price snapshot, status (`reserved` | `confirmed` | `cancelled` | `refunded`), payment link.
- `quote_booking(departure_id, traveler_count, add_on_selection[], coupon_code)` SQL function:
  the **only** place a total is computed (base × travelers − coupon + add-ons, deposit rule,
  due-now). Web calls it for the live total; `create_booking()` calls it again and stores the
  snapshot, so the client can never invent a price. Capacity per add-on enforced in the same
  transaction as the seat hold; add-on holds release with the booking hold.
- RLS: add-ons public-read for open departures (`*_public` view without supplier cost); customers
  read their own `booking_add_ons`; staff manage.
- pgTAP: quote math, add-on capacity, hold release, per-traveler vs per-booking.

Web

- Tour page and departure page: "Make it yours" section listing add-ons with prices and the day
  they happen.
- Wizard: new step **Add-ons** between Travelers and Preferences; per-traveler toggles; sticky
  price summary with running total, deposit, and "due today" updated on every change (server
  quote, debounced, optimistic UI). Stripe line items mirror the quote.
- Account: "Add to your trip" after booking (second Checkout, same webhook path as the balance
  payment); add-on list per booking with cancel-by dates.
- Admin: add-on CRUD on the departure, capacity, manifest per add-on (who is going, dietary,
  supplier confirmation), export.

Mobile

- Add-ons appear as **optional itinerary items** on their day with an "Add" button (opens the
  web Checkout in an in-app browser; native IAP is not appropriate for travel). Once the trip is
  active: "6 of your group are doing this" from `booking_add_ons` counts, joined into the
  existing Live Moments list.

Definition of done: a traveler adds the Nice boat during checkout, sees the total change before
paying, and the next morning sees who else is on the boat.

### Milestone 10: Stay your way (accommodation tiers)

- `departure_stay_options`: departure_id, name ("Nice, 3★ near the port" / "Monaco, 5★"),
  hotel (`accommodations` rows per night), price_delta_amount per traveler, capacity, room types
  (twin share / private), is_default. Booking stores `stay_option_id`; `quote_booking()` adds the
  delta; itinerary per traveler shows **their** hotel while the group stays one group.
- Roommate matching: `room_preference` already exists; add "match me with a same-gender
  roommate" vs "private room" (a `room_upgrade` add-on). Admin rooming tool on the trip page.
- Event tickets as `ticket` add-ons with tiers (grandstand / terrace / yacht). This is the
  Grand Prix product.

### Milestone 11: The group before the trip

- Open **Your Group** at booking, not at activation: a pre-trip room per departure (chat rooms
  keyed by departure until the trip snapshot exists, then migrated), so people meet weeks early
  as WeRoad does.
- Roster on web and mobile: "14 booked · 6 solo · 4 couples · from 5 countries", opt-in profile
  fields (interests, travel style, languages, "open to sharing a room"). Trust signals: verified
  email + phone, trips completed.
- The **welcome event** is a first-class itinerary item type (`welcome`) rendered as the trip's
  anchor on every surface, with an "I'll be there" count.
- "I'm in" on optional activities and Live Moments feeds the social signal above.
- Referral credit: `referrals` table, code per customer, credit applied through `quote_booking()`.
  Post-trip: review request + photo sharing (Phase 2 in the spec).

### Milestone 12: Mobile for the trip you already booked

- **Map tab** (`react-native-maps` / Apple + Google): hotels, itinerary items, recommendations,
  Live Moment meeting points, the welcome bar; "walk there" opens native maps. Day filter.
- **Documents tab**: tickets, vouchers, hotel confirmations (`trip_documents` exists).
- Notification inbox; emergency card per destination; itinerary by date polish (collapsible days,
  "today" auto-scroll already exists as NOW/NEXT).
- EAS development build, first device run, App Store / Play listing with the new assets.

### Milestone 13: Selling it

Positioning: **"Everything planned. Nothing forced."** Same route as a guided tour, a group that
meets on night one, and no guide, no bus, no headset, so it costs less and you pay only for what
you do.

1. **Event-anchored departures.** Monaco GP, Oktoberfest, Tour de France stages, Cannes, Christmas
   markets, New Year in Paris. Events supply the date, the demand and the story; we supply the
   group and the logistics. Landing page per event with the tier menu and "who's going" counter.
2. **Show the group before they buy.** Anonymized roster stats on the departure page
   ("11 booked · ages 27–41 · 5 solo"). This is the purchase trigger nobody else shows.
3. **Add-on transparency as a marketing asset.** A "what will it really cost" page: base price,
   typical add-ons, what people actually spent last time. Contrast with all-inclusive guided tours.
4. **Solo-first pricing.** No single supplement with roommate matching; private room as an add-on.
   Solos are the majority of the social-travel market and the easiest to reach.
5. **Host / ambassador program** (TrovaTrip model): bring 8–10 travelers, travel free, host the
   welcome drink. Creators, running clubs, alumni groups, company social committees.
6. **Referral credit** on every confirmation and post-trip email; make it meaningful (a fixed €75
   on a €1,200 trip, not 5%).
7. **Repeat rate is the business.** WeRoad's ~60%: post-trip recap ("your group did 14 things"),
   early access to the next departures for alumni, alumni-only Live Moments in cities.
8. **Local meetups as a funnel** (WeRoad's WeMeet): one evening a month in launch cities with
   past and prospective travelers. Cheap, on-brand, converts.
9. **Content that shows the freedom**: day-in-the-life reels, "three people, three different
   days in Avignon". The Instagram pipeline (docs/marketing.md) already exists; feed it with
   traveler-submitted photos (Milestone 11).
10. **Trust surface**: reviews with trip context, verified travelers, clear cancellation tiers
    (already public on the departure page).

Metrics (spec §102): booking conversion, **add-on attach rate**, roster views → booking,
group-chat activity before departure, Live Moment participation, repeat booking, referral rate.

## 4b. Status (2026-09-06)

Milestones 9–13 started the same day: schema, pricing function, seeds and pgTAP for add-ons,
stay tiers, rooms, referrals, roster stats, group opening, host program and meetups are in
(`docs/pricing.md`); web checkout, account, admin catalog, marketing pages and the mobile map /
documents / inbox followed in the same commit series. Decisions taken: add-ons are paid at booking
and can be added any time, even mid-trip; the group opens a set number of days before departure
(`group_opens_days_before`, default 30) rather than at booking; every traveler has their own room
unless two on one booking choose to share (two per room maximum); the first two products are the
Monaco Grand Prix weekend and the Nice → Avignon (wine) → Paris route.

## 5. Sequencing and effort

| Order | Milestone                                       | Depends on | Rough effort | Why this order                                                |
| ----- | ----------------------------------------------- | ---------- | ------------ | ------------------------------------------------------------- |
| 1     | 9 Add-ons + live pricing                        | —          | 2–3 weeks    | Core of both examples; unlocks revenue per traveler           |
| 2     | 10 Stay options + tickets                       | 9          | 1–2 weeks    | Makes the Grand Prix product sellable                         |
| 3     | 11 Group before the trip                        | —          | 2 weeks      | The differentiator; needs no add-on work but benefits from it |
| 4     | 12 Mobile map, documents, device                | —          | 2 weeks      | Completes the in-trip promise; can run in parallel with 9–10  |
| 5     | 13 Selling: event pages, referral, host program | 9, 11      | ongoing      | Needs prices and roster to show                               |

Effort assumes one engineer with the current codebase and conventions (migration → RLS → pgTAP →
service → web → mobile → docs).

## 6. Decisions needed before Milestone 9

1. **Are add-ons paid at booking or on the trip?** Recommendation: paid at booking (or later
   from the account) through Stripe, with a per-add-on cancellation deadline. Contiki collects
   on day one; WeRoad on location. Paying in-app keeps ops out of cash handling and gives the
   social signal early.
2. **Do add-ons count toward the deposit?** Recommendation: no; add-ons are charged in full at
   selection, the base trip keeps deposit + balance.
3. **Group opens at booking or at activation?** Recommendation: at booking, with a staff-posted
   welcome message and the roster stats; activation still snapshots the itinerary.
4. **Single supplement policy.** Recommendation: none; twin share by default with matching, private
   room as an add-on priced by the hotel delta.
5. **First event departure to build around.** Recommendation: Monaco GP 2027 (6 June) with two
   stay tiers and three viewing tiers, because the tier menu is the whole product in one page.
