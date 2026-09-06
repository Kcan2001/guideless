-- 027_live_moments_notifications
-- Phase 2 feature switched on: Live Moments (spec §24). In-app notification rows are written for
-- trip members when a moment is announced or an itinerary item changes/cancels; push/email fan-out
-- from those rows is the notify Edge Function's job (docs/api.md).

update public.feature_flags set enabled = true where key = 'live_moments';

-- Fan a notification out to every active member of a trip except the actor.
create or replace function public.notify_trip_members(
  p_trip_id   uuid,
  p_category  public.notification_category,
  p_type      text,
  p_title     text,
  p_body      text,
  p_deep_link jsonb,
  p_exclude   uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.notifications (user_id, category, type, title, body, deep_link, trip_id)
  select m.user_id, p_category, p_type, p_title, p_body, p_deep_link, p_trip_id
  from public.trip_members m
  where m.trip_id = p_trip_id
    and m.removed_at is null
    and (p_exclude is null or m.user_id <> p_exclude);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.notify_trip_members(uuid, public.notification_category, text, text, text, jsonb, uuid) from public;
grant execute on function public.notify_trip_members(uuid, public.notification_category, text, text, text, jsonb, uuid) to service_role;

-- New or newly-live moment → social notification ("Sunset walk at 7:45").
create or replace function public.live_moments_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_when text;
begin
  if new.visibility = 'staff_only' then return new; end if;
  if tg_op = 'INSERT' and new.status not in ('scheduled', 'live') then return new; end if;
  if tg_op = 'UPDATE' and not (old.status = 'draft' and new.status in ('scheduled', 'live')) then return new; end if;

  v_when := to_char(new.start_at at time zone new.timezone, 'HH24:MI');
  perform public.notify_trip_members(
    new.trip_id,
    'social',
    'live_moment',
    case when new.is_official then 'New from Guideless: ' || new.title else new.title end,
    coalesce(new.location_name || ' · ', '') || 'at ' || v_when || case when new.is_official then '' else ' — a traveler is going' end,
    jsonb_build_object('kind', 'live_moment', 'tripId', new.trip_id, 'momentId', new.id),
    new.created_by
  );
  return new;
end;
$$;
create trigger live_moments_notify after insert or update of status on public.live_moments
  for each row execute function public.live_moments_notify();

-- Itinerary item changed or cancelled on a live trip → operational notification.
create or replace function public.trip_items_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.visibility = 'staff_only' then return new; end if;
  if new.status = old.status and new.start_time is not distinct from old.start_time
     and new.title = old.title and new.location_name is not distinct from old.location_name then
    return new;
  end if;
  perform public.notify_trip_members(
    new.trip_id,
    'operational',
    'itinerary_change',
    case when new.status = 'cancelled' then 'Cancelled: ' || new.title else 'Updated: ' || new.title end,
    case
      when new.status = 'cancelled' then 'This item is no longer happening. Check your route for what is next.'
      when new.start_time is not null then 'Now at ' || to_char(new.start_time, 'HH24:MI') || coalesce(' · ' || new.location_name, '')
      else 'Details changed. Open your route for the latest.'
    end,
    jsonb_build_object('kind', 'itinerary_item', 'tripId', new.trip_id, 'itemId', new.id)
  );
  return new;
end;
$$;
create trigger trip_items_notify after update on public.trip_itinerary_items
  for each row execute function public.trip_items_notify();

-- Participant counts for the app without exposing who joined beyond what RLS already allows.
create or replace view public.live_moment_counts
with (security_invoker = true) as
select moment_id, count(*) filter (where status = 'joined')::integer as joined
from public.live_moment_participants
group by moment_id;
grant select on public.live_moment_counts to authenticated;
