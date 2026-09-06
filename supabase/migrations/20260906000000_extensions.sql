-- 001_extensions
-- Postgres extensions the platform relies on. Keep this list short and justified.

create extension if not exists "pgcrypto" with schema extensions;   -- gen_random_uuid(), digest() for payload hashes
create extension if not exists "citext" with schema extensions;     -- case-insensitive emails / coupon codes
create extension if not exists "pg_trgm" with schema extensions;    -- fuzzy search on tours / destinations / customers
create extension if not exists "moddatetime" with schema extensions; -- updated_at triggers

-- Shared helper: set updated_at on row change. Used by every mutable table.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger function: stamps updated_at = now() before update. Attach to every mutable table.';
