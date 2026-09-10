-- pgTAP tests for migration 050 (growth): the referral ladder settles and reverses, the waitlist
-- takes anyone but shows itself only to staff and its owner, a trip drop refuses to be booked,
-- and unlock progress counts only confirmed travelers. Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;
create or replace function tests.authenticate_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create or replace function tests.authenticate_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
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

select tests.create_user('f9000000-0000-4000-8000-0000000000a1', 'ops.growth@example.com');
select tests.create_user('f9000000-0000-4000-8000-0000000000b2', 'referrer.growth@example.com');
select tests.create_user('f9000000-0000-4000-8000-0000000000c3', 'friend.growth@example.com');
select tests.create_user('f9000000-0000-4000-8000-0000000000d4', 'stranger.growth@example.com');
insert into public.user_roles (user_id, role) values ('f9000000-0000-4000-8000-0000000000a1', 'trip_staff');

-- ── Schema ───────────────────────────────────────────────────────────────────
select has_table('public', 'departure_waitlist', 'departure_waitlist exists');
select has_table('public', 'departure_unlocks', 'departure_unlocks exists');
select has_column('public', 'departures', 'opens_at', 'departures.opens_at exists');
select has_function('public', 'sync_referral_tier', array['uuid', 'currency_code'], 'sync_referral_tier exists');
select has_function('public', 'join_waitlist', 'join_waitlist exists');
select has_function('public', 'departure_unlock_progress', array['uuid'], 'departure_unlock_progress exists');

-- ── Referral ladder ──────────────────────────────────────────────────────────
-- Four earned referrals against four distinct bookings, added one at a time so each threshold
-- is crossed in turn. The bookings are created here rather than borrowed from whatever happens to
-- exist: the catalog seed carries no bookings, so borrowing passed only on a database with leftover
-- test data and failed on a clean one. Only the referral rows matter to these assertions.
insert into public.bookings (id, confirmation_number, customer_id, departure_id, tour_version_id,
                             status, payment_status, currency, subtotal_amount, total_amount,
                             deposit_amount, amount_paid)
select ('f9100000-0000-4000-8000-00000000000' || g)::uuid,
       'GL-GROW0' || g,
       'f9000000-0000-4000-8000-0000000000c3',
       d.id, d.tour_version_id, 'confirmed', 'paid', 'USD', 189000, 189000, 50000, 189000
from generate_series(1, 4) as g,
     lateral (select id, tour_version_id from public.departures order by start_date limit 1) as d;

create temporary table growth_bookings on commit drop as
select id, row_number() over (order by confirmation_number) as n
from public.bookings where confirmation_number like 'GL-GROW0%';

create or replace function tests.earn_referral(p_n integer) returns void language plpgsql as $$
declare v_booking uuid;
begin
  select id into v_booking from growth_bookings where n = p_n;
  insert into public.referrals (code, referrer_id, referred_user_id, booking_id, status, reward_amount, currency)
  values ('GL-TIER01', 'f9000000-0000-4000-8000-0000000000b2', 'f9000000-0000-4000-8000-0000000000c3',
          v_booking, 'earned', 7500, 'USD')
  on conflict (booking_id) do update
    set status = 'earned', referrer_id = 'f9000000-0000-4000-8000-0000000000b2', code = 'GL-TIER01',
        reward_amount = 7500, currency = 'USD';
end $$;

-- Flat since migration 20260910000800: $100 a friend, however many. The escalating ladder was
-- retired because the fourth referral is not worth five times the first, and "an experience on us"
-- at the top of it was an uncosted promise.
select tests.earn_referral(1);
select is(public.sync_referral_tier('f9000000-0000-4000-8000-0000000000b2', 'USD'), 10000::bigint,
  'the first friend earns the flat reward');
select tests.earn_referral(2);
select is(public.sync_referral_tier('f9000000-0000-4000-8000-0000000000b2', 'USD'), 10000::bigint,
  'the second friend earns the same as the first, not an escalating tier');
select tests.earn_referral(3);
select tests.earn_referral(4);
select is(public.sync_referral_tier('f9000000-0000-4000-8000-0000000000b2', 'USD'), 20000::bigint,
  'two more friends settle two more flat rewards');
select is((select coalesce(sum(amount), 0)::bigint from public.account_credits
           where user_id = 'f9000000-0000-4000-8000-0000000000b2' and source = 'referral_tier'), 40000::bigint,
  'four friends total four flat rewards and nothing more');
select is(public.sync_referral_tier('f9000000-0000-4000-8000-0000000000b2', 'USD'), 0::bigint,
  'syncing again pays nothing: a referral is never rewarded twice');

update public.referrals set status = 'void'
where referrer_id = 'f9000000-0000-4000-8000-0000000000b2' and code = 'GL-TIER01'
  and booking_id in (select id from growth_bookings where n > 1);
select is(public.sync_referral_tier('f9000000-0000-4000-8000-0000000000b2', 'USD'), -30000::bigint,
  'voided referrals claw their flat rewards back');
