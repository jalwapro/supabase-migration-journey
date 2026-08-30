create table if not exists public.room_slides (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  image_url text not null,
  link_url text,
  is_active boolean default true,
  sort_order int default 0,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.room_slides enable row level security;

create policy "Anyone can read active room slides"
  on public.room_slides for select
  using (is_active = true);

create policy "Admins can manage room slides"
  on public.room_slides for all
  using (public.is_admin())
  with check (public.is_admin());

create index if not exists room_slides_active_sort_idx
  on public.room_slides (is_active, sort_order);
