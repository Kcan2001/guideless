# Supplier contract drafts

> **Drafts for attorney review. Not legal advice. Do not send to a supplier.**
>
> These documents were prepared to give a qualified travel-business attorney something concrete to
> mark up, not to be used as they stand.
>
> **The position question is settled: Guideless is the ORGANISER of a package**, decided 2026-09-10.
> It contracts suppliers in its own name, takes the traveler's money itself, and sells hotel + rail
>
> - experiences for one price. Clauses marked **[POSITION-DEPENDENT]** should now be read on that
>   basis rather than left open; the customer-facing documents already are
>   (`apps/web/content/legal/terms.ts` clause 11 and `booking-agreement.ts` clauses 4 and 13).

## What is here

| File                               | Covers                                                                  | Status            |
| ---------------------------------- | ----------------------------------------------------------------------- | ----------------- |
| `supplier-master-agreement.md`     | The terms every supplier signs, whatever they sell us                   | Draft, unreviewed |
| `schedule-a-accommodation.md`      | Hotels: rooming, release dates, city taxes, property changes            | Draft, unreviewed |
| `schedule-b-experiences.md`        | Boats, tastings, tours: capacity, weather, safety, age limits           | Draft, unreviewed |
| `schedule-c-transfers.md`          | Airport and ground transport: vehicles, licensing, flight monitoring    | Draft, unreviewed |
| `schedule-d-event-tickets.md`      | Monaco Grand Prix and similar: allocation, non-refundability, date risk | Draft, unreviewed |
| `supplier-onboarding-checklist.md` | The practical per-supplier list before a first booking                  | Working document  |

A supplier signs the master agreement once, plus the one schedule that matches what they sell. A
supplier who sells two things (a hotel that also runs a boat) signs both schedules.

The company's wider legal position — registrations, insurance, customer-facing terms — is tracked in
[`docs/business-readiness.md`](../business-readiness.md) §2, which already carries a
jurisdiction-by-jurisdiction table. This directory is only the supplier side.

## The questions these contracts depend on

An attorney should settle these before the drafts are finalised, because each one changes wording
that is already in the files.

1. ~~**Agent or organiser?**~~ **ANSWERED 2026-09-10: organiser.** Guideless contracts suppliers in
   its own name, takes the traveler's money itself, and sells hotel + rail + experiences for a
   single price. That is a tour operator selling a package, and it is answerable to the traveler for
   the whole package including a supplier's failure. Clause 3 of the master agreement was already
   written on that assumption. What remains for the attorney is confirming the wording, not the
   position — and confirming that being the organiser is what we WANT, given it is settled by
   conduct rather than by what a contract says.
2. **Seller of Travel registration — the live blocker.** California, Florida, Hawaii and Washington
   each require a seller of travel to register before selling to their residents, and Guideless holds
   none of them. This is the one item standing between the Booking Agreement and publication: clause
   4 has to state a registration number or state that residents of those states cannot book. Which
   of the four bind us depends on where Guideless is operated from as well as where the customer
   lives, and whether any of them forces a trust account changes how supplier prepayments are held.
3. **Does the EU Package Travel Directive reach us?** Trips run in France and Monaco and every
   supplier is European, but the sale is from a US company to mostly US consumers. The working
   position (seed 090) is that it reaches sales to EU residents, that the exposure is bounded and
   tier-dependent rather than flat, and that insolvency protection is bought before the first
   Premium or Elite sale to an EU resident rather than before any EU sale at all. The Booking
   Agreement now states EU and UK travelers keep their mandatory rights. The attorney should confirm
   the threshold, not whether the Directive exists.
4. ~~**Whose contract is the traveler's contract?**~~ **Follows from 1: ours.** The traveler's
   remedy is against Guideless, and these agreements are how Guideless recovers from the supplier.
   The indemnity and liability clauses already assume that chain, and clause 13 of the Booking
   Agreement now says it to the traveler in plain words.
5. **Insolvency and prepayment protection.** Suppliers will want deposits months ahead. Whether that
   money can sit in the operating account or must be held in trust follows from questions 2 and 3.
6. **Governing law.** The drafts leave this open. A California or Delaware choice is convenient for
   Guideless and unattractive to a French hotel; French law is the reverse. The attorney should
   decide whether to fight for it or accept local law per supplier.

## Conventions in these drafts

- Anything Kyle or the attorney must fill in appears as `[SQUARE BRACKETS]`, and every file lists
  its placeholders at the end so none is missed.
- Where a clause exists because of a specific legal regime, a short note says which, so the attorney
  can check the reasoning rather than guess at the intent.
- Plain English, numbered clauses, short sentences. No recitals, no Latin.
- Money is stated in the supplier's currency. Guideless sells in USD and buys mostly in EUR, so the
  exchange risk sits with Guideless and the drafts say so rather than leaving it ambiguous.

## What the business actually does, for the attorney's reference

Guideless LLC is a Delaware company operating from Santa Monica, California. It sells multi-day
small-group trips in Europe, currently Nice → Avignon → Paris over nine days from $3,495, and a
Monaco Grand Prix weekend over five days from $1,890 on 3–7 June 2027. Group sizes run from about
six to fifty travelers.

For each trip Guideless books hotels, rail between cities, selected experiences, airport transfers
and one included group moment. **There is no tour guide and no Guideless representative travelling
with the group** — the product is deliberately unescorted, which matters for duty of care and is
called out in the safety clauses. Travelers book their own flights.

Each traveler has their own room by default. Two travelers on one booking may share; three never
share. Travelers pay Guideless directly by card, a deposit first and the balance before departure,
and Guideless pays suppliers. Optional extras — a grandstand seat, a boat day, a dinner, an extra
night — can be bought when booking or at any time afterwards, **including during the trip**, which
is why the schedules ask suppliers for late availability terms rather than a single cut-off.
