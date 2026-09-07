-- 035_admin_support_documents
-- Two small pieces for the staff inbox and trip documents in admin:
--   support_threads.assigned_to   who on staff owns the thread (the older support_assignments log
--                                 table stays for history; this is the live pointer the inbox shows)
--   trip_documents_notify         a document added for a trip (or one traveler) tells the people it
--                                 is for, so the app's Documents screen and inbox pick it up

alter table public.support_threads
  add column assigned_to uuid references auth.users (id) on delete set null;
create index support_threads_assigned_idx on public.support_threads (assigned_to) where assigned_to is not null;

create or replace function public.trip_documents_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.visibility = 'staff_only' then return new; end if;
  if new.for_user_id is not null then
    insert into public.notifications (user_id, category, type, title, body, deep_link, trip_id, dedupe_key)
    values (new.for_user_id, 'operational', 'document_added',
            'New document: ' || new.title,
            'Open Documents in your trip to view it.',
            jsonb_build_object('kind', 'trip', 'tripId', new.trip_id), new.trip_id,
            'document:' || new.id || ':' || new.for_user_id)
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
  else
    perform public.notify_trip_members(
      new.trip_id, 'operational', 'document_added',
      'New document: ' || new.title,
      'Open Documents in your trip to view it.',
      jsonb_build_object('kind', 'trip', 'tripId', new.trip_id),
      null, 'document:' || new.id);
  end if;
  return new;
end;
$$;
create trigger trip_documents_notify after insert on public.trip_documents
  for each row execute function public.trip_documents_notify();
