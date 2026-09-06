-- 026_realtime_publication
-- Expose the tables the mobile app subscribes to through Supabase Realtime (Postgres Changes).
-- Realtime evaluates RLS with the subscriber's JWT, so members only receive rows they may read.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.trip_itinerary_items;
alter publication supabase_realtime add table public.live_moments;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.support_messages;

-- Deletes/updates on messages need the old row identity for filters to work.
alter table public.messages replica identity full;
alter table public.trip_itinerary_items replica identity full;
