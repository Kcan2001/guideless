# Growth: how Guideless sells the group

_Companion to docs/roadmap.md §4 Milestone 13 and docs/product.md. Everything here is public
behaviour a traveler can see; the mechanics live in migrations 029–031._

## The pitch in one line

Everything planned. Nothing forced. A group that meets on night one, no guide, and you pay only
for what you do.

## Event-anchored tours

`tours.kind = 'event'` with `event_name`, `event_starts_on`, `event_ends_on`, `event_location`.
The tour page renders an event hero (name, dates, location), a "Race weekend, your way" tier
menu (stay options × the mutually exclusive `tier_group` add-ons) and a schema.org `Event`
alongside the `TouristTrip`. The home page lists event tours in an "Event weekends" section.
First product: Monaco Grand Prix Weekend 2027 (seed `050_monaco_grand_prix.sql`) — Nice 3★ or
Monaco 5★, grandstand / terrace / yacht, welcome drinks Thursday.

## "Make it yours" on every trip

Tour and departure pages show, for the next open departure: stay tiers with per-traveler deltas,
add-ons with price, day, "N going" (`add_on_headcounts`, aggregate only) and availability, the
room rule, and a one-line referral hint. The room rule is derived from `quote_booking()` for one
traveler vs. two sharing, so the saving shown equals the saving charged.

Pricing rules the copy must never contradict:

- Base price is per traveler in their **own room**. Two travelers may share (never more) and each
  save the departure's `shared_room_discount_amount` (a tier may override it).
- Add-ons are optional, chosen at booking or later (even mid-trip, until each add-on's
  `bookable_until_days_before`), paid in full when chosen, never part of the deposit.
- Deposit + balance apply to the base trip; cancellation tiers are on the departure page.

## Roster stats (the purchase trigger nobody else shows)

`departure_roster_stats(departure_id)` is public and returns only aggregates: booked, solo,
pairs, groups of 3+, distinct nationalities, capacity, spots left, `groupOpensOn`, `groupOpen`.
Age range appears only with four or more booked travelers, rounded to 5 years, never individual
ages. Names, bookings and profiles are never exposed here. The departure page renders it as the
roster strip; the mobile app uses the same RPC before the group opens.

## The group opens on a date, not at booking

`departures.group_opens_days_before` (default 30; Monaco 45). `open_due_groups()` runs daily and
activates the trip (chat rooms, roster, Live Moments) once the departure is viable and the date
has arrived, then notifies members. Rationale: opening at booking would leave the first buyers
alone in an empty room.

## Referrals

- Every profile gets a `referral_codes` row (`GL-XXXXXX`) at creation.
- A friend enters the code at checkout: `referral_discount_percent` (system setting, default 5)
  off the **base** trip, shown as a quote line. Self-referral and unknown codes are rejected.
- When that booking is confirmed the referrer earns `referral_reward_amount` (default 7500 minor
  units = $75) as `account_credits`, applied automatically to their next quote. Refunded or
  cancelled bookings void the pending referral.
- Marketing surfaces only hint ("Booking with a friend's code? Enter it at checkout for 5% off");
  the code and balance live on the account page.

## Host program ("bring 8, travel free")

Public page `/host` explains the deal and collects `host_applications` (anonymous inserts allowed;
signed-in applicants are linked). Staff review at `/admin/hosts` (approve / decline, private
notes). Threshold: `system_settings.host_free_spot_threshold` (default 8). That table is
staff-only, so the public page uses the constant `HOST_FREE_SPOT_THRESHOLD = 8` in
`apps/web/lib/data/community.ts`; keep the two in sync. Rewards for hosts (`account_credits`
source `host_reward`) are granted manually by admins for now.

## City evenings (meetups)

`meetups` + `meetup_rsvps` (+ `meetup_rsvp_counts` view). Public list at `/meetups` grouped by
city with times in the meetup's own zone, detail at `/meetups/[id]` with Event JSON-LD, RSVP for
signed-in users (signed-out visitors are sent to sign in and come back). Staff create, publish and
see RSVPs at `/admin/meetups` (content or ops roles). Seeded: New York, London, Austin
(`060_meetups.sql`). Both routes are in the sitemap.

## Copy rules

Brand terms only: Your Trip, Your Route, Your Group, Live Moments, Included, Optional. Calm and
concrete; every optional thing says it is optional. Never "mandatory", never "tour guide".
