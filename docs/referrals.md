# Referrals, waitlists, trip drops and group unlocks

Growth mechanics from `docs/strategy-v3-direction.md` §5. Everything here is driven by real
confirmed bookings; nothing invents a count, and no reward is granted automatically except the
referral credit described below.

Migrations: `supabase/migrations/20260906005000_referrals_waitlists.sql`, and
`20260910000800_referral_economics.sql`, which replaced the percentage discount and the escalating
ladder with flat amounts.
Tests: `supabase/tests/growth.test.sql` (33 assertions), `apps/web/lib/growth/drops.test.ts`.

## Referrals

Two separate things pay out, both as `account_credits` in the booking's currency.

### What a referral is worth

Flat, on every trip, whatever it costs:

|                    | Amount                    | Setting                           | When                       |
| ------------------ | ------------------------- | --------------------------------- | -------------------------- |
| The friend booking | **$50 off** the base trip | `referral_discount_amount` (5000) | at checkout                |
| The referrer       | **$100 credit**           | `referral_reward_amount` (10000)  | when that booking confirms |

It does not escalate with the number of friends, and it is not a percentage. A percentage was the
old rule and it was the wrong shape for this catalogue: 5% is $69 on the cheapest trip and $1,580 on
the dearest, which is twenty-three times the giveaway for the same act, at exactly the end where the
margin is already committed to a non-refundable room. Costsaver, Contiki, Insight, Trafalgar and
Intrepid all pay a flat $100. `quote_booking()` owns the discount side and reads
`referral_discount_amount`; `referral_discount_percent` is a tombstone row nothing reads.

**The free host place is gone too.** `host_free_spot_threshold` is 0. Hosts earn
`host_credit_per_traveler` ($100) per confirmed traveler up to `host_credit_cap` ($1,000) — see
`HOST_CREDIT_PER_TRAVELER` in `apps/web/lib/data/community.ts`, which the public host page reads.

### The ladder, retired

`system_settings.referral_tiers` is now `[]`. It used to hold thresholds that topped a referrer up
to a running total — $100, $250, $400, $500 "plus an experience on us" — and the fourth referral was
worth five times the first for no reason anybody could defend.

`sync_referral_tier(user, currency)` survives and is still the only writer of source
`referral_tier`, but the entitlement is now simply:

```
entitlement = earned referrals x referral_reward_amount
paid        = sum of this user's referral_reward + referral_tier credit in that currency
delta       = entitlement - paid   → written as one row when non-zero
```

Emptying the tiers list without changing this function would have clawed the flat reward back to
zero, because the ladder used to be the _total_ entitlement and `[]` means an entitlement of
nothing. The tests caught it; it is worth remembering before anyone edits either half again.

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

### Spent credit comes back if the trip does not happen

Confirming a booking writes a NEGATIVE `account_credits` row (source `redemption`) for whatever
credit the quote applied. Until migration `20260910001100` nothing ever reversed it, so a traveler
who spent $100 of credit and cancelled at the 90% tier got 90% of the card payment and none of the
credit — and `previewRefund` could not even show it, because credit is not part of `amount_paid`.

`restore_credit_on_cancellation()` now puts it back in full when a booking goes cancelled or
refunded. In full, not at the tier percentage: the tiers govern money, and credit is a discount on a
future trip that we lose nothing by returning. It settles the NET of the redemption rows for the
booking, so cancelled-then-refunded does not hand it back twice.

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
