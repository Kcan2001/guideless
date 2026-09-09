# ADR-014 — Tiers are relative to the market, and judgment belongs in curation

**Status:** Proposed
**Date:** 2026-09-08

## Context

ADR-013 treats supplier selection as a scoring problem: rank equivalent rates on price,
refundability, breakfast, supplier reliability and margin. That is the right model for **which of
two identical rooms to buy**. It is the wrong model for **which hotel belongs in which tier**, and
the difference matters more than the scoring does.

Our four tiers are Explorer, Classic, Premium and Elite. Those are not star ratings. They are
positions on a value ladder, and the ladder is drawn relative to the market for a specific trip on
specific dates.

The Monaco Grand Prix makes this obvious. Monte Carlo rooms during race week are booked a year
ahead and run several times their normal rate, so the ladder is not about room quality at all:

| Tier     | What it actually is on this weekend                     |
| -------- | ------------------------------------------------------- |
| Explorer | A hotel in Nice, plus the train to the circuit each day |
| Classic  | A better hotel in Nice, same train                      |
| Premium  | Monaco itself, in something unremarkable                |
| Elite    | Monaco, in something that is not                        |

A three-star property that would be Explorer in any ordinary week is Premium in Monaco during the
Grand Prix, purely because of where it is and what weekend it is. **The tier is set by scarcity and
access, not by the property.** No supplier API encodes that. They return properties, prices and
star ratings; none of them know that Nice-versus-Monaco is the tier decision on this particular
weekend, or that it stops being the tier decision the following Tuesday.

The second thing a scorer cannot express is fit. A calm five-star suits a wine-tasting week in
Provence. The same property is wrong for a race weekend, where a four-star with a rooftop bar is
the better room even though it scores worse on every attribute we currently weigh.

Three concrete gaps follow, all verified in the code today:

- **`compare.ts` scores absolute attributes only.** Nothing in it can express "right tier for this
  market", because nothing tells it what the market is.
- **The tier definitions live in a dropdown.** They exist as UI label strings in
  `apps/web/components/admin/extras-forms.tsx` and nowhere else. There is no shared definition, so
  nothing can reason about them and nobody can be held to them.
- **Nothing describes a trip's character.** `tours.activity_level` is pace (relaxed, moderate,
  active), not vibe. There is no way to say a trip is a party weekend or a slow one, so there is no
  way to match a property to it.

And the gap is already visible to customers: **Monaco publishes a four-tier vocabulary and sells
two rungs.** Its stay options are Explorer (Nice) and Elite (Monte Carlo). Classic and Premium do
not exist on it.

## Decision

**Split curation from selection, and put the judgment in curation.**

**Curation** decides which properties are candidates for which tier on a given departure. It is
market-relative, needs reasoning, happens once per departure, moves no money, and a human can read
and approve the result. **This is where AI belongs, and it is the right tool for it, because no API
can answer the question.**

**Selection** decides which stored rate to buy for a booking. It is on the money path, runs on
every request, and must be deterministic, fast, auditable and replayable. **No model runs here.**

The mechanism is a **tier brief**: a short written statement, per departure and per rung, of what
that rung means _in this market on these dates_. Kyle's Monaco table above is a tier brief. It is
authored once, stored as durable product data on the departure rather than invoked as an ephemeral
prompt, and it does three jobs:

1. It is the instruction an AI shortlisting step works from, together with the trip's character and
   the destination.
2. It is what a human reviews. Staff accept, reject or edit the shortlist, and only the approved
   mapping is written to `hotel_supplier_mappings` and the stay option.
3. It is the record of _why_ a property sits in a tier, which is exactly the kind of claim we have
   been caught unable to justify before.

After approval the runtime is unchanged from ADR-013: stored rates, deterministic scoring among
equivalent products, a fixed customer price, a recheck before charging.

### Amendment, same day: curation is not a one-off

The paragraphs above say curation "happens once per departure". That is wrong, and the reason is
worth stating because it changes the design.

