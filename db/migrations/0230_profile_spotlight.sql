-- Featured Profile Spotlight system.
-- Broadcasts a short cinematic (frame + bg animation + label) around a user's
-- avatar inside a room. Auto-triggered for top gifter/host, or fired manually
-- from admin panel on VIP request.

create table if not exists public.spotlight_animations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  label text not null default 'Top Fan',                -- shown under avatar
  overlay_asset_url text,                               -- animated frame around DP
  bg_animation_url text,                                -- fullscreen particles/aura
  duration_ms integer not null default 3500,
  tier_required text not null default 'any'
    check (tier_required in ('any','vip','svip','host_only')),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

grant select on public.spotlight_animations to anon, authenticated;
grant insert, update, delete on public.spotlight_animations to authenticated;
alter table public.spotlight_animations enable row level security;

drop policy if exists "spotlight_animations read" on public.spotlight_animations;
create policy "spotlight_animations read" on public.spotlight_animations
  for select using (is_active = true);

drop policy if exists "spotlight_animations admin write" on public.spotlight_animations;
create policy "spotlight_animations admin write" on public.spotlight_animations
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create table if not exists public.spotlight_triggers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid references public.live_rooms(id) on delete cascade,
  trigger_type text not null default 'manual'
    check (trigger_type in ('manual','top_gifter_daily','top_host_weekly','level_up','vip_join')),
  animation_id uuid references public.spotlight_animations(id) on delete set null,
  label_override text,
  triggered_at timestamptz not null default now(),
  triggered_by uuid references auth.users(id) on delete set null,
  seen_count integer not null default 0
);

create index if not exists idx_spotlight_triggers_room_time
  on public.spotlight_triggers (room_id, triggered_at desc);
create index if not exists idx_spotlight_triggers_user
  on public.spotlight_triggers (user_id, triggered_at desc);

grant select on public.spotlight_triggers to anon, authenticated;
grant insert on public.spotlight_triggers to authenticated;
grant update, delete on public.spotlight_triggers to authenticated;
alter table public.spotlight_triggers enable row level security;

-- Anyone in a room can see spotlights for that room (last 5 minutes only, via view).
drop policy if exists "spotlight_triggers read" on public.spotlight_triggers;
create policy "spotlight_triggers read" on public.spotlight_triggers
  for select using (true);

-- Only host of that room OR admin can create a spotlight for that room.
drop policy if exists "spotlight_triggers insert" on public.spotlight_triggers;
create policy "spotlight_triggers insert" on public.spotlight_triggers
  for insert to authenticated
  with check (
    public.has_role(auth.uid(), 'admin')
    or exists (
      select 1 from public.live_rooms r
       where r.id = room_id and r.host_id = auth.uid()
    )
  );

drop policy if exists "spotlight_triggers admin manage" on public.spotlight_triggers;
create policy "spotlight_triggers admin manage" on public.spotlight_triggers
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Seed a default animation so admin can trigger immediately.
insert into public.spotlight_animations (name, label, duration_ms, tier_required, sort_order)
values
  ('Gold Crown Aura', '👑 Top Gifter', 4000, 'any', 1),
  ('Rising Host Glow', '🔥 Rising Host', 4000, 'any', 2),
  ('VIP Diamond Halo', '💎 VIP Star', 4500, 'vip', 3)
on conflict do nothing;
