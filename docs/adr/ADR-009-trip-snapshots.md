# ADR-009 — Departures snapshot into trips

**Status:** Accepted
**Date:** 2026-09-06

## Context

Even with versioned tours (ADR-008), the operational reality of a specific departure diverges
from its template: a hotel is swapped for one group, a train time changes, a welcome dinner moves.
Staff need to edit _this departure's_ itinerary without touching the template or other departures,
and travelers need a stable record of what actually happened.

## Decision

When a departure is activated (a staff action, typically ~30 days out, or automatically at
booking-confirmation of the first traveler), the platform copies the tour version's days and
items into `trips`, `trip_days`, `trip_itinerary_items` — one trip per departure group. From then
on staff edit the trip tables; the template is read-only for that departure. Trip items keep a
nullable `source_item_id` back-reference for diffing and "re-sync from template" tooling.

## Consequences

- Operational edits are scoped, auditable (`itinerary_changed`) and can trigger targeted
  notifications ("Your train time changed").
- The traveler's mobile app reads only `trip_*` tables; it never joins the template.
- Completed trips remain an accurate history for recaps, support and disputes.
- Two similar schemas (tour_* and trip_*) must be kept aligned; a shared column set is documented
  in database.md and enforced by a test that compares generated types.

## Alternatives considered

- **Overlay/patch table on top of the template** — clever, but every read becomes a merge and
  RLS becomes harder to reason about.
- **Edit the template per departure** — breaks other departures sharing the version.
