# Policy and public-claims audit — 2026-09-08

A run-through of every policy and public claim on guidelesstravel.com against what the product and
the database actually do. The test applied to each sentence was: if a customer relied on this, could
we honour it, and would the system produce the outcome the sentence describes?

Scope: the 29 URLs in the live sitemap, the Terms of Service, the Privacy Policy, the cancellation
and travel-insurance pages, the FAQ, the host and group-travel pages, and the structured data those
pages emit. Supplier and internal documents in `docs/legal/` were out of scope; they carry their own
review notes.

## Fixed in this pass

### 1. The Booking Agreement was live with its own review markers visible

`/booking-agreement` was serving on production with eight `[NUMBER]` placeholders and four
`[LEGAL REVIEW REQUIRED …]` notes rendered as body text, including the note saying our status as
organiser or agent "must be settled before the first sale". This was my error: I published the draft
in an earlier release. The route, the footer link, the sitemap entry and the checkout label
reference are removed, and the draft stays unpublished in `apps/web/content/legal/booking-agreement.ts`
with a header explaining why. Verified 404 on production, and a sweep of all 29 sitemap URLs plus all
36 internal links now finds no bracketed placeholder text and no broken route.

### 2. Refund promises that contradicted non-refundable extras

The travel-insurance page told customers "add-ons refund in full until their deadline" and Terms
section 4 said the same. Since race viewing became non-refundable from purchase, both were false for
the Monaco add-ons. Corrected in both places. The point-of-sale disclosure was already correct:
`add-on-step.tsx` shows "Non-refundable once booked" and `cancel-booking.tsx` repeats it in the
refund preview.

### 3. Three FAQ answers describing things that do not exist

- **Airport transfers.** The flights answer said "the welcome transfer is arranged around it" as a
  universal claim. Only Southern France includes a transfer; on Monaco it is a paid $120 add-on.
- **Age ranges.** The ages answer said "each trip page shows an age range once enough people have
  booked". There is no such feature anywhere in the web app, the mobile app or the schema.
- **Insurance.** See item 4.

### 4. Insurance described as mandatory on some departures

Terms section 7, the FAQ and the travel-insurance page all said insurance is required on departures
that say so. Nothing in the schema can mark a departure that way, so no departure could ever say so.
Reworded to strongly recommended everywhere and not a condition of booking.

### 5. Consent withdrawal promised a control that did not exist

The Privacy Policy pointed at a cookie-settings link in the footer that was never built, and the
analytics provider treated an absent choice as "unknown" rather than denied, so withdrawal did not
take effect. A footer control now exists and withdrawal applies immediately.

### 6. A group feature described more broadly than it behaves

The group-travel page said "every optional experience shows how many of your group have added it".
The count is suppressed below three travelers, which is the right privacy behaviour. Copy now matches.

## Open, and needing your decision

### A. Applied account credit is forfeited when a booking is cancelled

The strongest finding, and a money bug rather than a copy gap. At checkout, `quote_booking` writes a
negative `account_credits` row for the credit the traveler applied. On cancellation, `previewRefund`
computes the refund from `amount_paid`, which is card money only, and nothing reverses that negative
row. A traveler who applies $175 of referral credit and cancels at the 90% tier gets 90% of the cash
back and loses 100% of the credit. Three options: restore the credit in full, restore it at the same
tier percentage as the cash, or keep the current behaviour and say so in the terms. This is a
commercial decision, so nothing has been changed.

### B. The host offer has no amount and no implementation

Terms now cover account credit: no cash value, not transferable, base trip price only, no expiry,
earned on a confirmed booking and reversed if that booking is cancelled, and the host free spot
requiring the stated number of travelers booked and confirmed with cancellations not counting. That
closes the referral side.

The host side is still open because it needs a number from you. `/host` advertises "bring 8
travelers, travel free" and, below that, "a credit for every traveler you bring" with no amount
stated anywhere. `host_reward` exists only as an allowed value in the `account_credits` source
check; nothing in the schema or the app ever writes one. Neither the per-traveler credit nor the free
spot at eight is granted by any code. Both are manual staff actions today, and the per-traveler
credit has no published amount at all. Set the amount and the page can say it.

