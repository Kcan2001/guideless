-- pgTAP tests for migrations 0059–0062: the trip assistant, personal plans, taste and the meter.
--
-- The rules worth proving here are mostly about who cannot see things. An assistant is only useful
-- if travelers ask it blunt questions, and they only do that if nobody at the company is reading —
-- so "staff read zero" is a feature with a test, not an oversight. The same goes for a traveler's
-- own plans: where somebody decided to have dinner is not operational data.
--
-- The other half is the meter. The daily cap has to hold under a race, and the cost has to be
-- recorded even when the model call fails, or the admin screen is a comforting lie.
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;
create or replace function tests.authenticate_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('role', 'authenticated', true);
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

select tests.create_user('a7000000-0000-4000-8000-0000000000a1', 'assistant.traveler@example.com');
select tests.create_user('a7000000-0000-4000-8000-0000000000a2', 'assistant.other@example.com');
select tests.create_user('a7000000-0000-4000-8000-0000000000a3', 'assistant.staff@example.com');
insert into public.user_roles (user_id, role) values ('a7000000-0000-4000-8000-0000000000a3', 'admin');

insert into public.profiles (id, display_name, interests)
values ('a7000000-0000-4000-8000-0000000000a1', 'Sam', array['food', 'nature'])
on conflict (id) do update set interests = excluded.interests;

insert into public.bookings (id, confirmation_number, departure_id, tour_version_id, customer_id,
                             status, payment_status, currency, subtotal_amount, total_amount, deposit_amount)
values ('a7000000-0000-4000-8000-0000000000b1', 'GL-ASSIST1', '30000000-0000-4000-8000-000000000001',
        '21000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-0000000000a1',
        'confirmed', 'paid', 'USD', 349500, 349500, 75000);

insert into public.trips (id, departure_id, departure_group_id, tour_version_id, name, start_date, end_date, timezone, status)
select 'a7000000-0000-4000-8000-0000000000c1', d.id, g.id, d.tour_version_id, 'Assistant trip',
       current_date, current_date + 6, 'Europe/Paris', 'active'
from public.departures d
join public.departure_groups g on g.departure_id = d.id
where d.id = '30000000-0000-4000-8000-000000000001'
limit 1;

insert into public.trip_members (trip_id, user_id, booking_id)
values ('a7000000-0000-4000-8000-0000000000c1', 'a7000000-0000-4000-8000-0000000000a1',
        'a7000000-0000-4000-8000-0000000000b1');

-- ── Structure ────────────────────────────────────────────────────────────────
select has_table('public', 'traveler_plans', 'a traveler has somewhere to put their own plans');
select has_table('public', 'ai_messages', 'the conversation is stored');
select has_table('public', 'ai_usage', 'and the meter is a separate table from the words');
select has_view('public', 'ai_cost_by_booking', 'staff have a cost view');

-- ── A traveler's own plans are their own ─────────────────────────────────────
select tests.authenticate_as('a7000000-0000-4000-8000-0000000000a1');
select lives_ok(
  $$ insert into public.traveler_plans (user_id, trip_id, booking_id, title, plan_date, timezone)
     values ('a7000000-0000-4000-8000-0000000000a1', 'a7000000-0000-4000-8000-0000000000c1',
             'a7000000-0000-4000-8000-0000000000b1', 'Dinner at Oliviera', current_date, 'Europe/Paris') $$,
  'a traveler adds a plan to their own trip');
select is((select count(*)::int from public.traveler_plans), 1, 'and can see it');

select throws_ok(
  $$ insert into public.traveler_plans (user_id, trip_id, booking_id, title, timezone)
     values ('a7000000-0000-4000-8000-0000000000a2', 'a7000000-0000-4000-8000-0000000000c1',
             'a7000000-0000-4000-8000-0000000000b1', 'Not mine', 'Europe/Paris') $$,
  '42501', null, 'and cannot add one on somebody else''s behalf');

select tests.authenticate_as('a7000000-0000-4000-8000-0000000000a2');
select is((select count(*)::int from public.traveler_plans), 0,
  'another traveler on the same trip sees none of them');

-- The one that is easy to get wrong, and the reason there is no staff policy on this table.
select tests.authenticate_as('a7000000-0000-4000-8000-0000000000a3');
select is((select count(*)::int from public.traveler_plans), 0,
  'and neither does staff — where somebody eats is not operational data');

-- ── The conversation is private; the bill is not ─────────────────────────────
select tests.clear_auth();
insert into public.ai_conversations (id, user_id, booking_id, trip_id)
values ('a7000000-0000-4000-8000-0000000000d1', 'a7000000-0000-4000-8000-0000000000a1',
        'a7000000-0000-4000-8000-0000000000b1', 'a7000000-0000-4000-8000-0000000000c1');
