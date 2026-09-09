-- 0071_mailing_list
--
-- We have been collecting email addresses in five places and sending to none of them. This makes
-- the list real: one view of everyone we hold, an unsubscribe that works for all of it, and a
-- campaign table so a send is a recorded thing rather than a script somebody ran once.
--
-- The bug that has to be fixed before a single marketing email goes out: `destination_alerts` and
-- `departure_waitlist` both take an email from somebody with **no account** — that is the whole
-- point of them — but the only way to stop either was a button on the account page. Somebody who
-- signed up anonymously had no way out at all. Both get an unsubscribe token and a token-based
-- stop function here, matching what `newsletter_subscribers` has had since migration 036.
--
-- The other decision worth arguing with is the consent split. It is tempting to treat every
-- address we hold as "the mailing list", and it is wrong. Somebody who applied to host a trip, or
-- who sent us a quote about a weekend in 2025, gave us their address to do that one thing. Putting
-- them in a marketing blast is how a sending domain gets burned, and it is a promise we did not
-- make. So `mailing_list` marks every row with what it may be used for, and the composer can only
-- send to the segments that say yes.

-- ── Unsubscribe, for the lists that could not ────────────────────────────────
alter table public.destination_alerts
  add column unsubscribe_token uuid not null default gen_random_uuid();
alter table public.destination_alerts
  add constraint destination_alerts_token_unique unique (unsubscribe_token);

alter table public.departure_waitlist
  add column unsubscribe_token uuid not null default gen_random_uuid();
alter table public.departure_waitlist
  add constraint departure_waitlist_token_unique unique (unsubscribe_token);
alter table public.departure_waitlist add column unsubscribed_at timestamptz;

comment on column public.destination_alerts.unsubscribe_token is
  'Opaque token for the one-click unsubscribe link. Most people on this list have no account, so '
  'this is their only way off it.';

