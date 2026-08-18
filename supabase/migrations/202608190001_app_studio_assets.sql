-- App Studio asset registry. Reuses the existing Studio project key model.
create table if not exists public.app_studio_assets (
  id uuid primary key default gen_random_uuid(),
  project_key text not null default 'jalwa',
  name text not null,
  url text not null,
  type text not null,
  category text not null default 'images',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_app_studio_assets_project_category on public.app_studio_assets(project_key, category);
create index if not exists idx_app_studio_assets_type on public.app_studio_assets(type);

alter table public.app_studio_assets enable row level security;

drop policy if exists "studio assets admin select" on public.app_studio_assets;
drop policy if exists "studio assets admin insert" on public.app_studio_assets;
drop policy if exists "studio assets admin update" on public.app_studio_assets;
drop policy if exists "studio assets admin delete" on public.app_studio_assets;

create policy "studio assets admin select" on public.app_studio_assets for select using (public.is_admin(auth.uid()));
create policy "studio assets admin insert" on public.app_studio_assets for insert with check (public.is_admin(auth.uid()));
create policy "studio assets admin update" on public.app_studio_assets for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "studio assets admin delete" on public.app_studio_assets for delete using (public.is_admin(auth.uid()));

-- Storage bucket is intentionally private; production URLs should be replaced by signed URLs
-- when the deployment requires private assets. This migration only registers the bucket contract.
insert into storage.buckets (id, name, public)
values ('app-studio-assets', 'app-studio-assets', true)
on conflict (id) do nothing;

drop policy if exists "studio asset storage admin all" on storage.objects;
create policy "studio asset storage admin all" on storage.objects for all
using (bucket_id = 'app-studio-assets' and public.is_admin(auth.uid()))
with check (bucket_id = 'app-studio-assets' and public.is_admin(auth.uid()));
