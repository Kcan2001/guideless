# Launch & Business Readiness

_Written 2026-09-07 after the site went live. Companion to `docs/guideless_travel_master_plan_v2.md`,
`docs/plan-v2-audit.md` and `docs/roadmap.md`. Decision record: `docs/adr/ADR-012-travel-organizer.md`._

The software is ahead of the business. The website, booking engine, admin and companion app exist;
what does not exist yet is the operating company behind them: an inbox that receives mail, a legal
position on what Guideless is when it sells a hotel + train + boat as one purchase, insurance that
covers that position, contracts with the suppliers, and the operations layer that turns "17 people
bought the boat" into a confirmed boat. None of these are software problems, but every one of them
changes what the software has to record and show. This document names them, ranks them and states
what the platform must do about each.

## 0. Priority order (replaces the order in docs/roadmap.md §5 for launch planning)

| Priority | Workstream                                   | Gate it protects                                   |
| -------- | -------------------------------------------- | -------------------------------------------------- |
| **P0**   | Communications — real inbound email          | Any customer-facing email; Google Play org account |
| **P0**   | Legal, insurance, travel-operator compliance | Selling packaged trips at all                      |
| **P1**   | Product positioning (plan v2 Milestone 1)    | A stranger understands why in 10 seconds           |
| **P1**   | Trust — founding trips, verified reviews     | Selling the second season                          |
| **P1**   | Supplier operations                          | Running 10+ departures without spreadsheets        |
| **P2**   | Trip Builder (plan v2 §13–18)                | Revenue per traveler                               |
| **P3**   | Inventory and live pricing                   | Scale beyond hand-managed hotels                   |
| **P4**   | App completeness                             | In-trip promise                                    |
| **P5**   | Social proof surfaces                        | Conversion                                         |
| **P6**   | Growth                                       | Volume                                             |

"P0" means: do not take money from a stranger until it is done.

## 1. P0 — Communications

**Problem.** `hello@guidelesstravel.com` is the reply-to on every transactional email and the support
address on Stripe, Meta and the legal pages, but the domain has no mailbox and no MX record. Replies
bounce. Google Play also requires an operational, verified organization email for an organization
developer account.

**Decision.** Google Workspace on `guidelesstravel.com`, one paid seat for Kyle, everything else as
free aliases or groups:

| Address                      | Type         | Purpose                                     |
| ---------------------------- | ------------ | ------------------------------------------- |
| kyle@guidelesstravel.com     | user (paid)  | Admin account, owner of every SaaS login    |
| hello@guidelesstravel.com    | group → kyle | Primary customer inbox, reply-to for Resend |
| support@guidelesstravel.com  | group → kyle | Support threads (admin inbox mirrors it)    |
| bookings@guidelesstravel.com | group → kyle | Booking and operations confirmations        |
| partners@guidelesstravel.com | group → kyle | Hotels, transport, activity suppliers       |
| finance@guidelesstravel.com  | group → kyle | Stripe payouts, invoices, accounting        |

Groups are free, keep a shared history, and can be handed to a second person later without changing
any public address.

**Platform work.**

- DNS: Google's MX records plus the Workspace verification TXT at Squarespace; keep Resend's DKIM
  and `send`/`rsend` records; SPF must include both Resend and Google (`v=spf1
include:_spf.google.com include:amazonses.com ~all` or the record Resend prescribes for the
  `send` subdomain); DMARC `p=quarantine` once mail flows both ways.
- Resend: `EMAIL_FROM` stays `hello@guidelesstravel.com`; add `reply_to` on every template.
- Third-party accounts: move Stripe support email, Meta business email, Google Play and Apple
  developer contacts, Pinterest, PostHog, Sentry and Vercel notifications to the new addresses.
- Admin: the support inbox (`/admin/support`) should ingest `support@` mail later (Resend inbound
  webhook), not today.

