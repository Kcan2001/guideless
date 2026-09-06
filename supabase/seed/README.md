# Seed data

SQL files in this folder run after migrations on `supabase db reset` (see `[db.seed]` in
`../config.toml`). They are for **local development and staging only** and must never contain
production customer data. Files run in lexical order; keep the numeric prefixes.

| File                           | Contents                                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| `010_destinations.sql`         | Nice, Avignon, Paris — time zones, coordinates, emergency numbers                                  |
| `020_tour_southern_france.sql` | "Southern France" tour, published v1, 9 days / 29 itinerary items, included & excluded items, FAQs |
| `030_departures.sql`           | Three open 2027 departures (USD, deposit $750)                                                     |

Fixed UUID prefixes make rows easy to reference from tests and fixtures:
`1…` destinations · `2…` tours · `21…` versions · `22…` days · `3…` departures.

Dev auth users are not seeded here (inserting into `auth.users` is brittle across CLI versions).
Create them in Supabase Studio (http://127.0.0.1:54323) or through the Auth API, then grant roles:

```sql
insert into public.user_roles (user_id, role) values ('<uuid>', 'admin');
```

The pgTAP suite in `../tests/` creates its own users inside a rolled-back transaction.
