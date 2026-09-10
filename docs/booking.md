# Booking — the Trip Builder

_Milestone 2 of plan v2 (`docs/guideless_travel_master_plan_v2.md` §13–20). Pricing rules live in
`docs/pricing.md`; this document is about the flow._

## Route

`/tours/[slug]/build?departure=<id>&step=<key>&cancelled=1`

- `departure` picks the dates; absent or unknown, the next open departure is used. Choosing other
  dates on the first step reloads the page with that departure's stay tiers and add-ons.
- `step` resumes a step (`dates | stay | race | experiences | transfers | travelers | review |
payment`); unknown values fall back to the first step.
- `cancelled=1` is Stripe's cancel URL; nothing was charged and the draft is intact.
- `/checkout/[departureId]` (the pre-builder wizard) permanently redirects here with its query.
  `/checkout/[departureId]/confirmation` is unchanged and is still Stripe's success URL.

The page is `noindex`. Server side it loads the tour, departures, `listDepartureExtras`, the
signed-in user and their saved draft, derives the step list and renders the client `TripBuilder`.

## Steps

Derived by `lib/bookings/builder-steps.ts` from what the departure actually offers:

| Step        | Present when                          | Question                                                           |
| ----------- | ------------------------------------- | ------------------------------------------------------------------ |
| dates       | always                                | When do you want to go? (+ how many)                               |
| stay        | ≥ 1 stay option                       | Where do you want to stay?                                         |
| race        | an add-on has a `tier_group`          | How do you want to watch _\<event\>_?                              |
| experiences | an add-on without tier group/transfer | What do you want to add?                                           |
| transfers   | an add-on of kind `transfer`          | How do you want to get from the airport?                           |
| travelers   | always                                | Who’s traveling? (names, rooms, contact, preferences, friend code) |
| review      | always                                | Almost there. (sign in, terms)                                     |
| payment     | always                                | Review and pay.                                                    |

The traveler count is asked on the dates step so per-traveler add-ons can be chosen before names
are typed. Adding or removing travelers later re-fits rooms and selections
(`fitRooms` / `fitSelection`).

## Draft and resume

`components/builder/draft.ts` defines the draft: choices only, never money. It is saved to
`sessionStorage` on every change for everyone, and for signed-in travelers to `builder_drafts`
(one row per user and departure, owner-only RLS) through `lib/bookings/drafts.ts`, debounced 1.5 s.
On load the newer of the two wins, so a trip started on a phone continues on a laptop. The
confirmation page clears both. The payload is validated with `builderDraftSchema` and capped at
32 KB.

## Quote

One `useBookingQuote` in `TripBuilder` calls `quote_booking()`; `QuotePanel` renders it as the
desktop sidebar and the mobile sheet (`SummaryBar`). Sections: Included, Your choices, Total,
Deposit today, Balance. The client never computes money.

## Friend / group code

`GroupCodeField` on the travelers step validates a code live through `check_group_code(code,
departure_id)` and shows "Joins Kyle’s group · 3 already in". The code is passed to
`create_booking(... p_group_code)` by `startCheckout`. On `/account`, `GroupCodeCard` shows each
booking's own code (`create_group_code`, idempotent) with copy and share. Money is never shared
across bookings; the code only links group membership. Codes are validated with `groupCodeSchema`
on both sides.

## Payment hand-off

Unchanged: `startCheckout` validates, creates the booking with a 30-minute hold, opens Stripe
Checkout and redirects. The cancel URL now returns to the builder. The webhook remains the only
thing that marks a booking paid.

## Analytics

`departure_selected`, `builder_started`, `builder_step_viewed`, `stay_selected`,
`race_option_selected`, `addon_viewed`, `add_add_on` / `remove_add_on`, `quote_updated`,
`group_code_entered` (valid flag only), `start_checkout`, `begin_payment`, `purchase`,
`post_booking_addon_viewed` / `_added`. Ids and amounts only.

## Tests

- `lib/bookings/builder-steps.test.ts` — step derivation and navigation.
- `e2e/checkout.spec.ts` — sign up → builder → payment step, refused cleanly without Stripe; the
  old checkout URL forwards.
- `e2e/marketing.spec.ts` — "Build my trip" CTAs point at the builder.

## The day plan (migrations 0073–0074)

The builder's optional extras used to be three consecutive steps — race views, then experiences,
then transfers. Kyle, looking at the Monaco builder: _"The addons need to be presented as each day
... they can pick multiple per day, or if an option is two days (sat + sun) they elect it once and
it's highlighted for both days."_ Three menus asked a traveler to rebuild a five-day race weekend
in their head, and it hid the fact that a Friday choice and a Sunday choice were never in
competition.

They are now one **Your days** step laid out as the trip's diary. Every day of the departure
appears in order with its itinerary title and destination, and a day with nothing to sell says so
rather than being dropped — the numbering has to match the itinerary the traveler was shown.

Two schema facts make it work.

- **`end_day_number`** gives an option a span. "Grandstand K (three-day pass)" is days 3–5;
  "Terrace with lunch (Sat + Sun)" and "Amber Lounge yacht, both days" are 4–5. Before this they
  all sat on a single day, so a traveler reading Sunday saw no grandstand and concluded they had
  none. The option is selectable on the first day of its span and appears on the rest as a strip
  saying it already covers that day. Every real case is contiguous, so a second integer is enough
  and an array would answer a question nobody is asking.
- **A conflict is a `tier_group` _and_ an overlapping day.** It used to be the group alone, so
  choosing Friday's grandstand made Sunday's yacht unselectable — the builder would not let you
  watch two days of a three-day race weekend. Now Saturday's yacht and Sunday's yacht are two
  separate choices, and the three-day pass correctly blocks all three days. Anything with no
  `tier_group` never conflicts, which is what lets somebody take the coast boat at ten, the
  grandstand at three and the harbour party at nine.

`quote_booking()` is still the authority and re-checks every conflict on the server; the client
rules in `lib/bookings/add-on-days.ts` exist so a traveler is stopped before the request, not
after. A blocked card names what is blocking it rather than just going grey.

Within a day, options run in the order they happen; anything untimed sinks to the end. Every
option renders through the same `OptionCard`, and migration 0074 gave the two Monaco add-ons that
had no photograph one and split the three yacht options off their shared lead image, so the day
plan reads as distinct products rather than one repeated.