**Status 2026-09-07: DONE.** Google Workspace is live on `guidelesstravel.com` (admin
`kyle@guidelesstravel.com`, one paid seat). DNS at Squarespace: `MX @ 1 smtp.google.com` and
`TXT @ v=spf1 include:_spf.google.com ~all`, alongside the untouched Resend DKIM and `send`/`rsend`
records. The five shared addresses exist as Google Groups, each delivering to `kyle@`:
`hello@`, `support@`, `bookings@`, `partners@`, `finance@` (access type Public, external senders
allowed to post, membership invite-only). A Resend → `hello@` round-trip was sent to verify
delivery. The web app publishes them where each one belongs: `/contact` carries a "Where to write" block
(hello, support, finance, partners), checkout and in-trip surfaces point at `support@`, and
outgoing mail from `apps/web/lib/email/send.ts` now sets a reply-to of `support@` so a traveler can
answer a booking email. Addresses live in `packages/config/src/emails.ts`; `bookings@` stays an
operations mailbox and is not shown to customers. Remaining: turn on Gmail DKIM ("Authenticate
outgoing emails" in the Workspace setup), tighten `_dmarc` to `p=quarantine` once both directions
are proven, switch the mobile support screen from `hello@` to `support@`, and repoint the
third-party account contacts (Stripe, Meta, Play, Apple, Pinterest, PostHog, Sentry, Vercel) to the
new addresses.

## 2. P0 — Legal, insurance and travel-operator compliance

**Problem.** Guideless sells accommodation + transport + excursions through a single point of sale
and takes payment for the whole. In most jurisdictions that is a _package_, and the seller is the
_organizer_, responsible for performance, refunds and insolvency protection — not a website that
"recommends hotels". Nothing in the company or the platform reflects that yet.

**This is a workstream, not a task.** It has an outside lawyer and an insurance broker in it, and it
finishes before serious sales, not before launch of the website.

### 2.1 Travel-operator compliance

Determine, per jurisdiction where customers are solicited, what Guideless LLC legally is and what
that requires. Known items to have the lawyer confirm:

| Jurisdiction | Regime                                             | Likely requirement                                                                                                                                                                                                                                                                                                                     |
| ------------ | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| California   | Seller of Travel Law (Attorney General registry)   | Register before selling to CA residents; show the CST number in all advertising; Travel Consumer Restitution Fund participation                                                                                                                                                                                                        |
| Florida      | Sellers of Travel Act (FDACS)                      | Annual registration; surety bond or performance assurance                                                                                                                                                                                                                                                                              |
| Hawaii       | Travel agency registration (DCCA)                  | Registration; client trust account                                                                                                                                                                                                                                                                                                     |
| Washington   | Sellers of Travel (DOL)                            | Registration; trust account or bond                                                                                                                                                                                                                                                                                                    |
| Other states | Check when marketing there                         | Iowa, Nevada, Illinois, Delaware (home state) have lighter or no regimes                                                                                                                                                                                                                                                               |
| EU           | Package Travel Directive (2015/2302, amended 2026) | Applies when selling packages to EU consumers; pre-contractual information, organizer liability, insolvency protection, refund deadlines. Selling from the US to US residents traveling _in_ Europe does not by itself make Guideless an EU organizer, but the suppliers are EU businesses and the trips happen there — get an opinion |
| Delaware     | LLC home state                                     | Registered agent (ZenBusiness) in place; annual franchise tax                                                                                                                                                                                                                                                                          |

Deliverables: written opinion, list of registrations to file with dates and costs, the CST/other
numbers to display, trust-account or bond requirements, and the customer-facing disclosures each
regime requires.

### 2.2 Insurance

Talk to a travel-industry broker (not a generic small-business agent) and price at least:

| Coverage                                         | Why                                                                                           |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Commercial general liability                     | Third-party injury or property damage on a trip                                               |
| Professional liability / E&O, tour-operator form | Booking errors, supplier failures, itinerary mistakes, wrong information, missed arrangements |
| Cyber liability                                  | Customer accounts, travel documents, chat, payment-adjacent data                              |
| Crime / fraud                                    | Once supplier prepayments and customer funds are meaningful                                   |
| Hired / non-owned auto                           | If transfers are arranged with drivers                                                        |
| Event- and activity-specific                     | Boats, race hospitality, adventure activities — often excluded from base policies             |
| Workers' compensation                            | When there are employees                                                                      |

The question for the broker is not "do we have insurance" but "does this policy cover us acting as
the organizer of packaged travel where we contract with hotels, rail, boats and activity operators
in France and Monaco". Ask suppliers for certificates of insurance naming Guideless as additional
insured where the activity warrants it.

### 2.3 Contracts and terms

- Supplier contracts with every hotel, transport and activity supplier: services, dates, price,
  payment terms, cancellation terms, capacity, liability, insurance, emergency contact.
- Customer terms: refresh `/terms` and the booking-time consent once the lawyer has positioned the
  company; cancellation and refund policy per departure already exists as data
  (`departures.cancellation_policy`) and must match the published terms.
- Refund procedures: who authorizes, from which funds, within what deadline.
- Privacy: the current policy covers analytics and accounts; extend for traveler documents and any
  trust-account handling.

### 2.4 Legal architecture in the product

The Trip Builder and every confirmation must distinguish two relationships and say so in words:

| Relationship                 | Example                                                          | Who is responsible              |
| ---------------------------- | ---------------------------------------------------------------- | ------------------------------- |
| Guideless-organized          | Hotel, train Nice→Avignon, welcome drinks, race terrace, boat    | Guideless LLC (organizer)       |
| Third-party, booked directly | Flight to Nice, travel insurance, a restaurant we only recommend | The supplier; Guideless informs |

Data model consequence: `tour_itinerary_items` / `trip_itinerary_items` and `departure_add_ons`
need a `provision` column (`organized` \| `recommended` \| `third_party_direct`) and the UI must
render the distinction on the itinerary, in checkout and in the confirmation. Today `included`
vs `optional` exists; it is a pricing flag, not a liability flag.

### 2.5 Booking documents

"Thanks, your trip is confirmed" is not a contract. Each booking needs a durable document, versioned
and stored, containing: trip and departure, every traveler, the exact services purchased with
dates, hotel and room, transport segments, activities and add-ons, price with taxes and fees,
payment schedule and what has been paid, cancellation and refund terms as of purchase, supplier
information where the customer deals with the supplier, what Guideless is responsible for versus the
supplier, emergency and support contacts, and the terms version accepted. Regenerate a new version
on every change (add-on purchase, traveler edit, cancellation) and keep every version. The EU
directive's pre-contractual information and contract requirements are the checklist even for US
customers; it is the strictest reasonable standard.

Platform: a `booking_documents` row already exists as a file store (migration 021). It becomes the
target of a generated PDF per version; the generator lives in an Edge Function fed by
`bookings_public` + snapshot tables, never by the client.

### 2.6 Database: compliance layer

New tables, one migration per group, all RLS staff-only (finance/admin) unless noted:

| Group     | Tables                                                                                                                                                                                   |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entity    | `legal_entities` (name, EIN, state, addresses, registered agent), `travel_registrations` (jurisdiction, number, status, expires_at, bond/trust details), `travel_registration_documents` |
| Insurance | `insurance_policies` (carrier, type, limits, effective/expires), `insurance_certificates`                                                                                                |
| Suppliers | `supplier_contracts`, `supplier_insurance`, `supplier_documents` — extend the existing `suppliers` (migration 009) rather than replace it                                                |
| Terms     | `terms_versions`, `booking_terms` (which version each booking accepted), `booking_document_versions`, `traveler_consents`                                                                |
| Policies  | `refund_policies`, `cancellation_policies` as named, versioned records referenced by departures instead of free jsonb                                                                    |
| Incidents | `incident_reports`, `claims` (linked to departure, traveler, supplier, insurance policy)                                                                                                 |

`audit_logs` (migration 022) already exists; every table above gets the audit trigger.

### 2.7 Admin: compliance dashboard

`/admin/compliance` with four panels: Business (entity, DBA, EIN, addresses, D-U-N-S), Travel
registrations (jurisdiction / status / expiration), Insurance (policy / carrier / expiration, with
expiry warnings 60 days out) and Suppliers (every supplier: contract, certificate of insurance,
emergency contact, cancellation terms, payment terms, active). It is a read-mostly dashboard over
the tables in §2.6, staff roles `admin` and `finance`.

## 3. P1 — Trust: founding trips and verified reviews

Do not manufacture social proof. Treat the first departures as **founding trips** and build the
machinery now so that every review the site shows is tied to a completed booking.

**Post-trip review** (sent by the notification dispatcher two days after `end_date`, in-app and
email): overall rating plus structured ratings for organization, accommodation, activities, app and
value; "would you travel Guideless again?", "would you recommend Guideless to a friend?" (the NPS
question), free text "what did you like most?". Second step: traveler-generated content — photos,
videos, Instagram handle, explicit permission to reuse, which feeds the social pipeline
(`/admin/social`) and a "What it's actually like" section on tour pages.

**Table** (one migration, pgTAP for the publish rules):

```
reviews
  id, traveler_id, booking_id, departure_id, tour_id,
  rating_overall, rating_organization, rating_accommodation, rating_activities, rating_app, rating_value,
  would_repeat boolean, would_recommend smallint (0–10), title, body,
  photos jsonb, ugc_permission boolean,
  verified boolean  -- true only when booking_id is a confirmed, completed booking of that departure
  published boolean, published_at, created_at, updated_at
```

RLS: traveler inserts/edits own review for own completed booking; public reads `published and
verified`; content staff publish. Website shows "★ 4.9 · 37 verified travelers" only from
`published and verified` rows, so nothing is ever faked and the count is honest at zero.

## 4. P1 — Supplier operations

The customer sees "Add boat — $210". Guideless needs to see, per departure and per add-on:
purchased count, supplier, date and time, capacity, supplier cost and what has been paid, supplier
confirmation number, on-site contact and emergency phone, meeting point, and the delta since
yesterday (added, cancelled). This is the operating system of the company, separate from the app.

Existing pieces: `suppliers`, `supplier_services` (staff-only costs, migration 009),
`departure_add_ons` / `booking_add_ons` (migration 029), manifests in admin. Missing:

- `supplier_bookings`: one row per departure × supplier service — status (requested, confirmed,
  paid, cancelled), confirmation number, cost, paid amount, due date, contact, meeting point,
  notes; linked to the add-on or itinerary item it fulfills.
- Manifest per supplier booking: travelers, dietary/accessibility notes, changes since last export.
- Daily ops digest to `bookings@`: new purchases, cancellations, unconfirmed supplier bookings
  within 14 days, supplier payments due.
- Admin `/admin/operations/[departure]`: the run-sheet for the departure, day by day, supplier by
  supplier.

## 5. Sequencing

1. **This week (Kyle + accounts):** Google Workspace, MX/SPF/DMARC, move the support addresses;
   engage a travel attorney (California Seller of Travel first) and a travel insurance broker;
   ask the Monaco and Provence suppliers for written terms and certificates of insurance.
2. **Next two weeks (platform):** migrations for `reviews`, `provision` flag, `supplier_bookings`
   and the compliance layer; booking document generator; `/admin/compliance` and
   `/admin/operations`; post-trip review flow in the app and dispatcher.
3. **Before serious sales:** registrations filed, insurance bound, terms and cancellation policy
   re-issued by counsel, supplier contracts signed, one full dry run of a booking document.

Everything in §2 and §4 is decided here at the architecture level; the individual migrations and
screens follow the normal feature workflow (migration → RLS → pgTAP → service → web → mobile →
docs) and each gets its own row in `docs/database.md`.
