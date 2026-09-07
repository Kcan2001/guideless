-- 036_newsletter
-- Marketing newsletter subscribers (docs/marketing.md §7). Single source of truth for the list;
-- Resend Broadcasts receives a synced copy (audience contact id stored here).
--
-- Public visitors never read this table. They subscribe / unsubscribe through two security-definer
-- RPCs so the Server Action needs no service role. Content staff can read and manage rows.

create table public.newsletter_subscribers (
  id                 uuid primary key default gen_random_uuid(),
  email              extensions.citext not null unique,
  status             text not null default 'subscribed'
                     check (status in ('subscribed', 'unsubscribed')),
  source             text not null default 'website'
                     check (source ~ '^[a-z0-9_-]{1,40}$'),       -- footer | checkout | admin | import …
  user_id            uuid references auth.users (id) on delete set null,
  consent_at         timestamptz not null default now(),
  unsubscribed_at    timestamptz,
  -- Opaque token in the unsubscribe link; rotating it invalidates old links.
  unsubscribe_token  uuid not null unique default gen_random_uuid(),
  resend_contact_id  text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index newsletter_subscribers_status_idx on public.newsletter_subscribers (status, created_at desc);
create trigger newsletter_subscribers_set_updated_at before update on public.newsletter_subscribers
  for each row execute function public.set_updated_at();
comment on table public.newsletter_subscribers is
  'Marketing newsletter list. Public access only through subscribe_newsletter() / unsubscribe_newsletter().';

alter table public.newsletter_subscribers enable row level security;

create policy "content staff manage newsletter subscribers" on public.newsletter_subscribers
  for all to authenticated
  using ((select public.is_content_staff()))
  with check ((select public.is_content_staff()));

-- Service role (Resend sync, exports) bypasses RLS; anon/authenticated only via the RPCs below.

-- ── Subscribe ─────────────────────────────────────────────────────────────────
-- Idempotent: re-subscribing an unsubscribed address re-activates it with a fresh token.
-- Returns 'subscribed' | 'already_subscribed' | 'resubscribed'. Never reveals other rows.
create or replace function public.subscribe_newsletter(p_email text, p_source text default 'website')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email  extensions.citext := lower(btrim(p_email))::extensions.citext;
  v_source text := coalesce(nullif(btrim(p_source), ''), 'website');
  v_status text;
begin
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  if v_source !~ '^[a-z0-9_-]{1,40}$' then
    v_source := 'website';
  end if;

  select status into v_status from public.newsletter_subscribers where email = v_email;

  if v_status is null then
    insert into public.newsletter_subscribers (email, source, user_id)
    values (v_email, v_source, auth.uid());
    return 'subscribed';
  elsif v_status = 'unsubscribed' then
    update public.newsletter_subscribers
       set status = 'subscribed', consent_at = now(), unsubscribed_at = null,
           unsubscribe_token = gen_random_uuid(), source = v_source,
           user_id = coalesce(user_id, auth.uid())
     where email = v_email;
    return 'resubscribed';
  else
    return 'already_subscribed';
  end if;
end;
$$;
revoke execute on function public.subscribe_newsletter(text, text) from public;
grant execute on function public.subscribe_newsletter(text, text) to anon, authenticated, service_role;

-- ── Unsubscribe (one-click link) ─────────────────────────────────────────────
create or replace function public.unsubscribe_newsletter(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.newsletter_subscribers
     set status = 'unsubscribed', unsubscribed_at = now()
   where unsubscribe_token = p_token and status = 'subscribed';
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;
revoke execute on function public.unsubscribe_newsletter(uuid) from public;
grant execute on function public.unsubscribe_newsletter(uuid) to anon, authenticated, service_role;