select is((select coalesce(sum(amount), 0)::bigint from public.account_credits
           where user_id = 'f9000000-0000-4000-8000-0000000000b2' and source = 'referral_tier'), 10000::bigint,
  'one earned referral leaves exactly one flat reward standing');

select tests.authenticate_as('f9000000-0000-4000-8000-0000000000b2');
select is((public.referral_progress('USD') ->> 'earned')::int, 1,
  'referral_progress reports the traveler own earned count');
-- No ladder to report any more. The account card shows the flat reward and the earned count.
select is(jsonb_array_length(public.referral_progress('USD') -> 'tiers'), 0,
  'referral_progress reports no ladder, because there is not one');
select is((public.referral_progress('USD') ->> 'baseReward')::bigint, 10000::bigint,
  'referral_progress reports the flat reward a friend is worth');
select tests.clear_auth();

-- ── Waitlist ─────────────────────────────────────────────────────────────────
select tests.authenticate_anon();
select is(public.join_waitlist('20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000004',
  'Waiting@Example.com ', 'Wanda', 2), 'joined', 'anyone may join a departure waitlist');
select is(public.join_waitlist('20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000004',
  'waiting@example.com', 'Wanda Two', 3), 'already_waiting',
  'joining twice updates the row rather than failing');
select is(public.join_waitlist('20000000-0000-4000-8000-000000000002', null, 'not-an-email', 'X', 1),
  'invalid_email', 'a malformed address is refused');
select is(public.join_waitlist('20000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-00000000dead', 'ghost@example.com', 'G', 1),
  'not_found', 'an unknown departure is refused');
select is((select count(*)::int from public.departure_waitlist), 0,
  'anon cannot read the waitlist it just joined');
select tests.clear_auth();

select tests.authenticate_as('f9000000-0000-4000-8000-0000000000d4');
select is((select count(*)::int from public.departure_waitlist), 0,
  'a signed-in stranger cannot read the waitlist either');
select tests.clear_auth();

select tests.authenticate_as('f9000000-0000-4000-8000-0000000000a1');
select is((select count(*)::int from public.departure_waitlist where email = 'waiting@example.com'), 1,
  'staff can read the waitlist');
select is((select party_size from public.departure_waitlist where email = 'waiting@example.com'), 3::smallint,
  'the second join updated the party size rather than inserting a duplicate');
select tests.clear_auth();

-- ── Trip drops ───────────────────────────────────────────────────────────────
update public.departures set opens_at = now() + interval '7 days'
where id = '30000000-0000-4000-8000-000000000004';
select is(public.quote_booking('30000000-0000-4000-8000-000000000004', array[1]) -> 'problems' -> 0 ->> 'code',
  'departure_not_open', 'a departure whose drop has not happened refuses to quote');
select isnt(public.quote_booking('30000000-0000-4000-8000-000000000004', array[1]) -> 'problems' -> 0 ->> 'opensAt',
  null, 'the refusal carries the moment it opens, so the page can count down');

update public.departures set opens_at = now() - interval '1 day'
where id = '30000000-0000-4000-8000-000000000004';
select is(jsonb_array_length(public.quote_booking('30000000-0000-4000-8000-000000000004', array[1]) -> 'problems'), 0,
  'once the drop has passed the same departure quotes normally');
update public.departures set opens_at = null where id = '30000000-0000-4000-8000-000000000004';

select is((select count(*)::int from information_schema.columns
           where table_schema = 'public' and table_name = 'departures_public' and column_name = 'opens_at'), 1,
  'departures_public exposes opens_at for the countdown');

-- ── Group unlocks ────────────────────────────────────────────────────────────
insert into public.departure_unlocks (departure_id, threshold, reward) values
  ('30000000-0000-4000-8000-000000000004', 8, 'A harbour boat for everyone'),
  ('30000000-0000-4000-8000-000000000004', 200, 'Never reached in this test');
select is((public.departure_unlock_progress('30000000-0000-4000-8000-000000000004') -> 'unlocks' -> 1 ->> 'reached')::boolean,
  false, 'an unreached threshold reads as not reached');
select is(jsonb_array_length(public.departure_unlock_progress('30000000-0000-4000-8000-000000000004') -> 'unlocks'), 2,
  'both active unlocks are returned');
update public.departure_unlocks set is_active = false where threshold = 200;
select is(jsonb_array_length(public.departure_unlock_progress('30000000-0000-4000-8000-000000000004') -> 'unlocks'), 1,
  'an inactive unlock is hidden');

select tests.authenticate_as('f9000000-0000-4000-8000-0000000000d4');
select throws_ok(
  $$insert into public.departure_unlocks (departure_id, threshold, reward)
    values ('30000000-0000-4000-8000-000000000004', 12, 'Traveler tries to promise a reward')$$,
  '42501', null, 'a traveler cannot create an unlock');
select tests.clear_auth();

select * from finish();
rollback;
