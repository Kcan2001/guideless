# Referrals, waitlists, trip drops and group unlocks

Growth mechanics from `docs/strategy-v3-direction.md` §5. Everything here is driven by real
confirmed bookings; nothing invents a count, and no reward is granted automatically except the
referral credit described below.

Migration: `supabase/migrations/20260906005000_referrals_waitlists.sql`.
Tests: `supabase/tests/growth.test.sql` (33 assertions), `apps/web/lib/growth/drops.test.ts`.

## Referrals

Two separate things pay out, both as `account_credits` in the booking's currency.

### The flat reward (paid first, counted toward the ladder)

Every referral that reaches a confirmed booking pays `system_settings.referral_reward_amount`
(default 7500 = $75) once, as source `referral_reward`. The friend gets
`referral_discount_percent` (default 5%) off the base trip at checkout. The flat amount lands as soon as a booking confirms and counts toward the ladder below. This is the existing
behaviour and `quote_booking()` still owns the discount side.

### The ladder

`system_settings.referral_tiers` holds the thresholds, so staff change them without a deploy:

```json
[
  { "referrals": 1, "credit": 10000, "note": "First friend" },
  { "referrals": 2, "credit": 25000, "note": "Second friend" },
  { "referrals": 3, "credit": 40000, "note": "Third friend" },
  { "referrals": 4, "credit": 50000, "note": "Fourth friend, plus an experience on us" }
]
```

**The rule, exactly: `credit` is the referrer's running total, not a payment per friend, and not an
extra on top of the flat reward.** Reaching a threshold tops the referrer up to that total counting
everything already paid, the flat reward included. So one friend earns $100 altogether (the flat $75
plus a $25 top-up), two earn $250, three $400, four $500 — never $1,250, and never $175 for one.

`sync_referral_tier(user, currency)` implements it in one place and is the only writer of source
`referral_tier`:

```
entitlement = credit of the highest tier whose `referrals` <= earned referrals (0 if none)
paid        = sum of this user's `referral_tier` credit in that currency
delta       = entitlement - paid   → written as one row when non-zero
```

Because it recomputes from scratch it is idempotent: calling it twice pays nothing the second
time. It is also self-reversing — if a referral is voided the earned count drops, entitlement
drops with it, and the next call writes the negative difference.

`bookings_sync_add_ons_and_rewards` calls it when a booking confirms, right after the base reward.

### Cancellations take the reward back

A cancelled or refunded booking now voids its referral whether it was pending **or** already
earned. An earned one also writes a matching negative `referral_reward` row and re-syncs the
ladder, so a trip that did not happen does not leave a reward standing.

> This is a behaviour change. Before this migration an earned referral survived a cancellation and
> the referrer kept the credit. Existing credit already granted is left alone; only cancellations
> from here on reverse.

`referral_progress(currency)` returns the ladder plus the signed-in traveler's own earned and
pending counts, and drives the account card.

## Waitlists

`departure_waitlist` holds two shapes, distinguished by whether `departure_id` is set:

- **a departure** — sold out, closed, or dropped but not yet open;
- **a whole tour** — someone wants the trip but there are no open dates at all.

`tour_id` is always set either way, so staff can group by tour. Postgres treats nulls as distinct,
so each shape has its own partial unique index on the email.

Joining goes through `join_waitlist()` only: public insert is not possible. It is rate limited to
five attempts an hour per address via `check_rate_limit`, the form carries a honeypot, and joining
twice updates the existing row instead of failing. It returns `joined`, `already_waiting`,
`rate_limited`, `invalid_email` or `not_found` and never reveals another row.

**Nothing happens automatically.** When a seat frees or a departure opens, no email goes out and no
row is notified. Staff press "Mark notified" on `/admin/waitlists`, which calls `notify_waitlist()`
— that writes an in-app notification for anyone with an account and stamps `notified_at`. Wiring
the actual email is still to do.

## Trip drops

`departures.opens_at` means "not bookable until". Before it passes, the departure is visible and
priced with a countdown and the waitlist in place of a booking button; after it, everything is
normal. Clearing the column opens the departure immediately.

The rule is enforced in the database, not just the UI: `quote_booking()` returns the problem code
`departure_not_open` (with `opensAt`, so the page can count down), and because `create_booking()`
raises on any quote problem, booking is refused too.

`departures_public` exposes `opens_at`. `apps/web/lib/growth/drops.ts` holds the pure
`dropState`/`dropCountdown` helpers so the server page and any client countdown agree; an
unreadable date falls **open**, never closed, since the database refuses anyway.

## Group unlocks

`departure_unlocks(departure_id, threshold, reward, is_active, granted_at)` is a promise the group
can see: at N confirmed travelers everyone on the departure gets something.
`departure_unlock_progress(departure_id)` returns the confirmed traveler count and each active
unlock with `reached` and `granted`.

**Reaching a threshold does not grant anything.** It shows as unlocked and staff mark it granted on
`/admin/waitlists` once they have actually arranged it. The traveler-facing copy says so ("we will
confirm the details before you travel") rather than implying an automatic payout.
