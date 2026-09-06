-- 002_profiles
-- Public-facing profile for every auth user. Deliberately contains NO email/phone/DOB —
-- private traveler data lives in traveler_profiles (011). Peers on a trip may read these rows.

create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  display_name        text not null default '' check (char_length(display_name) <= 80),
  avatar_url          text,
  bio                 text check (char_length(bio) <= 500),
  home_country        char(2),
  preferred_language  text not null default 'en',
  -- Traveler-controlled visibility of optional fields to other group members.
  show_home_country   boolean not null default true,
  show_bio            boolean not null default true,
  marketing_opt_in    boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

create policy "users read their own profile" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "staff read all profiles" on public.profiles
  for select to authenticated
  using ((select public.is_staff()));

create policy "users update their own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- "trip co-members read each other's profiles" is added in 014_trips once trip_members exists.
-- Inserts happen only through handle_new_user (security definer). No delete: cascades from auth.users.
