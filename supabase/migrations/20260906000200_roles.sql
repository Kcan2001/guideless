-- 003_roles
-- Role catalogue, assignments, and the helper functions every RLS policy uses.

create table public.roles (
  role        public.app_role primary key,
  description text not null
);

insert into public.roles (role, description) values
  ('customer',       'Any authenticated traveler. Implicit; not stored in user_roles.'),
  ('trip_staff',     'Operates trips: itinerary, groups, travelers, suppliers, live moments.'),
  ('support',        'Handles support threads and moderation.'),
  ('content_editor', 'Edits tours, destinations, recommendations, CMS.'),
  ('finance',        'Views payments and supplier costs; issues refunds.'),
  ('admin',          'Full access except role administration of other admins.'),
  ('super_admin',    'Full access.');

create table public.user_roles (
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        public.app_role not null references public.roles (role),
  granted_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (user_id, role),
  constraint user_roles_no_customer check (role <> 'customer')
);

create index user_roles_role_idx on public.user_roles (role);

-- ── Helper functions ──────────────────────────────────────────────────────────
-- security definer + empty search_path so they can read user_roles regardless of caller policies.
-- Wrap calls in policies as `(select public.is_staff())` so Postgres caches the result per statement.

create or replace function public.has_any_role(required public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = any (required)
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(
    array['trip_staff', 'support', 'content_editor', 'finance', 'admin', 'super_admin']::public.app_role[]
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['admin', 'super_admin']::public.app_role[]);
$$;

revoke execute on function public.has_any_role(public.app_role[]) from public;
grant execute on function public.has_any_role(public.app_role[]) to authenticated, service_role;
revoke execute on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated, service_role;
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;

create policy "roles are readable by authenticated users" on public.roles
  for select to authenticated using (true);

create policy "users read their own roles" on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Only admins assign roles; super_admin required to touch admin/super_admin rows.
create policy "admins manage roles" on public.user_roles
  for all to authenticated
  using (
    (select public.is_admin())
    and (role not in ('admin', 'super_admin')
         or (select public.has_any_role(array['super_admin']::public.app_role[])))
  )
  with check (
    (select public.is_admin())
    and (role not in ('admin', 'super_admin')
         or (select public.has_any_role(array['super_admin']::public.app_role[])))
  );
