# ADR-012: Guideless is modeled as a travel organizer, not a software company

**Status:** Accepted 2026-09-07
**Context:** `docs/business-readiness.md`

## Context

Guideless sells accommodation, rail, transfers and selected experiences as one purchase, takes the
customer's money, and contracts with the suppliers itself. Under US state seller-of-travel laws and
the EU Package Travel Directive that makes Guideless the *organizer* of a package, with obligations
around registration, disclosures, insolvency protection, refunds and performance. The codebase so
far treated Guideless as a marketplace-like website: `included` vs `optional` items, a free-text
cancellation policy per departure, a confirmation email, no supplier contracts, no record of what
was legally sold.

## Decision

1. The platform models Guideless as the organizer. Every itinerary item and add-on carries an
   explicit `provision` (`organized`, `recommended`, `third_party_direct`) and the website, checkout
   and confirmation state which relationship applies.
2. Every booking produces a versioned booking document (PDF, stored in `booking_documents`) that
   is the contract record; the confirmation email links to it. New version on every change.
3. A compliance layer exists in the database and admin: legal entity, travel registrations,
   insurance policies and certificates, supplier contracts and insurance, terms versions and
   consents, incident reports and claims. All staff-only, all audited.
4. Supplier operations is a first-class admin domain (`supplier_bookings`, manifests, run-sheets,
   daily digest), distinct from the traveler-facing app.
5. Reviews are tied to completed bookings (`verified`) and only verified, published reviews are
   ever shown. No seeded or imported testimonials.
6. Legal and insurance decisions (which registrations, which policies, what the terms say) are
   made by counsel and a broker and recorded in the compliance tables; the platform displays and
   enforces them, it does not decide them.

## Consequences

- New migrations: `provision` column; `reviews`; `supplier_bookings`; the compliance tables;
  named `cancellation_policies` / `refund_policies` replacing per-departure jsonb over time.
- New Edge Function: booking document generator. New admin areas: `/admin/compliance`,
  `/admin/operations`.
- Copy and legal pages change once counsel positions the company; California Seller of Travel
  number appears in advertising when issued.
- Real inbound email on the domain is a prerequisite (Google Workspace), because the organizer
  must be reachable.
- Launch sequencing changes: the website can be live, but selling to strangers waits for
  registrations, insurance and supplier contracts (`docs/business-readiness.md` §0).