insert into public.ai_messages (conversation_id, user_id, role, content)
values ('a7000000-0000-4000-8000-0000000000d1', 'a7000000-0000-4000-8000-0000000000a1',
        'user', 'Somewhere quiet for dinner, not touristy');

select tests.authenticate_as('a7000000-0000-4000-8000-0000000000a1');
select is((select count(*)::int from public.ai_messages), 1, 'a traveler reads their own conversation');

select tests.authenticate_as('a7000000-0000-4000-8000-0000000000a3');
select is((select count(*)::int from public.ai_messages), 0,
  'staff read no conversations at all — that is what makes a blunt question safe to ask');

-- ── The meter ────────────────────────────────────────────────────────────────
select tests.clear_auth();
select is(public.ai_daily_limit(), 40, 'the daily cap is a stated number');
select ok(public.ai_claim_message('a7000000-0000-4000-8000-0000000000a1',
                                  'a7000000-0000-4000-8000-0000000000b1'),
  'the first message of the day is allowed');
select is((select messages from public.ai_usage
           where user_id = 'a7000000-0000-4000-8000-0000000000a1' and usage_date = current_date),
  1, 'and is counted');

-- Spend the rest of the allowance, then prove the cap actually stops the next one. The check and
-- the increment are one statement, so two requests arriving together cannot both be let through.
do $$
begin
  for i in 2..40 loop
    perform public.ai_claim_message('a7000000-0000-4000-8000-0000000000a1',
                                    'a7000000-0000-4000-8000-0000000000b1');
  end loop;
end $$;
select is((select messages from public.ai_usage
           where user_id = 'a7000000-0000-4000-8000-0000000000a1' and usage_date = current_date),
  40, 'forty is the whole allowance');
select ok(public.ai_claim_message('a7000000-0000-4000-8000-0000000000a1',
                                  'a7000000-0000-4000-8000-0000000000b1') = false,
  'the forty-first is refused, before any model is called');
select is((select messages from public.ai_usage
           where user_id = 'a7000000-0000-4000-8000-0000000000a1' and usage_date = current_date),
  40, 'and a refused claim does not increment the counter');

select tests.authenticate_as('a7000000-0000-4000-8000-0000000000a1');
select is(public.ai_messages_left(), 0, 'the traveler is told they have none left');

select tests.clear_auth();
select lives_ok(
  $$ select public.ai_record_cost('a7000000-0000-4000-8000-0000000000a1', 1200::bigint, 300::bigint, 13500::bigint) $$,
  'cost is recorded separately from the claim, so a failed call is still billed');
select is((select cost_micros from public.ai_usage
           where user_id = 'a7000000-0000-4000-8000-0000000000a1' and usage_date = current_date),
  13500::bigint, 'and the money lands in the staff-readable table');

select tests.authenticate_as('a7000000-0000-4000-8000-0000000000a3');
select isnt((select count(*)::int from public.ai_usage), 0,
  'staff read the bill even though they cannot read a word of the conversation');

-- ── Taste ────────────────────────────────────────────────────────────────────
select tests.clear_auth();
insert into public.traveler_signals (user_id, kind, categories)
values ('a7000000-0000-4000-8000-0000000000a1', 'recommendation_opened', array['bars']::public.recommendation_category[]);

select tests.authenticate_as('a7000000-0000-4000-8000-0000000000a1');
select is((select category::text from public.traveler_taste() limit 1), 'food',
  'something they said they like outranks something they tapped once');
select is((select weight from public.traveler_taste() where category = 'bars'), 1.00::numeric,
  'and a single tap is worth exactly one');

select tests.authenticate_as('a7000000-0000-4000-8000-0000000000a2');
select is((select count(*)::int from public.traveler_taste('a7000000-0000-4000-8000-0000000000a1')), 0,
  'asking for somebody else''s taste returns nothing');

-- ── The group post ───────────────────────────────────────────────────────────
select tests.clear_auth();
select throws_ok(
  $$ insert into public.messages (room_id, sender_id, body)
     select r.id, null, 'Anonymous' from public.chat_rooms r limit 1 $$,
  '23514', null, 'a message with no sender must declare itself a system message');

select is(
  (select count(*)::int from public.assistant_group_posts), 0,
  'nothing has been posted to any group yet');
select lives_ok(
  $$ insert into public.assistant_group_posts (trip_id, post_date)
     values ('a7000000-0000-4000-8000-0000000000c1', current_date) $$,
  'the day can be claimed');
select throws_ok(
  $$ insert into public.assistant_group_posts (trip_id, post_date)
     values ('a7000000-0000-4000-8000-0000000000c1', current_date) $$,
  '23505', null, 'and a retried cron run cannot post the same morning twice');

select tests.clear_auth();
select * from finish();
rollback;
