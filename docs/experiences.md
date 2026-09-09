# Sourcing experiences from a supplier

Brief item 7: stop hand-building the extras catalog per departure. The same problem as hotels,
solved the same way and reusing the same words — search, rates, recheck, book, cancel.

## There is no Viator adapter yet, on purpose

`EXPERIENCE_SUPPLIER=viator` is accepted by the config and falls back to the mock with a warning,
because writing an adapter from documentation is the specific mistake this codebase already made
once. From `scripts/liteapi-probe.mjs`:

> The Duffel adapter in this repo was written from public documentation and has never run against a
> real account, which is why it is a plausible integration rather than a verified one.

LiteAPI was done the other way — probe, read real responses, then write — and the probe immediately
found something the docs had not made obvious (116 of 200 real rates carried more than one
cancellation window, which changed the schema). So:

1. Get a Viator partner key.
2. `node scripts/viator-probe.mjs --key <key>` — it prints response _shapes_, never the key, and
   `--save` writes a redacted capture.
3. Answer the six questions at the top of that script. The one that matters most is **whether the
   price the API returns is net to us or retail**; getting it backwards means selling below cost.
4. Write `apps/web/lib/experiences/viator.ts` against those responses, capture fixtures, and add it
   to `getExperienceSupplier()`.

Everything else — search, caching, pricing, import, recheck, the admin screen — is built and tested
against the mock and does not change when the real adapter lands.

## Where the commercial detail lives

`departure_add_ons` is readable by **anon**; it is the extras list on a public tour page. So not one
byte of sourcing goes on it — not the cost, not the supplier, not the supplier's product id. A
product id is not a price, but it is a link a customer could follow to buy the same ticket direct.

| Table                 | Holds                                                          | Who reads it |
| --------------------- | -------------------------------------------------------------- | ------------ |
| `departure_add_ons`   | title, price, when, where                                      | anyone       |
| `experience_products` | the supplier catalog, cached, with its "from" price            | staff        |
| `experience_rates`    | what an option costs us on a date, and its cancellation ladder | staff        |
| `add_on_sourcing`     | which product an add-on came from, cost, observed drift        | staff        |

A sourced add-on and a hand-written one are the same row to a traveler, which is correct: they are
buying from Guideless either way. `supabase/tests/experience_sourcing.test.sql` asserts the split,
including two `hasnt_column` checks whose job is to stop somebody adding `net_amount` to the public
table later for convenience.

## Pricing

`pricing_rules` gained an `applies_to` column (`hotel` | `experience` | `any`) rather than a second
table, because two tables of markup rules is how a company ends up with two different margins by
accident. Existing rows default to `hotel`, which is what they were written for.

`suggest_experience_price(product, net)` mirrors `suggest_stay_price`: highest-priority matching
rule, percentage and fixed markups add, minimum markup floors the result, `null` when nobody has set
a margin for that destination. It **suggests** — a person still types the number, and the import
refuses a price below cost outright.

## Import

`/admin/experiences` (ops roles): search → price a date → import an option onto a departure.

Two rows are written, and if the second fails the first is removed — an add-on with no sourcing row
is one nobody can trace or recheck. **Imports land inactive**: the description is the supplier's
marketing copy and it is about to sit on a public page, so somebody reads it before it goes live.

## Recheck before charge

`verifySourcedAddOns` runs in `startAddOnPurchase`, before Stripe. Only sourced add-ons are checked;
a hand-written extra has no supplier to ask. The policy is pure and lives in
`lib/experiences/recheck.ts`:

- **withdrawn or sold out** → block. Nothing is charged, and the traveler is told plainly.
- **margin would go negative** → block. Selling below cost is a decision a person makes, never one a
  checkout makes for them. The traveler sees a neutral message; "our margin went negative" is not a
  sentence to put in front of a customer.
- **risen by ≤ 5 % of the original cost** → proceed, absorbed silently. A traveler one click from
  paying should not watch the number change.
- **risen more, but still profitable** → proceed at the advertised price and record the drift, so
  staff can re-price it for the next person.

Nothing reprices itself. Drift is written to `add_on_sourcing.drift_amount` and shown on the admin
screen.

**If the supplier cannot be reached, the sale goes through.** That is a choice: a traveler blocked
from buying a ticket because somebody else's API is down is a worse outcome than finding out an hour
later that a price moved.

## Environment

| Variable              | Notes                                                                                |
| --------------------- | ------------------------------------------------------------------------------------ |
| `EXPERIENCE_SUPPLIER` | `mock` (default) or `viator`; `viator` warns and falls back until the adapter exists |
| `VIATOR_API_KEY`      | Server-side only. Needed by the probe script and, later, the adapter                 |
