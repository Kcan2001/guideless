# Database

Derived from the master spec §16–21, §36–43, §56–57, §61–62, §72, §104–109, §117.
Postgres on Supabase is the **system of record**. Schema changes happen only through
`supabase/migrations`. Regenerate `packages/types/src/database.ts` with `pnpm db:types`.

## Conventions

- `uuid` primary keys via `gen_random_uuid()`; `created_at`/`updated_at timestamptz` on every
  mutable table (`set_updated_at()` trigger from migration 001).
- Enums are Postgres enum types whose values match `@guideless/types` exactly.
- Money: `amount bigint` (minor units) + `currency char(3)` with a check against supported codes.
- Time: `*_at timestamptz` (UTC) plus a `timezone text` (IANA) on every travel event.
- `snake_case` tables and columns; singular enum type names (`booking_status`), plural tables.
- Soft-delete only where legally required (financial records); otherwise real deletes with audit.
- Every table has RLS enabled before it receives data. See [security.md](./security.md).

## Domain model

```
destinations ──< tours ──< tour_versions ──< tour_days ──< tour_itinerary_items
                              │
                              └──< departures ──< departure_groups ──< trip_members >── profiles
                                      │                                     │
                                      ├──< bookings ──< booking_travelers ──┘
                                      │        └──< payments, refunds
                                      └──< trips ──< trip_days ──< trip_itinerary_items
                                               ├──< trip_documents, trip_notes(staff), live_moments
                                               └──< chat_rooms ──< chat_members, messages
```

### Identity

| Table                 | Notes                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `profiles`            | 1:1 with `auth.users`. Display name, avatar, preferred language, home country, public-visibility flags.    |
| `roles`, `user_roles` | Role catalogue and assignment. `customer` is implicit for any auth user.                                   |
| `traveler_profiles`   | Travelers are **not** users. Legal name, DOB, nationality, dietary/room/accessibility. Optional `user_id`. |
| `emergency_contacts`  | Per traveler.                                                                                              |

### Product (template — edited by content staff)

| Table                                                     | Notes                                                                               |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `destinations`                                            | Slug, name, country, `timezone`, emergency numbers, SEO fields.                     |
| `tours`                                                   | Slug, name, `current_version_id`, group size min/max, activity level.               |
| `tour_versions`                                           | `status: draft/published/archived`, version number. Content lives here.             |
| `tour_days`, `tour_itinerary_items`                       | Template itinerary. Items carry `type`, `responsibility`, `optional`, `visibility`. |
| `tour_included_items`, `tour_excluded_items`, `tour_faqs` | Per version.                                                                        |

### Operations

| Table                                                             | Notes                                                                                                                                                       |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `departures`                                                      | `tour_version_id`, start/end dates, `timezone`, price + deposit (minor units), `capacity`, `status`, booking deadline, cancellation policy (`jsonb` tiers). |
| `departure_groups`                                                | One or more per departure.                                                                                                                                  |
| `trip_members`                                                    | (`trip_id`, `user_id`) unique. The RLS pivot for everything trip-scoped.                                                                                    |
| `suppliers`, `supplier_contacts`, `supplier_services`             | Generic supplier model: confirmation number, **cost (staff-only)**, status, cancellation deadline, documents, internal notes.                               |
| `accommodations`, `transport_segments`, `activities`, `transfers` | Logistics linked from itinerary items and supplier services.                                                                                                |

### Booking and payments

| Table                 | Notes                                                                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bookings`            | `status booking_status`, `payment_status payment_status` (separate!), unique `confirmation_number`, totals in minor units, `hold_expires_at`, Stripe customer/checkout ids. |
| `booking_travelers`   | Booking ↔ traveler_profiles.                                                                                                                                                |
| `booking_preferences` | Room, dietary, accessibility, transfer, optional experiences.                                                                                                               |
| `payments`, `refunds` | Mirror Stripe objects by id; state updated **only** from webhooks.                                                                                                          |
| `coupons`             | Phase 2 schema, present early so pricing code has a home.                                                                                                                   |

**Inventory** is computed in SQL: `available = capacity - confirmed - held`. Booking creation is
a single transaction (`create_booking()` function) that checks availability, inserts the booking
and travelers, and places a hold. Expired holds are released by a scheduled job.

### Trip experience (snapshot — edited by trip staff)

| Table                                      | Notes                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| `trips`                                    | One per departure group. `status: upcoming/active/completed/cancelled`. |
| `trip_days`, `trip_itinerary_items`        | Copied from the tour version when the departure is activated.           |
| `trip_documents`                           | Storage metadata; signed URLs only.                                     |
| `trip_notes`                               | **Staff-only.**                                                         |
| `live_moments`, `live_moment_participants` | Phase 2 feature, MVP schema.                                            |
| `checkins`                                 | Optional presence pings for live moments.                               |

### Social, support, notifications, content, system

`chat_rooms` (type: trip_group / announcements / optional_activities), `chat_members`, `messages`,
`message_reactions`, `user_blocks`, `reports` · `support_threads`, `support_messages`,
`support_attachments`, `support_assignments` · `notifications`, `notification_preferences`,
`push_tokens`, `email_events` · `cms_pages`, `cms_blocks`, `destination_guides`,
`recommendations`, `recommendation_categories` · `audit_logs`, `feature_flags`,
`system_settings`, `webhook_events`.

## Key invariants (enforce in Postgres)

- `bookings.confirmation_number` unique · `webhook_events (provider, event_id)` unique.
- `trip_members (trip_id, user_id)` unique.
- `departures.capacity >= 0`; sum of confirmed + held never exceeds capacity (checked inside `create_booking()` under `SELECT … FOR UPDATE`).
- Cancellation tiers: distinct `days_before_departure`, `refund_percentage` 0–100.
- Enum-typed status columns; no free-text statuses.

## Migration order

```
20260906000000_extensions          ✔ (present)
..._profiles        ..._roles          ..._destinations    ..._tours
..._tour_versions   ..._tour_itinerary ..._suppliers       ..._departures
..._groups          ..._travelers      ..._bookings        ..._payments
..._trips           ..._trip_itinerary ..._chat            ..._notifications
..._support         ..._live_moments   ..._documents       ..._audit_logs
```

Each migration that creates a table also enables RLS and adds its policies in the same file, so
no table ever exists without policies.

## Retention (decide before launch)

Financial records: retain per legal requirement, anonymize personal fields on account deletion.
Support threads, chat media, documents, audit logs: define TTLs per master spec §110–111.
