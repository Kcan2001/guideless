# Which hotel API to connect, and whether apartments are possible

Audit, 2026-09-08. Two questions: which accommodation provider should Guideless actually integrate,
and can we sell Airbnb-style stays. Short answers: **LiteAPI first, Duffel second, Hotelbeds third**,
and **whole-home rentals are the wrong product for us** while serviced apartments are the right one
and are already available inside ordinary hotel APIs.

Verification convention below: **verified** means read on the vendor's own documentation.
**Inferred** means drawn from third-party sources. "Not published" means the vendor genuinely does
not say.

---

## Our side: what a provider has to fit into

The supplier abstraction already exists and is the right shape. `HotelSupplier` in
`apps/web/lib/hotels/types.ts` is five methods, and nothing downstream knows which supplier
produced a rate.

| Method         | What it must do                                                                                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `searchHotels` | Return properties for a curated list of supplier property ids. We never do open destination search; staff curate the hotels and map each to a supplier id.                                                    |
| `getRates`     | For one property, dates and occupancy: net, taxes, fees and total as separate integers, refundability, a cancellation deadline and penalty, breakfast, payment type, any disclosed commission, and an expiry. |
| `recheckRate`  | Re-price one rate immediately before charging, returning null when it is gone.                                                                                                                                |
| `book`         | Book with guest names and a contact, returning a supplier booking id.                                                                                                                                         |
| `cancel`       | Cancel and report the refunded amount.                                                                                                                                                                        |

Both ends are wired. The recheck runs inside `startCheckout` before any seat hold is created and
refuses above a 5% move. Booking is a staff action in `/admin`, deliberately, while no supplier is
contracted.

### Five things to fix before any provider goes live

**1. The Duffel adapter has never met a real account.** It implements all five methods, but its
field names were read from public documentation and it is exercised only against saved fixtures.
It is a plausible integration, not a verified one.

**2. Two supplier names exist with nothing behind them.** `expedia` and `hotelbeds` are values in
the `hotel_supplier` enum, and `compare.ts` assigns them reliability weights. Neither has an
adapter. The admin dropdown at least says so.

**3. Adding a provider needs a migration**, because the supplier list is a closed Postgres enum.
Fine for three or four. Worth converting to a lookup table if we ever want more.

**4. The rate model holds one cancellation deadline, and every serious supplier returns a ladder.**
`CancellationPolicy` is `{deadline, penaltyAmount, description}`, a single step. Expedia Rapid
returns windows with start, end and one of amount, nights or percent. Hotelbeds returns
`cancellationPolicies[]`. LiteAPI returns `cancelPolicyInfos[]`. Flattening a three-step ladder to
one deadline loses the middle tier, and the loss is money: we would believe a rate is fully
refundable until a date when the supplier actually charges 50% from a week earlier. The stored
column is `jsonb` checked to be an object, so a ladder fits at `{"windows": [...]}` without a
migration, but the pricing function and the rate fingerprint both read `->> 'deadline'` and would
need to understand the array. **Do this before the first live rate, not after.**

**5. The schema is hotel-shaped.** No property type, no bedroom count, no whole-unit concept, and
occupancy capped at eight. This is what decides the apartment question.

---

## The providers

| Provider                 | Account this month without accreditation?                              | Fetch by property id                      | Pre-book re-price                                               | Structured cancellation ladder | Net or commission                        |
| ------------------------ | ---------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------- | ------------------------------ | ---------------------------------------- |
| **LiteAPI (Nuitée)**     | **Yes**, fully self-serve, no card for sandbox                         | Yes                                       | Yes, and it reports whether price _or_ cancellation terms moved | Yes, with amounts              | **Either**, your choice                  |
| **Duffel Stays**         | **Yes**, signup in about a minute; KYC before live                     | Yes, ids are stable                       | Yes, an explicit quote step                                     | Yes, but as a _refund_ figure  | Commission profit-share only             |
| **Hotelbeds (HBX)**      | Test key yes, **production needs a signed contract and certification** | Yes                                       | Yes                                                             | Yes, with amounts and dates    | Both                                     |
| **Expedia Rapid**        | No, application reviewed case by case                                  | Yes, up to 250 ids                        | Yes                                                             | **Best in class**              | Both                                     |
| **RateHawk (ETG)**       | **Disputed, see below**                                                | Yes                                       | Yes, but may substitute a different rate                        | Yes                            | Net, credit line                         |
| **TravelgateX**          | Playground yes, real connections no                                    | Yes                                       | Yes                                                             | Cleanest types of any          | You still contract each bedbank yourself |
| **Amadeus Self-Service** | Yes, free tier                                                         | Unconfirmed                               | Yes, behaviour on expiry unverified                             | **Unverified**                 | Published rates, not wholesale           |
| **Booking.com Demand**   | No, needs Managed Affiliate Partner status                             | Only as a filter inside a location search | Yes                                                             | Not verifiable                 | Commission                               |
| **WebBeds**              | No, and **no public documentation at all**                             | Unknown                                   | Unknown                                                         | Unknown                        | Net (inferred)                           |
| **Sabre**                | No, needs a signed agreement and certification                         | Yes                                       | Yes                                                             | Unverified                     | Not published                            |

