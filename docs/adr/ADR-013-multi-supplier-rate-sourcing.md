# ADR-013 — Multi-supplier rate sourcing, and where the customer price is fixed

**Status:** Proposed
**Date:** 2026-09-08

## Context

Hotel rates move daily. Relying on one supplier is fragile for three reasons we can already
demonstrate:

1. **Availability.** One supplier not carrying a property, or not carrying a refundable rate for
   it, silently becomes "no rate" for that departure.
2. **Price.** Bedbanks do not agree with each other. The spread on the same room between two
   wholesalers is routinely larger than our margin on it.
3. **Outage.** Today a supplier error makes `recheckStayRate` return `ok: false`, and checkout
   refuses. One supplier down currently means no hotel-linked tier can be sold at all.

The proposal was to build a pricing layer that queries several sources, compares them, picks the
best, and shows the result to a customer inside the booking flow.

**Most of that layer already exists.** `hotel_rates` carries a `supplier` column and the refresh
deliberately replaces one supplier's snapshot at a time rather than upserting on a conflict target.
`fingerprint.ts` groups equivalent products across suppliers so a non-refundable room-only rate is
never compared against a refundable one with breakfast. `compare.ts` scores candidates on price,
free cancellation, breakfast, supplier reliability and margin. `suggest_stay_price()` applies the
markup rules and hands staff a customer price.

What does not exist is the fan-out. `getHotelSupplier()` returns a single cached adapter chosen by
an environment variable, so the engine is multi-supplier in its data model and single-supplier at
runtime. There is also only one real adapter, and it has never run against a live account.

## Decision

**Finish the comparison layer as a service module inside the existing stack. Do not build it as a
separate server or an MCP endpoint, and do not build it first.**

Three parts:

**1. Fan out across configured suppliers.** Replace the single cached adapter with a set, and have
the refresh ask each of them, in parallel, with the per-call timeouts that already exist. Each
supplier's snapshot is replaced independently, which the storage layer already does. A supplier
that errors degrades the result instead of failing it.

**2. The customer price is fixed before the customer sees it.** Live rates decide _which room we
buy and at what cost_. They do not decide what a traveler pays. The package price stays
`departure_stay_options.price_delta_amount`, set by staff from `suggest_stay_price()`. When a
future feature does need a live number in front of a customer, it is **locked when the draft is
created and held for the life of the seat hold**, never recomputed under them.

**3. MCP comes later, if at all, and only as a read-only wrapper.** A protocol layer between our
own server code and our own database earns nothing (rule 13). The one case with real value is
letting staff ask pricing questions conversationally in ops — "cheapest refundable room in Nice for
these dates across every supplier". That is a thin read-only wrapper over the same service, added
when someone wants it, not a foundation to build on.

**Sequence.** The comparison layer is third, not first:

1. Teach the rate model a **multi-window cancellation ladder**. It currently holds one deadline
   while every serious supplier returns a ladder, so we would believe a rate is fully refundable
   until a date when the supplier already charges 50%. This is a money bug and it must land before
   the first live rate.
2. Connect **one real supplier** (LiteAPI, per `docs/hotel-provider-audit.md`) and prove the
   adapter against real responses.
3. **Then** fan out. A comparison engine with one unverified adapter compares nothing.

## Amended by ADR-014

This ADR frames supplier choice as a scoring problem. That is right for deciding which of two
equivalent rooms to buy and wrong for deciding which hotel belongs in which tier, because a tier is
a market position rather than a property attribute. ADR-014 adds the missing half: judgment belongs
in curation, before any of the scoring here applies. Nothing in this ADR changes.

## Consequences

- A supplier outage stops being a checkout outage: the engine can fall back to another supplier's
  stored rate rather than refusing the sale.
- Margin improves without raising a price, because we buy from whichever source is cheapest for an
  equivalent product rather than from whichever one we happened to integrate.
- `compare.ts`'s supplier reliability weights stop being decoration and start mattering. They are
  currently guesses documented as integration maturity; once two suppliers are live they should be
  driven by observed booking failures.
- Staff pricing gets better inputs, but the staff step stays. Somebody still decides the tier price.
- Cost: every supplier is another contract, another certification, another set of field quirks, and
  another thing that can break at 2am. Two is worth it. Five is not, until volume says otherwise.

## Alternatives considered

- **A pricing MCP server as the first layer.** Rejected for now. It adds a protocol boundary
  between our own code and our own database, which rule 13 exists to prevent, and it would be built
  before there is any second source for it to compare. The staff-facing read-only version remains
  worth doing later.
- **Live pricing shown to the customer in the builder.** Rejected as the default, because it
  changes the product rather than the plumbing. A package sold at a fixed price with a published
  cancellation ladder cannot have its price move while a traveler fills in the form, drafts survive
  overnight, and two travelers in the same hotel on the same departure must not pay different
  amounts because they opened the page an hour apart. If we ever want a genuinely live-priced,
  pick-your-own-hotel product, that is a deliberate product decision with its own ADR, not a
  consequence of a sourcing change.
- **A third-party aggregator (TravelgateX) instead of our own fan-out.** Genuinely good technology
  and the cleanest cancellation types anyone publishes, but you still need your own commercial
  contract with each bedbank behind it, which is the barrier we cannot clear at zero volume.
  Revisit at supplier three or four.
- **Stay single-supplier.** Simplest, and defensible until the first real supplier is proven. It is
  what we do today; this ADR is about what happens immediately after.