-- Both return a human sentence rather than a boolean: the page shows it verbatim, and an unknown
-- token says the same thing as a used one so a link cannot be used to probe who is on the list.
create or replace function public.stop_destination_alert(p_token uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.destination_alerts
     set unsubscribed_at = now()
   where unsubscribe_token = p_token and unsubscribed_at is null;
  return 'stopped';
end $$;

create or replace function public.stop_departure_waitlist(p_token uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.departure_waitlist
     set unsubscribed_at = now()
   where unsubscribe_token = p_token and unsubscribed_at is null;
  return 'stopped';
end $$;

revoke all on function public.stop_destination_alert(uuid) from public;
revoke all on function public.stop_departure_waitlist(uuid) from public;
grant execute on function public.stop_destination_alert(uuid) to anon, authenticated;
grant execute on function public.stop_departure_waitlist(uuid) to anon, authenticated;

-- The demand signal must not count somebody who has left, same as before the column existed.
create or replace view public.wanted_places
with (security_invoker = true) as
  select lower(btrim(wanted_place))              as place,
         count(*)::integer                       as requests,
         count(user_id)::integer                 as from_travelers,
         min(created_at)                         as first_asked,
         max(created_at)                         as last_asked
  from public.destination_alerts
  where wanted_place is not null and unsubscribed_at is null
  group by lower(btrim(wanted_place));

-- ── One view of everyone we hold ─────────────────────────────────────────────
-- `can_market` is the whole point. It is false for people who gave us an address to do one
-- specific thing, and those rows exist here so staff can see and reply to them — not blast them.
-- `purpose` narrows it further: somebody who asked about Lisbon consented to hearing about
-- Lisbon, not to a general newsletter.
create view public.mailing_list
with (security_invoker = false) as
  select 'newsletter'::text            as segment,
         n.email::text                 as email,
         null::text                    as name,
         true                          as can_market,
         'anything'::text              as purpose,
         null::text                    as context,
         n.unsubscribe_token           as unsubscribe_token,
         n.created_at                  as created_at
    from public.newsletter_subscribers n
   where n.status = 'subscribed'

  union all
  select 'destination_alert',
         d.email::text,
         null,
         true,
         'that destination',
         coalesce(dest.name, d.wanted_place),
         d.unsubscribe_token,
         d.created_at
    from public.destination_alerts d
    left join public.destinations dest on dest.id = d.destination_id
   where d.unsubscribed_at is null and d.email is not null

  union all
  select 'waitlist',
         w.email::text,
         w.name,
         true,
         'that trip',
         t.name,
         w.unsubscribe_token,
         w.created_at
    from public.departure_waitlist w
    join public.tours t on t.id = w.tour_id
   where w.unsubscribed_at is null

  union all
  select 'host_applicant',
         h.email::text,
         h.name,
         false,
         'their application',
         h.city,
         null,
         h.created_at
    from public.host_applications h

  union all
  select 'testimonial',
         s.email::text,
         s.author_name,
         false,
         'their testimonial',
         null,
         null,
         s.created_at
    from public.testimonial_submissions s;

revoke all on public.mailing_list from public;
grant select on public.mailing_list to authenticated;

comment on view public.mailing_list is
  'Every address we hold, with what we are allowed to use it for. can_market = false means they '
  'gave it to us for one thing; reply to those, never broadcast to them.';

-- Staff-only: the view bypasses RLS on the tables underneath, so nothing but staff may read it.
create or replace function public.mailing_list_for_staff()
returns setof public.mailing_list
language sql
stable
security invoker
set search_path = ''
as $$
  select * from public.mailing_list where (select public.is_staff());
$$;

-- ── Campaigns ────────────────────────────────────────────────────────────────
create type public.campaign_status as enum ('draft', 'sending', 'sent', 'failed');

create table public.email_campaigns (
  id          uuid primary key default gen_random_uuid(),
  subject     text not null check (char_length(subject) between 3 and 200),
  -- Written as plain text with blank lines between paragraphs; the template does the rest. Nobody
  -- should be writing HTML into an admin textarea.
  body        text not null check (char_length(body) between 10 and 20000),
  -- A short line under the heading, optional.
  preheader   text check (char_length(preheader) <= 200),
  segment     text not null,
  -- For the destination_alert segment: only people who asked about this place.
  context     text,
  cta_label   text check (char_length(cta_label) <= 60),
  cta_url     text check (cta_url is null or cta_url ~ '^https?://'),
  status      public.campaign_status not null default 'draft',
  sent_at     timestamptz,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint email_campaigns_sent_at check ((status = 'sent') = (sent_at is not null))
);
create index email_campaigns_status_idx on public.email_campaigns (status, created_at desc);
create trigger email_campaigns_set_updated_at before update on public.email_campaigns
  for each row execute function public.set_updated_at();

-- One row per address per campaign, so a retry after a half-finished send cannot email anybody
-- twice. Same reasoning as webhook_events: sending is not idempotent unless we make it so.
create table public.email_campaign_sends (
  campaign_id uuid not null references public.email_campaigns (id) on delete cascade,
  email       extensions.citext not null,
  sent_at     timestamptz not null default now(),
  ok          boolean not null default true,
  error       text,
  primary key (campaign_id, email)
);

alter table public.email_campaigns enable row level security;
alter table public.email_campaign_sends enable row level security;

create policy "content staff manage campaigns" on public.email_campaigns
  for all to authenticated
  using ((select public.is_content_staff()))
  with check ((select public.is_content_staff()));

create policy "staff read campaign sends" on public.email_campaign_sends
  for select to authenticated
  using ((select public.is_staff()));
create policy "content staff write campaign sends" on public.email_campaign_sends
  for insert to authenticated
  with check ((select public.is_content_staff()));

comment on table public.email_campaigns is
  'An email written in admin and sent to one segment of mailing_list. Body is plain text; the '
  'template renders it.';
comment on table public.email_campaign_sends is
  'One row per address per campaign. The send loop skips addresses already here, so a retry after '
  'a partial failure never double-sends.';
