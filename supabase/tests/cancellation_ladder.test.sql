-- pgTAP tests for migration 0054: cancellation ladders on stored hotel rates.
--
-- A LiteAPI probe of one hotel over one date range returned 200 rates, 116 with more than one
-- cancellation window and the deepest with five. The single-deadline model dropped every middle
-- rung. These assert the reading logic, never an amount from the catalog.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- ── Reading a ladder ─────────────────────────────────────────────────────────
select is(
  public.hotel_rate_free_until('{"windows":[
     {"from":"2027-05-20T10:00:00Z","penaltyAmount":20000},
     {"from":"2027-05-01T10:00:00Z","penaltyAmount":5000}]}'::jsonb),
  '2027-05-01T10:00:00Z'::timestamptz,
  'free cancellation ends at the earliest rung, whatever order the supplier sent them');

select is(
  public.hotel_rate_free_until('{"deadline":"2027-05-20T23:59:00Z"}'::jsonb),
  '2027-05-20T23:59:00Z'::timestamptz,
  'a rate stored before ladders existed still reads');

select is(
  public.hotel_rate_free_until('{"description":"Non-refundable"}'::jsonb),
  null,
  'no ladder and no deadline reads as null');

select is(
  public.hotel_rate_free_until('{"windows":"not an array"}'::jsonb),
  null,
  'a malformed windows value does not raise, it reads as null');

-- ── The rung that applies ────────────────────────────────────────────────────
select is(
  public.hotel_rate_penalty_at('{"windows":[
     {"from":"2027-05-01T10:00:00Z","penaltyAmount":5000},
     {"from":"2027-05-20T10:00:00Z","penaltyAmount":20000},
     {"from":"2027-05-28T10:00:00Z","penaltyAmount":48000}]}'::jsonb,
   '2027-04-01T00:00:00Z'::timestamptz),
  0::bigint, 'nothing is charged before the first rung');

select is(
  public.hotel_rate_penalty_at('{"windows":[
     {"from":"2027-05-01T10:00:00Z","penaltyAmount":5000},
     {"from":"2027-05-20T10:00:00Z","penaltyAmount":20000},
     {"from":"2027-05-28T10:00:00Z","penaltyAmount":48000}]}'::jsonb,
   '2027-05-22T00:00:00Z'::timestamptz),
  20000::bigint, 'the middle rung applies in the middle, which one deadline could not express');

select is(
  public.hotel_rate_penalty_at('{"windows":[
     {"from":"2027-05-01T10:00:00Z","penaltyAmount":5000},
     {"from":"2027-05-28T10:00:00Z","penaltyAmount":48000}]}'::jsonb,
   '2027-06-10T00:00:00Z'::timestamptz),
  48000::bigint, 'the deepest rung applies after the last one opens');

select is(
  public.hotel_rate_penalty_at('{"windows":[{"from":"2027-05-01T10:00:00Z","penaltyAmount":5000}]}'::jsonb,
   '2027-05-01T10:00:00Z'::timestamptz),
  5000::bigint, 'the boundary is inside the window, not before it');

select is(
  public.hotel_rate_penalty_at('{"description":"Non-refundable"}'::jsonb, now()),
  0::bigint, 'a policy with no windows charges zero here; refundable is what tells it from free');

-- ── Both helpers are immutable, which is what lets the grouping key use them ──
select is(
  (select p.provolatile::text from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'hotel_rate_free_until'),
  'i', 'hotel_rate_free_until is immutable, so DISTINCT ON can group by it');

-- ── The equivalent-product key moved off the legacy field ───────────────────
select isnt(
  (select pg_get_functiondef(p.oid) from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'suggest_stay_price'),
  null, 'suggest_stay_price still exists after the redefinition');

select * from finish();
rollback;
