# ADR-008 — Tours are versioned

**Status:** Accepted
**Date:** 2026-09-06

## Context

A tour ("Southern France") is sold for months. Content staff will change hotels, activities,
copy and pricing over time. A traveler who booked in January must see, and be operated against,
what they bought — not whatever the template says in May.

## Decision

`tours` is a thin identity row (slug, name, `current_version_id`). All content — days, itinerary
items, included/excluded items, FAQs, imagery — hangs off `tour_versions`
(`status: draft → published → archived`). A `departure` references a specific `tour_version_id`
and keeps it forever. Editing a published version creates a new draft; publishing it updates
`tours.current_version_id` for **new** departures only. Moving an existing departure to a newer
version is an explicit, audited staff action.

## Consequences

- Booked customers never see their trip change silently.
- Public tour pages render `current_version_id`; departure pages render their own version.
- Storage grows with versions; acceptable (text and references, images shared by URL).
- Admin UI needs a clear "draft / published / used by N departures" model.

## Alternatives considered

- **Mutable tour + copy-on-book** — leaves departures inconsistent with each other and loses the
  ability to fix a typo for all unsold departures at once.
- **Full event history / temporal tables** — heavier than needed; explicit versions are easier for
  staff to reason about.
