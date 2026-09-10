# Hotel inventory

Milestone 3 of plan v2 (`docs/plan-v2-audit.md` §8) and the architecture in
`docs/strategy-v3-direction.md` §3. Guideless does not become a hotel search engine: staff curate a
few properties per destination and tier, and supplier APIs price them behind the scenes.

```
Guideless hotel catalog (hotels, hotel_rooms)      ← staff curate, /admin/hotels
        │  hotel_supplier_mappings                 ← "this property is acc_… at Duffel"
        ▼
  HotelSupplier adapters   DuffelSupplier · MockSupplier · (Expedia Rapid, Hotelbeds later)
        │  Promise.allSettled, 4 s search / 8 s quote+book timeouts, typed HotelSupplierError
        ▼
  NormalizedRate / NormalizedHotel                  ← lib/hotels/types.ts, normalize.ts
        ▼
  hotel_rates (staff-only; service role writes)     ← lib/hotels/search.ts, nightly cron
        ▼
  pricing_rules → suggest_stay_price()              ← /admin/pricing, shown on /admin/hotels/[id]
        ▼
  departure_stay_options.price_delta_amount         ← "Use suggested delta" (staff decides)
        ▼
  Trip Builder quote (quote_booking, unchanged)     ← customers never see supplier or net
        ▼
  startCheckout → recheckStayRate()                 ← live quote vs stored; > 5 % or gone → refuse
```

## Files

