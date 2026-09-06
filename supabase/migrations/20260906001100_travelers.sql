-- 011_travelers
-- Travelers are NOT auth users. One account may manage several travelers (spouse, friend).
-- This is where private PII lives; only the managing account, the traveler's own linked account,
-- and staff can read it. Passport numbers are NOT stored here (collected later, per destination).

create table public.traveler_profiles (
  id                    uuid primary key default gen_random_uuid(),
  owner_user_id         uuid not null references auth.users (id) on delete cascade,  -- the booker
  user_id               uuid references auth.users (id) on delete set null,          -- linked account, if any
  first_name            text not null check (char_length(first_name) between 1 and 80),
  last_name             text not null check (char_length(last_name) between 1 and 80),
  preferred_name        text check (char_length(preferred_name) <= 80),
  email                 extensions.citext,
  phone                 text,
  date_of_birth         date check (date_of_birth < current_date),
  nationality           char(2),
  dietary_requirements  text check (char_length(dietary_requirements) <= 500),
  room_preference       public.room_preference not null default 'no_preference',
  accessibility_notes   text check (char_length(accessibility_notes) <= 500),
  travel_preferences    jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index traveler_profiles_owner_idx on public.traveler_profiles (owner_user_id);
create index traveler_profiles_user_idx on public.traveler_profiles (user_id);
create index traveler_profiles_email_idx on public.traveler_profiles (email);

create trigger traveler_profiles_set_updated_at before update on public.traveler_profiles
  for each row execute function public.set_updated_at();

create table public.emergency_contacts (
  id            uuid primary key default gen_random_uuid(),
  traveler_id   uuid not null references public.traveler_profiles (id) on delete cascade,
  name          text not null,
  relationship  text not null,
  phone         text not null,
  email         extensions.citext,
  is_primary    boolean not null default true
);
create index emergency_contacts_traveler_idx on public.emergency_contacts (traveler_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.traveler_profiles enable row level security;
alter table public.emergency_contacts enable row level security;

create policy "owners and linked users read travelers" on public.traveler_profiles
  for select to authenticated
  using (
    owner_user_id = (select auth.uid())
    or user_id = (select auth.uid())
    or (select public.is_staff())
  );

create policy "owners create travelers" on public.traveler_profiles
  for insert to authenticated
  with check (owner_user_id = (select auth.uid()) or (select public.is_ops_staff()));

create policy "owners and linked users update travelers" on public.traveler_profiles
  for update to authenticated
  using (owner_user_id = (select auth.uid()) or user_id = (select auth.uid()) or (select public.is_ops_staff()))
  with check (owner_user_id = (select auth.uid()) or user_id = (select auth.uid()) or (select public.is_ops_staff()));

create policy "owners delete unbooked travelers" on public.traveler_profiles
  for delete to authenticated
  using (owner_user_id = (select auth.uid()) or (select public.is_ops_staff()));
-- (booking_travelers FK is `on delete restrict`, so a traveler on a booking cannot be deleted.)

create policy "emergency contacts follow traveler" on public.emergency_contacts
  for all to authenticated
  using (exists (
    select 1 from public.traveler_profiles t
    where t.id = emergency_contacts.traveler_id
      and (t.owner_user_id = (select auth.uid()) or t.user_id = (select auth.uid()) or (select public.is_staff()))
  ))
  with check (exists (
    select 1 from public.traveler_profiles t
    where t.id = emergency_contacts.traveler_id
      and (t.owner_user_id = (select auth.uid()) or t.user_id = (select auth.uid()) or (select public.is_ops_staff()))
  ));
