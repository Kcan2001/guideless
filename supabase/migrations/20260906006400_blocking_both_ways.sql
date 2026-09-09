-- Blocking someone means they cannot see you either.
--
-- Migration 0063 hit this while building the trip map: the block check was a subquery against
-- `user_blocks`, which has its own row-level security limiting you to the blocks *you* created. So
-- it could hide the people you blocked, but somebody who had blocked *you* still saw everything you
-- posted, because their block row was invisible to your query. That was fixed for locations with
-- `blocked_between()`, a security-definer helper that can see both sides.
--
-- Chat still had the original one-way version, and calling that "normal" was too generous. If a
-- traveler blocks somebody on their trip, they mean "I do not want anything to do with this
-- person" — not "I would like to stop seeing their messages while they carry on reading mine". In
-- a small group travelling together for a week, the second reading is the one that gets somebody
-- hurt.
--
-- So chat now uses the same helper, and blocking means the same thing everywhere in the product.
--
-- What this changes in practice: a message you sent before being blocked stops being visible to the
-- person who blocked you, and theirs stop being visible to you. Nothing is deleted — the room is
-- simply rendered without the other person in it, for both of you. Moderators still see everything,
-- because a report about a message nobody can show them is not something they can act on.

-- Read: room member, message not deleted (unless moderator), and neither of you has blocked the
-- other. `blocked_between` is security definer for the reason above; inlining the subquery here is
-- what created the asymmetry in the first place.
create or replace function public.can_read_message(p_sender_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  -- A system post has no sender, so there is nobody to have blocked: it is always readable.
  select p_sender_id is null
      or not public.blocked_between((select auth.uid()), p_sender_id);
$$;

revoke execute on function public.can_read_message(uuid) from public;
grant execute on function public.can_read_message(uuid) to authenticated, service_role;

comment on function public.can_read_message(uuid) is
  'Whether the caller may see a message from this sender: yes unless either of them has blocked the other. Null sender (a system post) is always readable.';

drop policy "members read messages" on public.messages;

create policy "members read messages" on public.messages
  for select to authenticated
  using (
    (select public.is_moderator())
    or (
      (select public.is_chat_member(room_id))
      and deleted_at is null
      and public.can_read_message(sender_id)
    )
  );
