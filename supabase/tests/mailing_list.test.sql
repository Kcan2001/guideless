-- pgTAP tests for migration 0071: the mailing list, consent, and a way off it.
--
-- Two rules are worth more than the rest. Somebody who gave us an address to do one thing must not
-- end up in a marketing blast — so `can_market` is asserted per segment rather than trusted to the
-- UI. And everybody on a marketing list must be able to leave without an account, which before
-- this migration was impossible for two of the three lists.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;
create or replace function tests.authenticate_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create or replace function tests.be_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);
end $$;
create or replace function tests.clear_auth() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('role', 'postgres', true);
end $$;
create or replace function tests.create_user(uid uuid, email text) returns void language plpgsql as $$
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email, 'x', now(),
          '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now(), '', '', '', '');
end $$;

select tests.create_user('a2000000-0000-4000-8000-0000000000a1', 'liststaff@example.com');
select tests.create_user('a2000000-0000-4000-8000-0000000000a2', 'stranger@example.com');
insert into public.user_roles (user_id, role) values ('a2000000-0000-4000-8000-0000000000a1', 'admin');

select has_view('public', 'mailing_list', 'there is one view of everyone we hold');
select has_table('public', 'email_campaigns', 'and somewhere to write to them from');
select has_table('public', 'email_campaign_sends', 'and a record of who already got it');

-- ── Everyone on a marketing list can leave without an account ────────────────
select has_column('public', 'destination_alerts', 'unsubscribe_token',
  'an alert can be stopped from an email link, not just from an account page');
select has_column('public', 'departure_waitlist', 'unsubscribe_token',
  'and so can a waiting list place');

select tests.clear_auth();
-- The token is set explicitly because the next step reads it as anon, and anon cannot read this
-- table at all — which is the point, and is exactly why the link carries the token in it.
insert into public.destination_alerts (id, email, wanted_place, unsubscribe_token)
values ('a2000000-0000-4000-8000-0000000000d1', 'lisbon@example.com', 'Lisbon',
        'a2000000-0000-4000-8000-0000000000e1');

-- Anonymous, because that is who is holding the link.
select tests.be_anon();
select is(
  (select public.stop_destination_alert('a2000000-0000-4000-8000-0000000000e1'::uuid)),
  'stopped',
  'somebody with no account can unsubscribe with the token from their email');
select is((select count(*)::int from public.destination_alerts), 0,
  'even though they cannot read the row the token points at');

select tests.clear_auth();
select isnt(
  (select unsubscribed_at from public.destination_alerts
   where id = 'a2000000-0000-4000-8000-0000000000d1'),
  null, 'and it took effect');

-- An unknown token says exactly what a real one says, so the link cannot probe the list.
select tests.be_anon();
select is((select public.stop_destination_alert(gen_random_uuid())), 'stopped',
  'an unknown token gets the same answer, so a link cannot be used to check who is on the list');

-- ── Consent is per segment ───────────────────────────────────────────────────
select tests.clear_auth();
insert into public.newsletter_subscribers (email) values ('subscriber@example.com');
insert into public.host_applications (name, email, community_description)
values ('Marta', 'host@example.com', 'Runs a climbing gym with about forty regulars.');

select tests.authenticate_as('a2000000-0000-4000-8000-0000000000a1');

select is(
  (select can_market from public.mailing_list where segment = 'newsletter' limit 1),
  true, 'a newsletter subscriber asked to hear from us');

select is(
  (select can_market from public.mailing_list where segment = 'host_applicant' limit 1),
  false,
  'somebody who applied to host did not — they gave us an address to apply, and that is not a list');

select is(
  (select purpose from public.mailing_list where segment = 'host_applicant' limit 1),
  'their application',
  'and the view says what they did agree to');

-- Unsubscribing takes them out of the list entirely, not just out of the count.
select is(
  (select count(*)::int from public.mailing_list
   where segment = 'destination_alert' and email = 'lisbon@example.com'),
  0, 'somebody who unsubscribed is not in the mailing list at all');

-- ── The list is staff-only ───────────────────────────────────────────────────
select tests.authenticate_as('a2000000-0000-4000-8000-0000000000a2');
select is((select count(*)::int from public.mailing_list_for_staff()), 0,
  'a signed-in stranger reads nobody''s address');
select throws_ok(
  $$ insert into public.email_campaigns (subject, body, segment)
     values ('Hello everyone', 'A message they did not ask for.', 'newsletter') $$,
  '42501', null, 'and cannot write a campaign');

-- ── A campaign cannot email the same person twice ────────────────────────────
select tests.clear_auth();
insert into public.email_campaigns (id, subject, body, segment)
values ('a2000000-0000-4000-8000-0000000000c1', 'Spring dates are up',
        'Three new departures. Nothing to do unless you want to.', 'newsletter');
insert into public.email_campaign_sends (campaign_id, email)
values ('a2000000-0000-4000-8000-0000000000c1', 'subscriber@example.com');
select throws_ok(
  $$ insert into public.email_campaign_sends (campaign_id, email)
     values ('a2000000-0000-4000-8000-0000000000c1', 'subscriber@example.com') $$,
  '23505', null,
  'a re-run after a half-finished send cannot email somebody a second time');

select * from finish();
rollback;
