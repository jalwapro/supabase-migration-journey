create table if not exists public.app_downloads (
  id text primary key,
  file_url text,
  file_name text not null default 'JALWA.apk',
  file_size bigint,
  updated_at timestamptz not null default now()
);

alter table public.app_downloads enable row level security;

drop policy if exists "app downloads public read" on public.app_downloads;
create policy "app downloads public read"
  on public.app_downloads
  for select
  to anon, authenticated
  using (true);

drop policy if exists "app downloads admin insert" on public.app_downloads;
create policy "app downloads admin insert"
  on public.app_downloads
  for insert
  to authenticated
  with check ((select public.is_admin(auth.uid())));

drop policy if exists "app downloads admin update" on public.app_downloads;
create policy "app downloads admin update"
  on public.app_downloads
  for update
  to authenticated
  using ((select public.is_admin(auth.uid())))
  with check ((select public.is_admin(auth.uid())));

drop policy if exists "app downloads admin delete" on public.app_downloads;
create policy "app downloads admin delete"
  on public.app_downloads
  for delete
  to authenticated
  using ((select public.is_admin(auth.uid())));

insert into public.app_downloads (id, file_url, file_name)
values ('android', null, 'JALWA.apk')
on conflict (id) do nothing;

grant select on public.app_downloads to anon, authenticated;
grant insert, update, delete on public.app_downloads to authenticated;
