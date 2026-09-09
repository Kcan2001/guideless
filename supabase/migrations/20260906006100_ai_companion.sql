-- The trip assistant: what was said, what it cost, and how much is left today.
--
-- Three tables with three different privacy rules, which is the whole reason they are three
-- tables rather than one.
--
--   ai_conversations / ai_messages   what a traveler asked and what came back. Theirs only. No
--                                    staff policy exists, so no operations screen can read a
--                                    traveler's questions — and "we forgot to filter" cannot
--                                    happen to a policy that was never written.
--   ai_usage                         counts and money, per traveler per day. Staff-readable,
--                                    because somebody has to see a runaway bill the day it
--                                    happens. It holds no words.
--
-- That split is rule 11 applied to ourselves: the staff-visible half lives in its own table rather
-- than relying on a query to project the sensitive columns away.

create table public.ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- The trip being discussed. A conversation is scoped to one booking, because the assistant's
  -- entire usefulness comes from knowing which trip you are asking about.
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  trip_id     uuid references public.trips (id) on delete set null,
  title       text check (title is null or char_length(title) <= 200),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index ai_conversations_user_idx on public.ai_conversations (user_id, updated_at desc);
create unique index ai_conversations_one_per_booking_idx on public.ai_conversations (user_id, booking_id);

create trigger ai_conversations_set_updated_at before update on public.ai_conversations
  for each row execute function public.set_updated_at();

create table public.ai_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.ai_conversations (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  role             text not null check (role in ('user', 'assistant')),
  content          text not null check (char_length(content) <= 20000),
  -- What the assistant did on this turn, for the traveler's own audit: which places it looked up,
  -- what it added to their day. Never anything they did not do themselves or ask for.
  actions          jsonb not null default '[]'::jsonb check (jsonb_typeof(actions) = 'array'),
  created_at       timestamptz not null default now()
);

create index ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);

comment on table public.ai_messages is
  'A traveler''s conversation with the assistant. Private to them: there is no staff read policy, on purpose. Cost lives in ai_usage, which holds no words.';

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

create policy "own conversations" on public.ai_conversations
  for select to authenticated using (user_id = (select auth.uid()));
create policy "start own conversations" on public.ai_conversations
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id and b.customer_id = (select auth.uid())
    )
  );
create policy "rename own conversations" on public.ai_conversations
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "delete own conversations" on public.ai_conversations
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "own messages" on public.ai_messages
  for select to authenticated using (user_id = (select auth.uid()));
-- Messages are written by the server after a real model call, never straight from a browser: a
-- client that could insert an assistant turn could put words in our mouth and skip the meter.
create policy "service writes messages" on public.ai_messages
  for insert to service_role with check (true);
create policy "delete own messages" on public.ai_messages
  for delete to authenticated using (user_id = (select auth.uid()));

-- ── The meter ────────────────────────────────────────────────────────────────
create table public.ai_usage (
  user_id       uuid not null references auth.users (id) on delete cascade,
  usage_date    date not null,
  booking_id    uuid references public.bookings (id) on delete set null,
  messages      integer not null default 0 check (messages >= 0),
  input_tokens  bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  -- Integer minor units of a US cent's thousandth — money is never a float, and model pricing is
  -- far below a cent per call, so cents would round every row to zero.
  cost_micros   bigint not null default 0 check (cost_micros >= 0),
  updated_at    timestamptz not null default now(),
  primary key (user_id, usage_date)
);

comment on table public.ai_usage is
  'Assistant spend per traveler per day. Counts and money only, never words — which is what makes it safe for staff to read.';
comment on column public.ai_usage.cost_micros is
  'Millionths of a US dollar. Integer minor units, like every other amount in this database.';

alter table public.ai_usage enable row level security;

create policy "own usage" on public.ai_usage
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));
create policy "service writes usage" on public.ai_usage
  for all to service_role using (true) with check (true);

-- ── Daily cap ────────────────────────────────────────────────────────────────
-- Generous enough that no real traveler meets it, low enough that a loop or an abusive account
-- costs a few dollars rather than a few thousand before anybody notices.
create or replace function public.ai_daily_limit()
returns integer language sql immutable set search_path = '' as $$ select 40 $$;

comment on function public.ai_daily_limit is
  'Messages one traveler may send the assistant per day. A function rather than a constant so it can be raised in one place, in a migration, with a reason in the message.';

create or replace function public.ai_messages_left(p_user_id uuid default null)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    public.ai_daily_limit() - coalesce((
      select u.messages
      from public.ai_usage u
      where u.user_id = coalesce(p_user_id, (select auth.uid()))
        and u.usage_date = current_date
    ), 0),
    0
  )
  where coalesce(p_user_id, (select auth.uid())) = (select auth.uid())
     or (select public.is_staff());
$$;

revoke execute on function public.ai_messages_left(uuid) from public;
grant execute on function public.ai_messages_left(uuid) to authenticated, service_role;

/**
 * Claim one message against today's allowance, atomically.
 *
 * The check and the increment are the same statement on purpose: two requests arriving together
 * would both read 1 remaining and both be allowed if this were a select followed by an update.
 * Returns false when the traveler is out, and the caller must not call the model.
 */
create or replace function public.ai_claim_message(p_user_id uuid, p_booking_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  insert into public.ai_usage (user_id, usage_date, booking_id, messages)
  values (p_user_id, current_date, p_booking_id, 1)
  on conflict (user_id, usage_date) do update
    set messages = public.ai_usage.messages + 1,
        booking_id = coalesce(public.ai_usage.booking_id, excluded.booking_id),
        updated_at = now()
  where public.ai_usage.messages < public.ai_daily_limit()
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$$;

revoke execute on function public.ai_claim_message(uuid, uuid) from public;
grant execute on function public.ai_claim_message(uuid, uuid) to service_role;

comment on function public.ai_claim_message(uuid, uuid) is
  'Atomically spends one of today''s messages. False means the traveler is out and the model must not be called. Service role only: a client that could call this could also decline to.';

/** What the call actually cost, recorded after the model answers. */
create or replace function public.ai_record_cost(
  p_user_id uuid, p_input_tokens bigint, p_output_tokens bigint, p_cost_micros bigint
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_usage
  set input_tokens = input_tokens + greatest(p_input_tokens, 0),
      output_tokens = output_tokens + greatest(p_output_tokens, 0),
      cost_micros = cost_micros + greatest(p_cost_micros, 0),
      updated_at = now()
  where user_id = p_user_id and usage_date = current_date;
$$;

revoke execute on function public.ai_record_cost(uuid, bigint, bigint, bigint) from public;
grant execute on function public.ai_record_cost(uuid, bigint, bigint, bigint) to service_role;

-- ── What staff see ───────────────────────────────────────────────────────────
-- Money per trip, with no way through to a single traveler's questions.
create or replace view public.ai_cost_by_booking
with (security_invoker = true) as
select
  u.booking_id,
  count(*)::int              as travelers,
  sum(u.messages)::int       as messages,
  sum(u.input_tokens)::bigint  as input_tokens,
  sum(u.output_tokens)::bigint as output_tokens,
  sum(u.cost_micros)::bigint   as cost_micros,
  max(u.usage_date)          as last_used
from public.ai_usage u
where u.booking_id is not null
group by u.booking_id;

comment on view public.ai_cost_by_booking is
  'Assistant spend per booking for the admin cost screen. security_invoker, so a traveler sees only their own row and staff see all of them.';
