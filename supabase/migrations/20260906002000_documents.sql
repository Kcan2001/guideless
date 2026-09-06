-- 020_documents
-- File metadata for private documents plus Storage buckets and object policies.
-- Private buckets are served only through signed URLs. Never trust the file extension.

create table public.trip_documents (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips (id) on delete cascade,
  kind          text not null check (kind in ('ticket', 'voucher', 'hotel_confirmation', 'insurance', 'guide', 'map', 'other')),
  title         text not null,
  bucket        text not null default 'trip-documents',
  storage_path  text not null unique,
  mime_type     text not null,
  size_bytes    integer not null check (size_bytes between 1 and 52428800),   -- 50 MB
  visibility    public.content_visibility not null default 'trip_member',
  -- If set, only this traveler (e.g. an individual train ticket); otherwise the whole group.
  for_user_id   uuid references auth.users (id) on delete cascade,
  uploaded_by   uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index trip_documents_trip_idx on public.trip_documents (trip_id);

create table public.booking_documents (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references public.bookings (id) on delete cascade,
  kind          text not null check (kind in ('invoice', 'receipt', 'confirmation', 'waiver', 'other')),
  title         text not null,
  bucket        text not null default 'booking-documents',
  storage_path  text not null unique,
  mime_type     text not null,
  size_bytes    integer not null check (size_bytes between 1 and 26214400),
  uploaded_by   uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index booking_documents_booking_idx on public.booking_documents (booking_id);

-- ── RLS (metadata) ───────────────────────────────────────────────────────────
alter table public.trip_documents enable row level security;
alter table public.booking_documents enable row level security;

create policy "trip members read their documents" on public.trip_documents
  for select to authenticated
  using (
    (select public.is_staff())
    or (
      visibility <> 'staff_only'
      and (select public.is_trip_member(trip_id))
      and (for_user_id is null or for_user_id = (select auth.uid()))
    )
  );
create policy "ops staff manage trip documents" on public.trip_documents
  for all to authenticated using ((select public.is_ops_staff())) with check ((select public.is_ops_staff()));

create policy "customers read booking documents" on public.booking_documents
  for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_documents.booking_id
                 and (b.customer_id = (select auth.uid()) or (select public.is_staff()))));
create policy "ops staff manage booking documents" on public.booking_documents
  for all to authenticated using ((select public.is_ops_staff())) with check ((select public.is_ops_staff()));

-- ── Storage buckets ──────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('public-assets',       'public-assets',       true,  10485760, null),
  ('tour-images',         'tour-images',         true,  10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('user-avatars',        'user-avatars',        true,  2097152,  array['image/jpeg', 'image/png', 'image/webp']),
  ('trip-documents',      'trip-documents',      false, 52428800, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('booking-documents',   'booking-documents',   false, 26214400, array['application/pdf', 'image/jpeg', 'image/png']),
  ('support-attachments', 'support-attachments', false, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']),
  ('trip-media',          'trip-media',          false, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4'])
on conflict (id) do nothing;

-- ── Storage object policies ──────────────────────────────────────────────────
-- Path conventions:
--   user-avatars/{user_id}/...            trip-documents/{trip_id}/...
--   support-attachments/{user_id}/...     trip-media/{trip_id}/{user_id}/...
--   tour-images/**, public-assets/**      (content staff write, world read via public bucket)

create policy "public buckets are readable" on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('public-assets', 'tour-images', 'user-avatars'));

create policy "content staff manage public assets" on storage.objects
  for all to authenticated
  using (bucket_id in ('public-assets', 'tour-images') and (select public.is_content_staff()))
  with check (bucket_id in ('public-assets', 'tour-images') and (select public.is_content_staff()));

create policy "users manage their avatar folder" on storage.objects
  for all to authenticated
  using (bucket_id = 'user-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'user-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "trip members read trip documents" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'trip-documents'
    and ((select public.is_staff())
         or exists (select 1 from public.trip_documents d
                    where d.storage_path = objects.name
                      and d.visibility <> 'staff_only'
                      and (select public.is_trip_member(d.trip_id))
                      and (d.for_user_id is null or d.for_user_id = (select auth.uid()))))
  );
create policy "ops staff manage trip documents" on storage.objects
  for all to authenticated
  using (bucket_id = 'trip-documents' and (select public.is_ops_staff()))
  with check (bucket_id = 'trip-documents' and (select public.is_ops_staff()));

create policy "customers read booking documents" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'booking-documents'
    and ((select public.is_staff())
         or exists (select 1 from public.booking_documents d
                    join public.bookings b on b.id = d.booking_id
                    where d.storage_path = objects.name and b.customer_id = (select auth.uid())))
  );
create policy "ops staff manage booking documents" on storage.objects
  for all to authenticated
  using (bucket_id = 'booking-documents' and (select public.is_ops_staff()))
  with check (bucket_id = 'booking-documents' and (select public.is_ops_staff()));

create policy "users upload support attachments to their folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'support-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "support attachment owners and staff read" on storage.objects
  for select to authenticated
  using (bucket_id = 'support-attachments'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_support_staff())));

create policy "trip members read trip media" on storage.objects
  for select to authenticated
  using (bucket_id = 'trip-media'
         and ((select public.is_staff())
              or (select public.is_trip_member(((storage.foldername(name))[1])::uuid))));
create policy "trip members upload their own trip media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'trip-media'
              and (storage.foldername(name))[2] = (select auth.uid())::text
              and (select public.is_trip_member(((storage.foldername(name))[1])::uuid)));
create policy "owners delete their trip media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'trip-media'
         and ((storage.foldername(name))[2] = (select auth.uid())::text or (select public.is_moderator())));
