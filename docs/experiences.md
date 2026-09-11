# Sourcing experiences from a supplier

Brief item 7: stop hand-building the extras catalog per departure. The same problem as hotels,
solved the same way and reusing the same words — search, rates, recheck, book, cancel.

## Decisions (2026-09-09)

Four answers from Kyle shape this, and two of them changed the schema after it was written:

1. **We resell** — our price, our checkout, in the app with the group. Needs Viator's
   **Full + Booking** tier, which requires approval and certification.
2. **Basic access first.** Viator's Basic tier needs no approval at all — product search plus
   single-product pricing and availability, key in minutes. Enough to probe against and to write
   `search`/`getOptions` from real responses while the booking tier is applied for.
3. **In the trip, not the shop.** Sourced activities are `in_trip_only`: Explore and the assistant,
   never the pre-sale tour page. A long tail of commodity tickets next to the yacht and the
   grandstand would read like an OTA.
4. **Match the supplier's public price**, earn the commission, do not mark up. A traveler can check
   the same activity in one search, and finding it cheaper elsewhere is corrosive to the brand.

## Alternatives considered

- **Amadeus Tours and Activities** would have been ideal — one API aggregating ~45 platforms
  including Viator, GetYourGuide, Klook and Musement. Its self-service portal was **decommissioned
  on 17 July 2026** and existing keys deactivated. Only Enterprise customers retain access.
- **GetYourGuide** is stronger in Europe, which matters for Nice, Monaco and Avignon, but its
  partner API requires three-phase certification and a floor of 100,000 monthly website visits.
  Worth revisiting if traffic ever clears that.
- **Viator Basic** turned out to be the least gated option, not the most: no approval, no
  certification, instant key. The barrier applies to booking on our own site, not to finding things.

## Grand Prix tickets: nobody sells them through an API

Asked and answered on 10 September 2026, so nobody has to look again. **There is no API anywhere
that sells a Monaco grandstand seat.** Everything checked:

| Checked                        | What it actually is                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| Viator (our live key)          | Zero F1 tickets. Tours and activities only.                                                      |
| Ticketmaster Discovery         | Wrong geography. Monaco is not on it.                                                            |
| GetYourGuide / Klook           | Experiences, not motorsport seating.                                                             |
| Motorsport Tickets, Gootickets | Real resellers, but affiliate links or a web checkout. No booking API.                           |
| F1 Experiences                 | Official, and has an Authorised Sales Agent programme — a commercial agreement, not an endpoint. |

**The route is the Automobile Club de Monaco, direct.** ACM is the promoter and sells its own
tickets at [monaco-grandprix.com](https://www.monaco-grandprix.com/) and from its office at 44 rue
Grimaldi, Monaco (Monday to Friday, 09:00–17:00). A trade allocation is a phone call and a contract
with them, and it is the only way to hold seats rather than buy them one at a time at face value
like a customer would.

Published 2026 face values, for pricing against (Monaco Tribune, February 2026):

|                                             | Friday | Saturday | Sunday       |
| ------------------------------------------- | ------ | -------- | ------------ |
| Secteur Rocher (standing, the only GA zone) | €45    | €75      | €130         |
| Zone Z1 (standing, Nouvelle Chicane–Tabac)  | €65    | €110     | —            |
| Grandstand T / L (technical)                | €150   | €300–550 | €700–1,050   |
| Grandstand K (Tabac / port)                 | €175   | €400–550 | €900–1,050   |
| Grandstand A (Sainte-Dévote)                | €175   | €450     | €950         |
| Grandstand B (Casino)                       | €155   | €550–650 | €1,050–1,150 |

Roughly 10% comes off a two- or three-day combination; children 6–15 are half price and under-6s
free, neither of which matters on an 18+ departure.

**What this changed in the product.** Our cheapest race viewing was Grandstand K at $2,190 against
a trip that starts at $1,603 — the entry tier could not afford to see the race. Secteur Rocher at
$395 (seed 092) fixes that, and it is an honest product as long as the copy leads with the fact
that it is a hill and not a seat.

**Before either takes real money**, the ticket line needs an ACM conversation: an allocation, a
trade rate, and a name-change policy, because these are bought months ahead in a named traveler's
name and no supplier takes them back.

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

`suggest_experience_price(product, retail)` **returns the supplier's own price by default**. We
match it and take the partner commission; that is the decision, not an accident of the code.

A markup happens only when somebody has written a pricing rule scoped to `experience`. Rules scoped
to `hotel` are deliberately excluded, and so is `any` — a markup set for beds must not quietly start
marking up activities. When a rule does apply it behaves like `suggest_stay_price`:
highest-priority match, percentage and fixed markups add, minimum markup floors the result.

The import still refuses a price below what the activity costs us.

## Import

`/admin/experiences` (ops roles): search → price a date → import an option onto a departure.

Two rows are written, and if the second fails the first is removed — an add-on with no sourcing row
is one nobody can trace or recheck.

**Imports land inactive and `in_trip_only`.** Inactive because the description is the supplier's
marketing copy and somebody should read it first; in-trip because that is where sourced activities
belong. `listDepartureExtras(id)` is the shop and excludes them; `listDepartureExtras(id, {
includeInTripOnly: true })` is the trip and includes them, which is what the post-booking page and
the app use.

## How a bought-in experience is actually sold (migration 0067)

Decided 2026-09-09. The traveler checks out **normally** — our site, our Stripe, one cart with
everything else, no separate flow and nothing to explain at the point of payment. We are the
merchant of record. **Afterwards** we buy the experience from the operator on their behalf.

That splits paying from being booked, and the gap is the whole risk:

- Confirming a bought-in `booking_add_ons` row fires a trigger that creates a **pending
  `add_on_fulfilments` row**. It hangs off the status change rather than off the Stripe webhook, so
  there is no route to "paid" that skips creating the obligation.
- `/admin/fulfilment` ("To book") is the queue, sorted by the date the traveler needs the thing.
  Ops buys it, pastes the reference, and the traveler sees it immediately.
- `fail_fulfilment` exists because sometimes we will not be able to buy it. It demands a reason and
  the admin copy says out loud that somebody has paid for something they are not getting and must
  be refunded. A silent failure here is money we kept for nothing.

**The traveler is told whose experience it is.** `departure_add_ons.operated_by` is public and
carries a name, not a flag — "Operated by Viator", their terms linked, and their own page offered
via `supplier_booking_url` for anyone who would rather book direct. That link carries our partner
attribution, so a referral still counts (`lib/experiences/attribution.ts`, tested — an unattributed
link earns nothing and looks identical to one that works).

**`add_on_fulfilments` holds no money.** It is the one supplier-side table a traveler can read, and
row-level security is per row rather than per column, so the only safe design is for there to be
nothing in it they should not see. What we paid stays in `add_on_sourcing`.

Cancellation follows the **operator's** ladder, not the trip's, and the terms are copied onto the
fulfilment when it is booked so they cannot change under the traveler afterwards — the same
reasoning as the frozen review byline.

### The licence question

The affiliate licence accepted for the API key says the content "can only be used to drive affiliate
traffic to Viator.com." Selling on our own site and fulfilling separately is a normal travel-agent
arrangement, but it is probably not what that licence describes — that is likely what their Merchant
agreement is for. We also link out to them, which is genuine affiliate traffic. **Confirm the right
agreement with Viator before this is live.** The code is identical either way.

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
