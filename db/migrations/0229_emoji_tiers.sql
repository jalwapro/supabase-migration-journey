-- Extend chat_emojis with VIP tier gating + admin write access.
-- Public: SELECT active rows. Admin (has_role): full write.

alter table public.chat_emojis
  add column if not exists tier text not null default 'normal'
    check (tier in ('normal','vip','svip','host_only')),
  add column if not exists min_vip_level integer not null default 0,
  add column if not exists is_animated boolean not null default false;

create index if not exists idx_chat_emojis_tier_active
  on public.chat_emojis (tier, is_active, sort_order);

-- Ensure admin writes work through PostgREST
grant insert, update, delete on public.chat_emojis to authenticated;

-- Existing "chat_emojis read" policy already covers SELECT to anon/authenticated.
-- Admin write policies:
drop policy if exists "chat_emojis admin insert" on public.chat_emojis;
create policy "chat_emojis admin insert" on public.chat_emojis
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "chat_emojis admin update" on public.chat_emojis;
create policy "chat_emojis admin update" on public.chat_emojis
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "chat_emojis admin delete" on public.chat_emojis;
create policy "chat_emojis admin delete" on public.chat_emojis
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

alter table public.chat_emojis enable row level security;

-- Seed: mark half the fancy emojis as VIP-only so tiering is visible immediately.
-- These are the "magic" and "action" categories → treat as VIP perks.
update public.chat_emojis
   set tier = 'vip', min_vip_level = 1
 where category in ('magic','action')
   and tier = 'normal';
