-- 0070_testimonial_submissions
--
-- A link Kyle can send to somebody who came on an earlier Monaco weekend, so they write the quote
-- and add the photos themselves instead of him transcribing them out of a chat thread.
--
-- The reason this is better than pasting quotes into /admin/testimonials is not convenience. It is
-- consent. Migration 0069 makes consent a check constraint, but a box Kyle ticks on somebody else's
-- behalf records only that Kyle believed they agreed. A box *they* tick, with their own name and
-- email against it, is the thing you actually want to be able to point at later. So a submission
-- carries its own consent and the conversion to a testimonial inherits it.
--
-- Three rules shape the schema:
--
--   * These people do not have accounts and must never be asked to make one. The submitter is
--     anonymous, which means the write goes through one security-definer function and there is no
--     insert policy at all — the same door pattern as submit_review() and subscribe_newsletter().
--   * A submission is not a testimonial. It is somebody's raw words plus an email address; the
--     testimonial is the curated thing Kyle publishes. Keeping them apart means trimming a quote
--     for length never destroys what was actually said, which matters because the message we send
--     promises to show them the wording before it goes up.
--   * Nothing anyone uploads is publicly reachable. The bucket is private, staff read it through
--     signed URLs, and a photo only becomes public when Kyle copies it into social-media by
--     publishing it — the same "nothing is public until a human publishes it" rule reviews follow.

create type public.submission_status as enum ('new', 'used', 'declined');

create table public.testimonial_submissions (
  id             uuid primary key,
  -- Which trip they are talking about, resolved from the slug in the link they were sent.
  tour_id        uuid references public.tours (id) on delete set null,
  author_name    text not null check (char_length(author_name) between 1 and 60),
  -- So Kyle can send the wording back before it goes live, which the outreach message promises.
  email          text not null check (char_length(email) <= 254),
  -- Their words, untrimmed. The testimonial row is where editing happens.
  quote          text not null check (char_length(quote) between 20 and 2000),
  trip_year      smallint check (trip_year between 2000 and 2100),
  -- Ticked by the person themselves. The RPC refuses a submission without it, so a row existing
  -- here is already a record that somebody agreed to be quoted.
  consent_public boolean not null,
  consent_photos boolean not null default false,
  -- Paths inside the private testimonial-uploads bucket, all under this submission's own folder.
  photo_paths    text[] not null default '{}',
  status         public.submission_status not null default 'new',
  staff_note     text check (char_length(staff_note) <= 1000),
  -- Set when Kyle turns this into something published, so the trail runs both ways.
  testimonial_id uuid references public.testimonials (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint testimonial_submissions_consent check (consent_public)
);

create index testimonial_submissions_status_idx
  on public.testimonial_submissions (status, created_at desc);
create index testimonial_submissions_tour_idx on public.testimonial_submissions (tour_id);

create trigger testimonial_submissions_set_updated_at
  before update on public.testimonial_submissions
  for each row execute function public.set_updated_at();

comment on table public.testimonial_submissions is
  'What a past traveler sent through /share/<tour>. Staff-only. Written solely by '
  'submit_testimonial(); converted into a testimonials row by hand.';
comment on column public.testimonial_submissions.consent_public is
  'Ticked by the submitter, not by staff. A row cannot exist without it.';

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Staff read; content staff manage. No insert policy: submit_testimonial() is the only door, so
-- the consent rule and the folder rule below cannot be sidestepped by posting at the table.
alter table public.testimonial_submissions enable row level security;

create policy "staff read testimonial submissions" on public.testimonial_submissions
  for select to authenticated
  using ((select public.is_staff()));

create policy "content staff manage testimonial submissions" on public.testimonial_submissions
  for update to authenticated
  using ((select public.is_content_staff()))
  with check ((select public.is_content_staff()));

create policy "content staff delete testimonial submissions" on public.testimonial_submissions
  for delete to authenticated
  using ((select public.is_content_staff()));

-- ── The only door ────────────────────────────────────────────────────────────
-- `p_id` is generated by the browser before the upload starts, because the photos have to go
-- somewhere before there is a row to attach them to. It is the primary key and the upload folder
-- name, which is what lets the check below hold: every path must sit inside this submission's own
-- folder, so a submission cannot claim photographs somebody else uploaded.
create or replace function public.submit_testimonial(
  p_id             uuid,
  p_tour_slug      text,
  p_author_name    text,
  p_email          text,
  p_quote          text,
  p_trip_year      integer default null,
  p_consent_public boolean default false,
  p_consent_photos boolean default false,
  p_photo_paths    text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tour_id uuid;
  v_path    text;
begin
  if not coalesce(p_consent_public, false) then
    raise exception 'consent is required' using errcode = '22023';
  end if;
  if p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(p_email) > 254 then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_quote, ''))) < 20 then
    raise exception 'quote too short' using errcode = '22023';
  end if;
  if cardinality(coalesce(p_photo_paths, '{}')) > 12 then
    raise exception 'too many photos' using errcode = '22023';
  end if;

  -- Every photo must live under this submission's own folder.
  foreach v_path in array coalesce(p_photo_paths, '{}') loop
    if v_path !~ ('^' || p_id::text || '/') then
      raise exception 'photo path outside the submission folder' using errcode = '22023';
    end if;
  end loop;

  select id into v_tour_id from public.tours where slug = p_tour_slug;

  insert into public.testimonial_submissions
    (id, tour_id, author_name, email, quote, trip_year, consent_public, consent_photos, photo_paths)
  values
    (p_id,
     v_tour_id,
     btrim(p_author_name),
     lower(btrim(p_email)),
     btrim(p_quote),
     p_trip_year::smallint,
     true,
     coalesce(p_consent_photos, false),
     coalesce(p_photo_paths, '{}'));
end $$;

revoke all on function public.submit_testimonial(uuid, text, text, text, text, integer, boolean, boolean, text[]) from public;
grant execute on function public.submit_testimonial(uuid, text, text, text, text, integer, boolean, boolean, text[])
  to anon, authenticated;

comment on function public.submit_testimonial(uuid, text, text, text, text, integer, boolean, boolean, text[]) is
  'The only way a testimonial submission is created. Refuses without consent, and refuses photo '
  'paths outside the submission own folder.';

-- ── Storage ──────────────────────────────────────────────────────────────────
-- Private on purpose. Nothing a stranger uploads should be fetchable by anyone until a human has
-- looked at it; staff view them through signed URLs and publishing copies the chosen one into the
-- public social-media bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('testimonial-uploads', 'testimonial-uploads', false, 15728640,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

-- Anyone may drop a file into a uuid-named folder; nobody anonymous may read one back or list
-- them. The bucket enforces size and content type, so this cannot become general file hosting.
create policy "anyone may upload a testimonial photo" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'testimonial-uploads'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and cardinality(storage.foldername(name)) = 1
  );

create policy "staff read testimonial uploads" on storage.objects
  for select to authenticated
  using (bucket_id = 'testimonial-uploads' and (select public.is_staff()));

create policy "content staff manage testimonial uploads" on storage.objects
  for delete to authenticated
  using (bucket_id = 'testimonial-uploads' and (select public.is_content_staff()));
