-- 047_itinerary_changes
-- "Your 9:15 train has been replaced. New departure 9:32, platform 2." Today a changed item
-- only carries an `Updated` pill and a generic notification, so a traveler sees that something
-- moved but not what. Staff can now write the reason and point at the replacement item, and the
-- notification carries that sentence instead of "Details changed."

alter table public.trip_itinerary_items
  add column change_note         text check (char_length(change_note) <= 280),
  add column replaced_by_item_id uuid references public.trip_itinerary_items (id) on delete set null,
  add column changed_at          timestamptz,
  add constraint trip_itinerary_items_no_self_replacement
    check (replaced_by_item_id is null or replaced_by_item_id <> id);

comment on column public.trip_itinerary_items.change_note is
  'What actually changed, in the traveler''s words: "Replaced by the 9:32; platform 2." Sent in the push.';
comment on column public.trip_itinerary_items.replaced_by_item_id is
  'The item that took this one''s place, so the app can link straight to it.';

-- Stamp changed_at whenever staff mark an item changed or edit the note.
create or replace function public.trip_items_stamp_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.status = 'changed' and old.status is distinct from 'changed')
     or new.change_note is distinct from old.change_note then
    new.changed_at := now();
  end if;
  return new;
end;
$$;
create trigger trip_items_stamp_change before update on public.trip_itinerary_items
  for each row execute function public.trip_items_stamp_change();

-- The notification now leads with the staff note when there is one. Everything else about the
-- trigger is unchanged, so the existing notification tests keep passing.
create or replace function public.trip_items_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.visibility = 'staff_only' then return new; end if;
  if new.status = old.status and new.start_time is not distinct from old.start_time
     and new.title = old.title and new.location_name is not distinct from old.location_name
     and new.change_note is not distinct from old.change_note then
    return new;
  end if;
  perform public.notify_trip_members(
    new.trip_id,
    'operational',
    'itinerary_change',
    case when new.status = 'cancelled' then 'Cancelled: ' || new.title else 'Updated: ' || new.title end,
    case
      when new.change_note is not null and char_length(btrim(new.change_note)) > 0 then new.change_note
      when new.status = 'cancelled' then 'This item is no longer happening. Check your route for what is next.'
      when new.start_time is not null then 'Now at ' || to_char(new.start_time, 'HH24:MI') || coalesce(' · ' || new.location_name, '')
      else 'Details changed. Open your route for the latest.'
    end,
    jsonb_build_object(
      'kind', 'itinerary_item',
      'tripId', new.trip_id,
      'itemId', new.id,
      'replacedById', new.replaced_by_item_id
    )
  );
  return new;
end;
$$;
