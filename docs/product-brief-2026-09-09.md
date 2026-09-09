# Product brief, 9 September 2026

Kyle's notes, sorted into what already exists, what is a real gap, and what needs a decision before
it can be built. Written so nothing in the brief gets lost, and so we do not rebuild things that
are already shipped.

## What he named as good, and is worth protecting

Minimal intervention as the concept. Meeting people before the trip and having somewhere to hang
out in the app. How easy it is to add activities. Everything organised while the days stay free,
especially around big or exclusive events.

Those are the things every decision below should serve.

## Already built, contrary to the brief

Worth knowing before commissioning any of it again.

| In the brief                   | Where it already is                                                                             |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| A map in the mobile app        | `apps/mobile/src/app/(tabs)/map.tsx`: hotels, route, group moments, recommendations and add-ons |
| Chatting with other users      | Group chat over Supabase Realtime, with rooms per trip and per activity, plus report and block  |
| Add-ons highlighted in the app | The Explore tab sells them, and they can be bought after booking from the account               |
| Payment tracking               | Deposit and balance exist with a due date; the account page pays the balance                    |
| Daily suggestions              | `recommendations`, curated per destination, surfaced in Explore                                 |

The gap in most of these is prominence and polish, not existence.

## Real gaps, in the order they are worth building

### 1. Free activities on every trip — the value proposition itself

Kyle's own framing: people at different income levels on one shared path, some in one hotel and
some in another, some on the yacht and some not, **but with things everyone does together and
nobody pays for.** A beach walk, a morning jog, a hike.

This is the mechanism that makes one group across tiers real rather than rhetorical. Without it the
Nice traveler and the Monte Carlo traveler share a chat room and nothing else.

Needs: free, optional, group-anchored activities on a departure, visible before booking as a reason
to come, and shown in the app during the trip.

### 2. Policy protection for what we do not control

If a traveler misses their flight, oversleeps for a transfer, or misses an add-on, that is not on
us. The Terms cover cancellation and refunds but do not say this plainly. It needs to be written
before the first departure, not after the first argument.

### 3. Calendar

The trip in a calendar view, and exportable to Google, Apple and anything else that reads an
`.ics` feed. Self-contained, high value, no dependency on anything else.

### 4. Surveys, before and after

Before, to learn what a traveler expects. After, for reviews and for iteration. The reviews table
already exists and is deliberately empty until real travelers write; a survey is the thing that
prompts them.

### 5. An AI companion in the app

Two shapes, and they share the same context:

- **A chatbot** that answers "where is good ice cream today?" using the traveler's schedule and
  location, and can add the answer to their calendar with a location.
- **An AI presence in the group chat** posting the free activity: "free hike today at 8am, this is
  the path, meet at the trailhead."

Both need the trip, the day, the position and the traveler's taste. Personal taste has to come from
somewhere: a short question set at booking, or inferred by the chatbot over time.

### 6. Live location and nearby suggestions

Show me on the map, and highlight what is good near me right now, filtered by what I like. Needs a
location permission story and a real recommendation source.

### 7. Add-on sourcing through an API

The same problem as hotels, solved the same way. Viator or similar for bookable experiences, behind
an adapter, so the extras catalog is not hand-built per departure. **Do this after the hotel
supplier is proven**, and reuse the contract: search, rates, recheck, book, cancel.

### 8. Coming back when not planning a trip

Airbnb lets people browse houses they will never book. We have nothing to do between trips. Options
worth weighing: saved trips and a wishlist, a feed of departures opening, alerts for a destination,
or the meetups that already exist made more prominent.

### 9. Marketing

There is no plan today. Social strategy, and a real one rather than a posting schedule.

## Decided, 9 September 2026

The three questions below blocked items 5, 6 and 8. Kyle answered them; the reasoning is kept so
the next person can argue with the decision rather than guess at it.

- **Our chat, not WhatsApp.** The group stays inside the product. It is the only place we have
  moderation, report and block; the only place an AI can post "free hike at 8am, meet at the
  trailhead"; and the only place the conversation can feed Live Moments and add-ons. The cost is
  real and accepted: people must open the app, and a quiet room feels quieter than a WhatsApp
  group. No WhatsApp bridge, no both — both fragments every trip in half.
- **Taste: explicit seed, behavioural refinement.** Ask first — the pre-trip survey and profile
  interests already collect it — then adjust from what a traveler actually opens. Explicit alone is
  dull and static; behavioural alone cold-starts badly, and day one of a first trip is exactly when
  suggestions matter most. Chat messages are **not** read for this.
  - Consequence worth noting before it is built: PostHog is analytics, not a system of record, so
    behavioural refinement needs first-party signals stored in Supabase. Nothing may depend on an
    analytics sink for a product decision.
- **The AI may answer, write to the traveler's own itinerary, and make free reservations. It may
  not spend money.** Reversible, personal writes are fine. Charging is not: Stripe is live, so a
  bug is a real charge, and anything that spends would need the hotel engine's
  recheck-before-charge discipline before it could be trusted.
  - Consequence worth noting: we have no reservation supplier yet. Until item 7 lands, "free
    reservations" can only mean drafting the request, not completing it.

## Order of work

Item 5, the AI companion, is next. Item 6 (live location and nearby) depends on its recommendation
source, and item 7 stays behind a proven hotel supplier.

## Still on the original list

The reskin, a designer, the logo and the typeface. Deliberately deferred until the systems
underneath are finished, which is the right order and is what the last week has been.
