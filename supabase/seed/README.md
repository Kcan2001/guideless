# Seed data

SQL files in this folder run after migrations on `supabase db reset` (see `[db.seed]` in
`../config.toml`). They are for **local development and staging only** and must never contain
production customer data.

Planned files (added with Milestone 2, the data model):

- `010_roles.sql` — role catalogue
- `020_destinations.sql` — Nice, Avignon, Paris with emergency numbers and time zones
- `030_tour_southern_france.sql` — the "Southern France" tour, v1, with a 9-day itinerary
- `040_departures.sql` — a few open departures with capacity
- `090_dev_users.sql` — local test accounts (customer, trip_staff, admin)

Files run in lexical order; keep the numeric prefixes.
