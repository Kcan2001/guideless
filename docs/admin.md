# Admin / operations platform

Lives inside the Next.js app under `/admin` (master spec §2C, §31–35, §55). No separate frontend.

## Access

- `/admin/*` requires a signed-in user with at least one row in `user_roles`
  (`apps/web/lib/auth/staff.ts` → `requireStaff()`); otherwise `/login` or `/no-access`.
- Actions narrow by role group, mirroring the SQL helpers:

  | Group   | Roles                                   | May                                                                             |
  | ------- | --------------------------------------- | ------------------------------------------------------------------------------- |
  | content | content_editor, admin, super_admin      | Tours, versions, template itinerary, lists, FAQs                                |
  | ops     | trip_staff, finance, admin, super_admin | Departures, groups, trip activation, live itinerary, suppliers, cancel bookings |
  | finance | finance, admin, super_admin             | Override refund %, record off-platform payments                                 |
  | any     | all staff                               | Read everything, add staff notes                                                |

- **RLS is the real boundary.** Every admin query and mutation runs as the signed-in staff user
  through `createClient()`. The only service-role call is trip activation (`create_trip_for_group`
  is `service_role`-only), and it happens after an explicit ops-role check.

Grant a role locally:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@example.com';
```

## Screens

| Route                                        | What it does                                                                                                                                                                                                                                          |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin`                                     | Operations dashboard: upcoming departures with capacity, **issues feed** (below minimum, holds, pending supplier confirmations, overdue balances, travelers missing DOB/nationality, open support), recent bookings                                   |
| `/admin/tours`, `/admin/tours/new`           | Tour list; create tour (+ empty draft v1)                                                                                                                                                                                                             |
| `/admin/tours/[id]`                          | Settings, publish toggle, versions (publish / new draft), departures                                                                                                                                                                                  |
| `/admin/tours/[id]/versions/[vid]`           | Version content, route stops, included / you-book / FAQ, **template itinerary editor** (read-only once published)                                                                                                                                     |
| `/admin/departures`, `/admin/departures/new` | Filterable list; create (pins the tour's current published version)                                                                                                                                                                                   |
| `/admin/departures/[id]`                     | Stats, issues, travelers with group assignment, bookings, groups → **Activate trip**, supplier services (+ new supplier), settings, staff notes                                                                                                       |
| `/admin/departures/[id]/trips/[tripId]`      | **Live itinerary editor** (snapshot; edits are what travelers see), trip status, members, **Live Moments** (create official moments as announced or draft; announce / start / finish / cancel; traveler-suggested ones with head-counts), staff notes |
| `/admin/bookings`, `/admin/bookings/[id]`    | List with filters; detail with travelers + emergency contacts, money, payments/refunds, **cancel** (policy % via `refund_percentage_for`, finance override, Stripe refund when configured), manual payment, notes                                     |
| `/admin/customers`                           | Traveler records with completeness flags and booking statuses                                                                                                                                                                                         |
| `/admin/social`, `/admin/social/[id]`        | Instagram queue (content roles): drafts imported from `guideless_photos/`, caption / hashtags / alt text, schedule in a chosen time zone, publish now, cancel, delete; failures show the publisher's error. See docs/marketing.md                     |

## Conventions

- Mutations are Server Actions in `apps/web/lib/admin/actions/*`. Each: `requireStaff(roles)` →
  `parseForm(zodSchema, formData)` → Supabase (RLS) → `revalidatePath` → `flash(path, ok|error, msg)`
  (redirect with a one-line message rendered by `<Flash />`). Forms are plain `<form action>` and
  work without JavaScript; `<SubmitButton confirm="…">` adds pending state and a confirm prompt.
- Schemas live in `packages/validation/src/admin.ts`; money is typed in major units and converted
  to minor units there.
- Versioning (ADR-008): published/archived versions are read-only; "New draft version" copies the
  latest version's content, route, lists and itinerary. Publishing archives the previous published
  version and updates `tours.current_version_id`; departures keep their pinned version.
- Snapshot (ADR-009): "Activate trip" per group; then edit `trip_*` rows, never the template.
- Audit: booking cancel/payment, itinerary edits, supplier changes, membership changes are logged
  by database triggers; cancellations also write a `booking_notes` row with the computed refund.

## Not yet

Bulk communications, support inbox, content/CMS editing, analytics and audit-log screens, role
administration UI (use SQL for now), image uploads to Storage.