**One provider where the two research passes disagreed, and it matters.** A third-party source
described RateHawk as roughly two weeks to onboard with no IATA requirement. RateHawk's own
documentation says sandbox credentials come from an account manager, with a 14 to 30 day
certification. The verified reading wins: **RateHawk is sales-gated**, and the optimistic version
came from a vendor-integration blog with an interest in making integrations sound easy. Worth an
enquiry, not a plan.

### Notes worth reading before choosing

**Duffel is commercially the wrong shape for us, and this is the important finding.** It is a
**commission profit-share**, not net rates, and profit share only pays out above $25 a month. We
package a fixed trip price and need to buy the room below what we sell the trip for. A commission
model caps how much margin can be built into a package. Its data quality is fine, the quote step is
a real pre-book check, and its rate object breaks amounts out properly. Its `cancel` response also
returns no refunded amount, so our fifth method would need reconciliation outside the API. Duffel
also carries the licensed-agent role itself, which is genuinely useful for a company with no
accreditation.

**Hotelbeds maps almost one-for-one onto our contract** — `net`, itemised taxes,
`cancellationPolicies[].amount` and `.from`, a `RECHECK` rate type, a `commission` attribute. It
needs a signed contract for production, and the free test key is available today.

**TravelgateX is the right answer later, not now.** One GraphQL schema across many bedbanks, and
the cleanest cancellation types anyone publishes. But you still need your own contract with each
bedbank behind it, which is exactly the barrier we cannot clear at zero volume. Revisit at supplier
three or four. Any per-booking price you have seen quoted is stale; the pricing page now redirects
to a sales form.

**Rule out for now:** WebBeds, because you cannot confirm a pre-book step exists before signing.
Sabre, because it relocates the accreditation problem rather than solving it. Booking.com, because
its cancel response has no refunded-amount field, which fails our fifth method outright.

---

## Can we sell Airbnb-style stays?

Three findings, in order of how much they matter.

**1. Whole-home rentals break our economics, and this is the real answer.** A three-bedroom
apartment is one indivisible product with one price, one cancellation ladder and one damage
deposit. It is not three sellable single rooms. Our entire model is a per-traveler room with a
discount when two people choose to share. Expedia Rapid additionally cannot change a guest name on
a Vrbo booking, cannot hold and resume, and requires that we let the traveler talk directly to the
host. For a group of twelve who each want their own room, whole-home inventory is the wrong shape
regardless of which API supplies it.

**2. The product that does fit is the serviced apartment or aparthotel** — sold per unit but
occupied per person, with hotel-style terms. It is already inside ordinary hotel APIs: Rapid
category 16, Booking.com's apartment type, Hotelbeds aparthotels, RateHawk apartments. **We can
have most of what makes Airbnb attractive without leaving the hotel API we were going to integrate
anyway.** That is the answer to the original question.

**3. If we ever want genuine villas, Interhome is the route.** About 40,000 own-contracted
apartments, villas and chalets with deep France and Italy coverage, and a real distribution API
with a mandatory price check before reservation. Either party can collect payment. Their structured
cancellation output is not documented publicly, which given finding 4 above is the thing to check
first. Access is through an account manager rather than self-serve.

Everything else is a dead end for us. **Rentals United** is the one genuine demand-side API among
the rental platforms, but it is aimed at established OTAs and each partnership is certified
individually. **Hostaway, Guesty, Smoobu, Avantio and Lodgify are supply-side tools**: their API
keys are scoped to a single property manager's own account, so they let a manager distribute their
listings, not let us book across managers. **HomeToGo is metasearch** and defaults to click-out.
Airbnb itself was ruled out separately in `docs/accommodation-sourcing.md`.

