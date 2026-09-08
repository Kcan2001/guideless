-- Trip Builder saved configurations (plan v2 §14 "save/resume").
--
-- A signed-in traveler's in-progress configuration for one departure, so the builder resumes on
-- any device. Anonymous visitors keep the sessionStorage draft. Rows are owner-only, capped at
-- 32 KB, and purged after 30 days without a change. The draft shape is owned by the web app
-- (packages/validation builderDraftSchema); the database only stores and expires it.

create table public.builder_drafts (
  user_id       uuid not null references auth.users (id) on delete cascade,
  departure_id  uuid not null references public.departures (id) on delete cascade,
  draft         jsonb not null check (jsonb_typeof(draft) = 'object' and pg_column_size(draft) <= 32768),
  step          smallint not null default 0 check (step between 0 and 7),
  updated_at    timestamptz not null default now(),
  primary key (user_id, departure_id)
);
create index builder_drafts_updated_idx on public.builder_drafts (updated_at);

create trigger builder_drafts_set_updated_at before update on public.builder_drafts
  for each row execute function public.set_updated_at();

alter table public.builder_drafts enable row level security;

create policy "drafts: owner reads" on public.builder_drafts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "drafts: owner inserts" on public.builder_drafts
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "drafts: owner updates" on public.builder_drafts
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "drafts: owner deletes" on public.builder_drafts
  for delete to authenticated using (user_id = (select auth.uid()));

-- ── Expiry ───────────────────────────────────────────────────────────────────
create or replace function public.purge_stale_builder_drafts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.builder_drafts where updated_at < now() - interval '30 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.purge_stale_builder_drafts() from public, anon, authenticated;
grant execute on function public.purge_stale_builder_drafts() to service_role;

select cron.schedule('purge-stale-builder-drafts', '30 5 * * *', $$ select public.purge_stale_builder_drafts(); $$);
