begin;

insert into storage.buckets (id, name, public)
values ('room-assets', 'room-assets', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "room-assets public read" on storage.objects;
create policy "room-assets public read"
  on storage.objects for select
  using (bucket_id = 'room-assets');

drop policy if exists "room-assets host insert" on storage.objects;
create policy "room-assets host insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'room-assets'
    and exists (
      select 1 from public.live_rooms r
      where r.id::text = (storage.foldername(name))[1]
        and r.host_id = auth.uid()
    )
  );

drop policy if exists "room-assets host update" on storage.objects;
create policy "room-assets host update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'room-assets'
    and exists (
      select 1 from public.live_rooms r
      where r.id::text = (storage.foldername(name))[1]
        and r.host_id = auth.uid()
    )
  )
  with check (bucket_id = 'room-assets');

drop policy if exists "room-assets host delete" on storage.objects;
create policy "room-assets host delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'room-assets'
    and exists (
      select 1 from public.live_rooms r
      where r.id::text = (storage.foldername(name))[1]
        and r.host_id = auth.uid()
    )
  );

commit;