---

## Recommendation

**Connect LiteAPI first.** It is the only provider that satisfies all five adapter methods with
genuinely self-serve access and no accreditation. Property-id-first lookup, rates keyed on a hotel
id array, a real pre-book that errors on a stale offer and tells you whether the price _or_ the
cancellation terms moved, booking that returns both an id and a hotel confirmation code, structured
cancellation deadlines with penalty amounts, itemised taxes, board type, payment type, and a
disclosed commission field. Crucially it offers **net rates**, which is what packaging needs. The
core workflow is free. Two small adapter chores: convert decimal amounts to minor units, and treat
a successful pre-book as the expiry proxy, because there is no rate-expiry timestamp.

**Keep Duffel as second.** The adapter exists; do not throw it away. It is the fallback and the
comparison shopper. Be clear that its commission model caps packaging margin and its cancel gives
no refund amount.

**Build Hotelbeds third, on purpose, before the commercial conversation.** Pull the free test key
now and write the adapter against it while volume is zero, because its field names map almost
exactly onto ours. Then walk into the contract discussion with a working, certifiable integration
instead of a pitch. That is the strongest position a zero-volume operator can take into a bedbank
negotiation.

**Do not build anything for apartments yet.** Integrate LiteAPI, then filter to apartment and
aparthotel properties within it. Only add a property type to the schema if that filtering proves
the demand is real.

### LiteAPI, verified against their own documentation (2026-09-08)

Checked before signing up, because the earlier pass drew on third-party sources. Everything here is
from LiteAPI or Nuitée's own pages.

**Apartments and villas are in the supply, which corrects what this document said above.** There is
a real property-type filter: `hotelTypeIds` on both `/hotels/rates` and `/data/hotels`, a
`hotelTypeId` on each hotel record, and a `GET /data/hotelTypes` endpoint that returns the id-to-
name mapping. Their own sample data includes properties called "Apartmani Ani" and "Villa Rosa". So
the aparthotel and serviced-apartment strategy works here rather than needing a separate channel.
The value list is not published, so **pull `/data/hotelTypes` on day one** and record what the ids
actually mean before filtering on them.

**Sign-up is genuinely free.** A sandbox key needs an account and no credit card. Production needs a
card and a payout method, with no contract or KYC step documented. The core workflow, rates then
prebook then book, is free, "assuming a reasonable look-to-book ratio". Paid extras are small and
optional: a price index at $0.05 a request, places at $0.01.

**We choose net or commission.** A `margin` parameter set to 0 gives net rates; set to 15 it adds
15% commission. That is the flexibility a packager needs, and it is the thing Duffel cannot offer.
Note `suggestedSellingPrice`, which is a rate-parity floor on public display; packaging a room
inside a trip price is normally outside that, but it is worth confirming rather than assuming.

**Prebook is the freshness guard, and it is a good one.** It returns `priceDifferencePercent`,
`cancellationChanged` and `boardChanged` — their documentation calls these the three fields to
check. That maps exactly onto our `recheckRate`, and `cancellationChanged` is better than we
currently model, because our recheck only compares price.

**Two things they do not publish, and both need to come from them in writing before we build:**

1. **How many bedbanks sit behind it.** They claim two to three million properties, and the figure
   is inconsistent across their own pages. Their only stated multi-source claim is for flights, not
   hotels, and the rates response carries a single `supplier` of `nuitee` by default. So treat this
   as one broad normalized pool, **not** as a substitute for integrating several wholesalers. If the
   goal is genuinely comparing wholesalers against each other, LiteAPI alone may not deliver it.
2. **The look-to-book ratio.** The published rate limit is 500 requests a second, which a daily
   refresh of a fixed property set never approaches. The real constraint is a look-to-book threshold
   in their terms that is not given a number for hotels. Since our whole design refreshes rates on a
   schedule, agree an expected ratio before building the scheduler.

**Payouts are weekly and follow the stay**, which matters for working capital if we ever sell on
commission rather than buying net.

### Order of work

1. Fix the cancellation ladder in the rate model. It is a money bug waiting for its first live rate.
2. Sign up for LiteAPI, run its sandbox, and write the adapter against real responses.
3. Link one real hotel to one stay option end to end, which also turns the checkout rate recheck
   from a no-op into a working guard.
4. Pull the Hotelbeds test key and build that adapter against it.
5. Decide on Duffel: keep as fallback, or drop it once LiteAPI is proven.