Tier membership is partly a function of price, and prices move daily. A property at $150 tonight is
an Explorer; at $200 next week it is not, and something that fell in price has taken its place. If
curation ran once, the ladder would be accurate on the day it was written and wrong within a week.

So the work splits in two, and only one half is stable:

**The candidate pool** is the set of properties acceptable for this trip at all: right area, right
character, actually bookable through a connected supplier, good enough that we would not be
embarrassed. This is the judgement half. It is slow, it needs reasoning about the market and the
trip, a human approves it, and it changes rarely.

**Tier placement** is which rung a pooled property occupies today. It is computed from the live
rate against the bands in the tier brief, on every rate refresh. It is arithmetic, it is
deterministic, and no model is involved. A property can move between rungs, or out of all of them,
without anybody rewriting anything.

This is why the brief should state **bands, not names**. "Around 100 to 200 a night in Nice, plus
the train" survives a property changing price. "The Hyatt" does not.

Two consequences worth being explicit about:

- Nothing here changes the **customer** price. The traveler buys a tier at a fixed package price;
  the pool and the placement decide which room _we_ buy behind it. This is already what our copy
  promises, because tier cards say the property is named at booking rather than naming one up
  front. It is also how tour operators genuinely work.
- A rung can go **empty**. If every pooled property has priced itself out of Classic this week,
  Classic has nothing behind it, and that is information rather than a failure. The departure sells
  the rungs that have inventory.

### Amendment: four tiers is a vocabulary, not a quota

A related question was whether four rungs is one too many, since Explorer and Elite are obvious
while Classic and Premium blur together.

The count is not the problem. The definitions were. Classic and Premium were written relative to
each other — "the standard experience" versus "better hotels" — which is not a definition, it is an
adjective. Anchored to a band in a specific market they separate cleanly, and Kyle's own Monaco
brief proves it: Nice standard, Nice better, Monaco unremarkable, Monaco not. Four crisp rungs,
because on that weekend the ladder has two axes, city and quality.

The real fix is to stop treating four as a quota. **A departure sells the rungs that exist for that
trip**, and the schema already allows it — Monaco offers two stay options today. On a trip whose
ladder is only quality, three rungs may be the honest answer, and offering a fourth would be
inventing a distinction to fill a slot. Dropping the vocabulary to three globally would instead
force Monaco to merge two positions that are genuinely different.

So: keep four as the vocabulary, define each rung as a band in the brief rather than an adjective,
and sell only the rungs the trip actually has.

## Consequences

- The judgment that currently exists only in Kyle's head becomes an artifact that someone else can
  apply, argue with, or inherit. That is the difference between a business and a founder.
- Tier definitions have to move out of the admin dropdown into shared config, so web, admin, mobile
  and any shortlisting step all read the same words.
- Trips need a **character** alongside `activity_level`, or property fit cannot be expressed at all.
- A shortlist is a proposal, never a booking. Nothing an AI step produces reaches a customer without
  a human accepting it, and nothing it produces sets a price.
- Every proposed property must be checked as actually bookable through a connected supplier before
  it is offered. A model will happily suggest a hotel we cannot buy.
- Monaco needs its Classic and Premium rungs built, priced from researched race-week rates. Two of
  four rungs missing is a visible hole in a vocabulary we publish.

## Alternatives considered

- **An absolute rubric** mapping star ratings and price bands to tiers. Simple, deterministic, and
  wrong on the first real trip: it puts a Monaco three-star in Explorer during the Grand Prix, which
  is the opposite of true.
- **A model in the request path**, choosing a hotel live per customer. Rejected. It makes pricing
  nondeterministic, unauditable and unreplayable on the one path where money moves, adds latency and
  a per-request cost, and can propose inventory that cannot be booked. It also collides with
  ADR-013: the customer price is fixed before the customer sees it.
- **Pure human curation, no AI.** This is what we do today and it is correct at two departures. It
  does not survive twenty, and it keeps the reasoning unwritten, which is the actual problem.
- **Ask the supplier APIs for a tier.** They do not have one. Star ratings are a property attribute;
  a tier is a market position.