### C. The 18-and-over rule is stated everywhere and enforced nowhere

Terms section 8, the FAQ and the Privacy Policy all say travelers must be 18 or older, and the
Privacy Policy adds that we "do not knowingly collect data from anyone under 18". We do collect a
date of birth for every traveler, so we would know. `travelerInputSchema` and `travelerUpdateSchema`
in `packages/validation/src/booking.ts` only require that the date is in the past, and `create_booking`
applies no age rule either, so a checkout naming a child completes normally.

Fixing it properly needs a decision, which is why nothing has been changed. The rule as written is
"18 at the start of the trip, unless a departure states otherwise", and there is no field on a
departure that can state otherwise — the same missing mechanism as the insurance requirement. So the
choice is either to drop the exception and enforce eighteen at the departure date inside
`create_booking`, which is the correct place because the client must not be trusted with it, or to
add a per-departure minimum age and enforce against that. Enforcing at checkout also has to reject
gracefully, since the traveler learns about it after entering passport details.

Nothing on the site is false today, because no departure claims an exception. The exposure is that
we publish an age floor we cannot show we applied.

### D. Southern France still publishes placeholder prices against live Stripe keys

Half-closed while this audit was running. Monaco was repriced in the same session from published
supplier figures and now carries real dates, so the structured data that page emits to search engines
is a price we would honour. Southern France was not: its departures, tier deltas and add-on prices
are still invented seed values, and its pages publish them with `availability: InStock`. Stripe is
live, so a placeholder price is a real charge. That trip must not be sold until it is repriced. See
`docs/pricing.md` and the pre-sale gate in `docs/go-live.md`.

### E. Regulatory items already logged for the attorney

Both are in `docs/legal/README.md` and neither has moved: California Seller of Travel registration
with the CST number in advertising and Travel Consumer Restitution Fund participation, and the
organiser-versus-agent question that determines who is responsible when a supplier fails. The site
currently declares `TravelAgency` in its Organization structured data while that question is open.

### F. The accepted-terms version is now dated

`brand.termsVersion` was the month string `2026-09`, and every booking stores it as the edition the
customer accepted. This revision changed the contract materially inside that same month, so one
string would have named two different documents. It is now `2026-09-08`, and the Privacy Policy has
its own `privacyVersion` rather than borrowing the Terms' number, since it revises on a different
schedule and is not part of the booking contract. No bookings exist yet, so nothing is ambiguous in
the record.

### G. Operational

Five inboxes are published across the contact page and the legal documents and all five must route
somewhere: hello, support, bookings, finance and partners at guidelesstravel.com.

`HOST_FREE_SPOT_THRESHOLD` in `apps/web/lib/data/community.ts` hardcodes 8, duplicating the
`host_free_spot_threshold` settings row. The public host page renders the constant, so changing the
setting would leave the marketing page advertising the old number.

`brand.termsVersion` is a month string, `2026-09`, and every booking stores it to record which terms
the customer accepted. Today's revision changed the contract materially inside that same month, so
`2026-09` would now name two different documents. No bookings exist yet, so nothing is ambiguous in
practice, but the scheme needs finer granularity before the first sale.

## Checked and correct

Payment and trip reminders run on a real daily cron rather than being promised and left manual. The
reviews page emits no `aggregateRating` while it has no reviews. There are no invented volume or
social-proof numbers anywhere in the marketing copy. Production `robots.txt` excludes checkout,
account, trips, admin and api, and staging sits behind Vercel deployment protection so it cannot be
crawled or indexed. The sign-in page correctly hides the Google button while the provider is
disabled. Cancellation tiers, deposits and balances match what `quote_booking` and `previewRefund`
compute. Terms section 3 says places "are held for a short time only" before payment, and that is
real: `create_booking` reads `booking_hold_minutes` from settings and writes `hold_expires_at`, the
capacity guard counts unexpired pending bookings against the departure, and a scheduled job releases
expired holds.