| Path                                                                             | Role                                                                                                                                                                      |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/lib/hotels/types.ts`                                                   | `HotelSupplier` interface, `NormalizedHotel`, `NormalizedRate`, `PricedRate`, `HotelSearchInput`                                                                          |
| `apps/web/lib/hotels/normalize.ts`, `fingerprint.ts`, `compare.ts`, `pricing.ts` | Pure helpers: money/date normalisation, rate fingerprint (hotel + room + bed + occupancy + refundable + policy + breakfast + payment type), offer selection, markup rules |
| `apps/web/lib/hotels/suppliers/shared.ts`                                        | `HotelSupplierError`, timeouts, `withTimeout` (no `server-only`, unit-testable)                                                                                           |
| `apps/web/lib/hotels/suppliers/duffel.ts`                                        | Duffel Stays adapter                                                                                                                                                      |
| `apps/web/lib/hotels/suppliers/mock.ts`                                          | Deterministic fixture supplier (`__fixtures__/mock-hotels.json`)                                                                                                          |
| `apps/web/lib/hotels/suppliers/index.ts`                                         | `getHotelSupplier()` from env (server-only)                                                                                                                               |
| `apps/web/lib/hotels/catalog.ts`                                                 | Admin read models, `resolveStayContexts` (one per city), `bestStoredRate`, `suggestStayPrice`                                                                             |
| `apps/web/lib/hotels/search.ts`                                                  | `refreshRatesForStayOption`, `refreshRatesForDeparture`, `listStayOptionsToRefresh`                                                                                       |
| `apps/web/lib/hotels/recheck.ts`                                                 | `recheckStayRate` — stored vs live                                                                                                                                        |
| `apps/web/lib/hotels/booking.ts`, `cancellation.ts`                              | `bookHotelForBooking`, `cancelHotelBooking` (staff-triggered)                                                                                                             |
| `apps/web/app/admin/hotels/**`, `admin/pricing`                                  | Admin screens                                                                                                                                                             |
| `apps/web/app/api/cron/hotel-rates/route.ts`                                     | Nightly refresh (`vercel.json` crons, 04:15 UTC)                                                                                                                          |

## Environment

| Variable              | Where           | Meaning                                                                                                          |
| --------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------- |
| `HOTEL_SUPPLIER`      | Vercel (server) | `mock` (default) or `duffel`. Anything but a configured `duffel` falls back to the mock with one console warning |
| `DUFFEL_ACCESS_TOKEN` | Vercel (server) | Duffel API token. Test-mode tokens hit Duffel's sandbox; never `NEXT_PUBLIC_`                                    |
| `CRON_SECRET`         | Vercel (server) | Vercel sends it as `Authorization: Bearer …` to `/api/cron/*`; the route returns 503 when unset                  |

## Duffel Stays adapter

Endpoints used (API version `v2`, JSON bodies wrapped in `{ data: … }`):

| Step      | Call                                                      | Notes                                                                                    |
| --------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| search    | `POST /stays/search`                                      | `accommodation.ids` of the mapped properties only (curated catalog, never a free search) |
| all rates | `POST /stays/search_results/{id}/actions/fetch_all_rates` | rooms × rates for one search result                                                      |
| recheck   | `POST /stays/quotes` `{ rate_id }`                        | our "recheck": re-priced total, expiry, cancellation timeline; 404 → rate withdrawn      |
| book      | `POST /stays/quotes` then `POST /stays/bookings`          | booking needs a quote id, guests (given/family name), email, phone                       |
| cancel    | `POST /stays/bookings/{id}/actions/cancel`                |                                                                                          |

Normalisation rules: amounts are decimal strings in major units → integer minor units;
`board_type` in `breakfast | half_board | full_board | all_inclusive` → `breakfastIncluded`;
`payment_type === "pay_now"` → `pay_now`, anything else → `pay_at_property`; a rate is refundable when
some `cancellation_timeline` step still in the future refunds the full total; `quantity_available`
(or `available_rooms`) of 0 → unavailable, absent → available.

**Unverified against a live account** (Kyle has no Duffel account yet; verify on the first sandbox
call): exact `payment_type` values other than `pay_now`; whether `quantity_available` or
`available_rooms` is the populated field; whether `expires_at` exists on rates or only on quotes;
child guests need an age (we send 8 when the catalog only knows a count).

## A tier is a list of hotels, not a hotel

`departure_stay_options.hotel_id` holds the property a **single-city** tier is priced against, and
that property covers the whole departure — check in on the start date, check out on the end date.
Monaco is five nights in one place, so that is exactly right there.

Multi-city trips use `departure_stay_legs` (migration `20260910001000`): one row per city, each with
its own hotel, its own room and its own dates.

```
departure_stay_options  ── legs ──▶  departure_stay_legs (hotel_id, check_in, check_out, position)
        │  no legs → the anchor hotel_id covers the whole departure
        ▼
  stay_option_hotels_public          ← ONE ROW PER CITY; group by stay_option_id, order by position
        ▼
  resolveStayContexts(stayOptionId)  ← StayContext[] — one per leg, or one for the anchor
```

Everything downstream takes the list:

- **Rate refresh** fetches each leg separately and deletes/replaces only that leg's dates, so
  refreshing Paris cannot wipe the Nice rates.
- **Live pricing** SUMS the legs. A tier with any leg missing a rate stays unpriced and names the
  city that was missing — a partial sum would look like a bargain and be a loss.
- **Recheck at checkout** compares the sum. Checking only the first leg would pass a tier whose
  Paris hotel had doubled.
- **Supplier booking** refuses a multi-leg tier outright (`multi_leg_unsupported`): three cities is
  three supplier bookings and `hotel_bookings` records one, so booking the first leg would look
  like success and leave the traveler with no bed in the other two.

Southern France is the first trip on this shape: three nights in Nice, two in Avignon, three in
Paris, four tiers, twelve properties (`supabase/seed/091_southern_france_real_hotels.sql`).

**Inventory has a horizon.** Most hotels release rooms about twelve months ahead, so a departure
further out than that cannot be tier-assigned at all — see `docs/tier-classification.md` Step 1b for
the measurements and the rule. Such a departure keeps its ladder, links no properties and sets
`auto_price = false` until the weekly job can see real rates.

## Adding a hotel

1. `/admin/hotels` → Add hotel: name as contracted, destination, address, coordinates. Stars only
   for contracted properties (plan v2 §10). Active = selectable on stay options.
2. On the hotel page add **rooms** (names matching the supplier's room names so rates filter) and a
   **supplier mapping** (`duffel` + the `acc_…` id; optionally per room).
3. On the departure, edit the stay tier and pick the **linked hotel** (and room). On a multi-city
   trip add a `departure_stay_legs` row per city instead, with that city's dates. The tier's
   copy, photos and public price stay exactly as staff set them.
4. **Refresh rates** on the hotel page (or wait for the nightly job). The stay-tiers table shows the
   best stored rate for two adults, the matched pricing rule's markup and a suggested per-traveler
   delta; **Use suggested delta** writes it to the tier. Nothing changes a customer price
   automatically.

## Pricing rules

`/admin/pricing` (finance roles). A rule targets a destination and/or a hotel (blank = everywhere)
and carries `percentage_markup`, `fixed_markup_amount`, `min_markup_amount`, a `priority` and an
optional effective window. `suggest_stay_price()` picks the highest-priority active rule that
matches and returns customer amounts per stored rate. Supplier net, taxes and fees are staff-only.

## Recheck at checkout

`startCheckout` calls `recheckStayRate(stayOptionId, adults)` before `create_booking`. When the tier
has a linked hotel **and** a stored rate: the supplier is asked to re-quote the stored rate; if it
is gone, unavailable, or more than 5 % above the stored total, the action refuses with "The hotel
price for this option changed. Please choose again." and logs `stay_rate_changed`. No hold is
created in that case. Tiers without a hotel (all of today's catalog) skip the check.

## What is manual today

- Booking the hotel with the supplier: staff run **bookHotelForBookingAction** from a booking (it
  records `hotel_bookings` from the best stored rate; with "confirm with supplier" it books via the
  adapter). Automatic supplier booking when the Stripe webhook confirms payment is a later step.
- Cancellations: `cancelHotelBookingAction` cancels with the supplier and marks the row.
- Only one supplier runs at a time (`HOTEL_SUPPLIER`); the mock presents itself as the `manual` supplier id, so map hotels to `manual` on local and staging. Multi-supplier fan-out and the rate
  comparison across suppliers use the same interface and arrive with the Expedia adapter.
- Customer-facing hotel names still come from the stay option copy; `hotel_confirmed` in the tier
  details drives the "property confirmed at booking" line.
