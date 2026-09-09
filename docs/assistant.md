# The trip assistant

What it is, where it runs, and what it is not allowed to do. The reasoning behind the boundaries is
in [ADR-015](adr/015-the-trip-assistant.md); this is how to work on it.

## Shape

| Piece           | Where                                                                  |
| --------------- | ---------------------------------------------------------------------- |
| One turn        | `POST /api/ai/chat` (`apps/web/app/api/ai/chat/route.ts`)              |
| The loop        | `apps/web/lib/assistant/chat.ts`                                       |
| What it knows   | `apps/web/lib/assistant/context.ts` — built as the traveler, under RLS |
| What it is told | `apps/web/lib/assistant/prompt.ts` — rules cached, trip context not    |
| What it can do  | `apps/web/lib/assistant/tools.ts`                                      |
| Places          | `apps/web/lib/places/` — `mock` and `google` behind one contract       |
| Reservations    | `apps/web/lib/reservations/` — contract plus a stub, no provider yet   |
| Cost            | `apps/web/lib/assistant/cost.ts`, `ai_usage`, `/admin/assistant`       |
| The group post  | `apps/web/lib/assistant/schedule.ts` + `group-post.ts`, hourly cron    |
| Web             | `/account/assistant/[bookingId]`                                       |
| Mobile          | `apps/mobile/src/app/assistant.tsx`, Today tab entry                   |

It runs in the web app rather than in a Supabase Edge Function so the places and reservation
adapters are not implemented twice. **Mobile calls the same route** with its Supabase access token
as a bearer; `createClient()` in `lib/supabase/server.ts` honours that header, still with the anon
key, so row-level security is identical on both.

## Environment

| Variable               | Where           | Notes                                                                  |
| ---------------------- | --------------- | ---------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`    | Vercel (server) | Missing means the assistant is **off**, not degraded. Never public     |
| `ASSISTANT_MODEL`      | Vercel (server) | Defaults to `claude-opus-5`                                            |
| `PLACES_PROVIDER`      | Vercel (server) | `mock` (default) or `google`                                           |
| `GOOGLE_PLACES_KEY`    | Vercel (server) | Server-side, billable, unrestricted by referrer — never `NEXT_PUBLIC_` |
| `RESERVATION_PROVIDER` | Vercel (server) | Only `stub` exists until brief item 7                                  |
| `CRON_SECRET`          | Vercel (server) | Already set; guards the group-post cron                                |

With no key at all everything still works: the plans page, the calendar merge and the group post are
independent of the model, and the chat surface says it is not switched on rather than erroring.

## The rules it runs under

- **Three sources, always distinguished.** Curated recommendations, the live places lookup, and the
  model's own knowledge. It must say which. It must not invent a name, address, price or opening
  time. If a place search fails, it answers from what we curated and says a live check was not
  possible.
- **It writes only to `traveler_plans`.** Private to one traveler, merged into the app's Today
  screen and the `.ics` feed at read time. It never touches `trip_itinerary_items`.
- **It cannot spend money.** A quote whose price is not zero is refused in `tools.ts` before it
  reaches a provider.
- **It does not answer on money, refunds, cancellations or emergencies.** Those go to the team.
- **Every tool argument is validated with Zod**, exactly like a form. A tool call is a model's guess
  at a JSON object; a date outside the trip is refused rather than filed in the wrong week.
- **The time zone is ours, not the model's.** A plan is written with the trip's zone regardless of
  what the model suggests.

## The meter

`ai_claim_message(user, booking)` spends one of the day's allowance **atomically, before the model
is called** — the check and the increment are one statement, so two simultaneous requests cannot
both be let through. `ai_daily_limit()` is 40; raising it is a migration.

`ai_record_cost` runs whether the turn succeeded or failed, because the tokens were spent either
way. Cost is in `cost_micros` — millionths of a dollar — because a turn costs a fraction of a cent
and in cents every row would round to zero.

`/admin/assistant` (finance roles) shows spend per booking, cost per message, and how many travelers
hit the cap today. It shows no conversation, because **`ai_messages` has no staff read policy**. That
is deliberate: the assistant is only useful if people ask it blunt things.

## The morning group post

An hourly cron (`/api/cron/group-activities`) posts the day's free activities into each trip's group
room, once, in that trip's own morning (07:00–10:00 local). Hourly rather than daily because trips
are in different zones and one daily run would land at 3am for somebody.

It is a template, not a model call. The day is claimed in `assistant_group_posts` **before** the
message is sent, so a retried cron run posts nothing — the primary key is the idempotency guard.

Posts are system messages: `messages.is_system = true` and `sender_id = null`, guarded by a check
constraint. Clients render them as Guideless and must not offer to block or report them.

## Taste

`traveler_taste()` returns weighted `recommendation_category` values from three inputs: stated
interests on the profile (weight 3), what the pre-trip survey said, and `traveler_signals` — what a
traveler opened, joined or bought (1 to 4). Stated outranks tapped; buying outranks both. The
weights are crude and visible on purpose: when a suggestion is wrong, the function explains why.

Chat messages are **not** read for this. `traveler_pace()` reads the pre-trip survey's pace answer
and changes how _much_ the assistant suggests, not what.

## Working on it locally

Without `ANTHROPIC_API_KEY` the chat surface is off but everything around it works. With one, the
places provider defaults to the mock — real coordinates in Nice, Monaco, Avignon and Paris, with
opening hours evaluated in local time — so "what's open near me" behaves like the real thing with no
billed call and no Google Cloud account.

Tests: `supabase/tests/assistant.test.sql` (privacy and the meter), and `lib/places/mock.test.ts`,
`lib/assistant/cost.test.ts`, `lib/assistant/group-post.test.ts`, `lib/reservations/stub.test.ts`.
The reservation tests are the specification the Viator adapter will be written against.
