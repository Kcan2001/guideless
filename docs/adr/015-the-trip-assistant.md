# ADR-015: The trip assistant, and what it is not allowed to do

Date: 2026-09-09
Status: Accepted

## Context

Brief item 5 (docs/product-brief-2026-09-09.md) asked for two things that share a context: a
chatbot that answers "where is good ice cream today?" from the traveler's schedule and location,
and an AI presence in the group chat posting the free activity.

Guideless sells free time. The days are deliberately unplanned, and the product's whole claim is
that a traveler is organised without being herded. The assistant is the first thing we have built
that could fill that free time on the traveler's behalf — which makes its boundaries more important
than its capabilities.

Three decisions were taken before any of it was designed, and are recorded with their reasoning in
the brief: our own chat rather than WhatsApp; taste asked first and refined from behaviour; and an
assistant that may write to a traveler's own itinerary but may never spend money.

## Decision

**It runs in the web app, not in a Supabase Edge Function.** The places and reservation adapters are
TypeScript service modules that the rest of the web app already uses. A Deno copy in an Edge
Function would be a second implementation of one contract, and two implementations of a contract
drift. The mobile app calls the same `/api/ai/chat` route with its Supabase access token as a
bearer, and row-level security applies identically.

**The context is built by RLS.** The assistant is given a context assembled as the signed-in
traveler. That is the security model, not an implementation detail: there is no prompt a traveler
could write that would make it describe someone else's booking, because the words for it were never
in the context. Nothing staff-only ever enters — no supplier cost, no internal note.

**Three sources, always distinguished.** Our curated recommendations, a live places lookup, and the
model's own general knowledge. The system prompt requires it to say which one an answer came from
and to refuse to invent a name, an address, a price or an opening time. A homepage that promises no
invented reviews cannot sit above an assistant that invents restaurants.

**It may write only to the traveler's own plans.** `trip_itinerary_items` is the shared, staff-
authored, snapshotted day. Personal plans live in their own table, `traveler_plans`, merged in at
read time by the app and the calendar feed. An `owner_user_id` column on the shared table would have
been less code and one forgotten filter away from putting a private dinner on the group's schedule.

**It may not spend money.** The reservation contract exists — search, hold, confirm, cancel, copied
from the hotel supplier — but the only implementation is a stub that drafts a request the traveler
sends themselves, and a quote whose price is anything but zero is refused in code before it reaches
a provider. Stripe is live; a bug here is a real charge.

**The group room gets facts, not judgement.** The morning post listing the day's free activities is
written by us, not generated. A language model is not needed to list three itinerary rows, and using
one would add cost, latency and a way for the most-read message on the trip to come out wrong.

**The meter runs before the model.** One message is claimed against a daily cap atomically, on the
service role, before any billable call. Checking afterwards means a runaway client has already spent
the money by the time it is told to stop. Cost is recorded even when the call fails.

**Conversations are private from us.** `ai_messages` has no staff read policy at all. Cost lives in a
separate table, `ai_usage`, which holds counts and money and not a single word. Staff can see a
runaway bill the day it happens and cannot see what anybody asked.

## Consequences

- Google Places needs a billing account we do not have yet, so `PLACES_PROVIDER` defaults to a mock
  backed by real coordinates in the destinations we sell. Every result carries its `source` and the
  fallback is logged: a mock answer is labelled, never passed off as a live lookup.
- Behavioural taste needed a first-party table. PostHog is analytics and not a system of record; a
  product decision cannot depend on a sink we do not own and cannot join to.
- `messages.sender_id` became nullable so a post can come from us rather than from a person, guarded
  by a check constraint that a senderless message must declare itself a system message. The
  alternative — a fake "Guideless" auth user — could be messaged, blocked and reported like a person.
- The daily cap is 40 messages, in a function rather than a constant, so raising it is a migration
  with a reason in the message.
- "Free reservations" cannot complete a booking until item 7 brings a real provider. The contract is
  written and tested against the stub, so item 7 plugs in rather than rewrites.

## Alternatives considered

- **A Supabase Edge Function.** Rejected: it would duplicate the adapters in Deno.
- **Generating the group post with the model.** Rejected: cost and risk with no benefit over a
  template, on the message the most people read.
- **`owner_user_id` on `trip_itinerary_items`.** Rejected: one missing filter from a privacy failure.
- **Letting the assistant buy add-ons.** Deferred. It would need the hotel engine's
  recheck-before-charge discipline and a decision nobody has taken.
- **Reading chat messages to learn taste.** Rejected in the brief: richest signal, most invasive, and
  it changes what people are willing to say in the room.
