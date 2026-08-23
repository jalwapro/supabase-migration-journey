-- Voice room room-cover storage.
-- Public read is required because cover_url is rendered by all room viewers.
-- Writes are restricted to the host of the room referenced by the path.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'room-assets',
  'room-assets',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp','image/gif']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "room assets public read"
on storage.objects
for select
using (bucket_id = 'room-assets');

create policy "room host can upload cover"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'room-assets'
  and (storage.foldername(name))[1] = 'room-covers'
  and exists (
    select 1 from public.live_rooms r
    where r.id = ((storage.foldername(name))[2])::uuid
      and r.host_id = (select auth.uid())
  )
);

create policy "room host can update cover"
on storage.objects
for update to authenticated
using (
  bucket_id = 'room-assets'
  and (storage.foldername(name))[1] = 'room-covers'
  and exists (
    select 1 from public.live_rooms r
    where r.id = ((storage.foldername(name))[2])::uuid
      and r.host_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'room-assets'
  and (storage.foldername(name))[1] = 'room-covers'
  and exists (
    select 1 from public.live_rooms r
    where r.id = ((storage.foldername(name))[2])::uuid
      and r.host_id = (select auth.uid())
  )
);

create policy "room host can delete cover"
on storage.objects
for delete to authenticated
using (
  bucket_id = 'room-assets'
  and (storage.foldername(name))[1] = 'room-covers'
  and exists (
    select 1 from public.live_rooms r
    where r.id = ((storage.foldername(name))[2])::uuid
      and r.host_id = (select auth.uid())
  )
);
