-- JALWA CP add-ons: memories storage, exclusive couple gifts, broadcasts, weekly settlement.
-- Designed against the existing CP schema. Does not modify LiveKit.
begin;

-- 1. Public CP memory images. Uploads are restricted to a user-owned first-level folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cp-photos', 'cp-photos', true, 10485760,
        array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public Access cp-photos" on storage.objects;
create policy "Public Access cp-photos"
  on storage.objects for select
  using (bucket_id = 'cp-photos');

drop policy if exists "Authenticated Upload cp-photos" on storage.objects;
create policy "Authenticated Upload cp-photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'cp-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "User Delete Own cp-photos" on storage.objects;
create policy "User Delete Own cp-photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'cp-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 2. Exclusive gifts catalogue.
create table if not exists public.cp_exclusive_gifts_config (
  id text primary key,
  name text not null,
  price bigint not null check (price >= 0),
  icon_url text not null,
  intimacy_points integer not null default 10 check (intimacy_points > 0),
  required_cp_level integer not null default 1 check (required_cp_level between 1 and 100),
  animation_url text,
  broadcast_threshold boolean not null default false,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.cp_levels_config(level,name,min_intimacy)
values (5,'Royal',100000),(6,'Celestial',200000),(7,'Eternal',500000)
on conflict (level) do nothing;

insert into public.cp_exclusive_gifts_config
  (id,name,price,icon_url,intimacy_points,required_cp_level,animation_url,broadcast_threshold,description,sort_order)
values
  ('cp_rose_bouquet','Sweet Rose Bouquet',999,'/gifts/cp/rose-bouquet.png',100,1,'/animations/cp/rose-bloom.svga',false,'A fresh bouquet expressing gentle romantic care',1),
  ('cp_love_letter','Love Confession Scroll',2520,'/gifts/cp/love-letter.png',280,2,'/animations/cp/love-scroll.svga',false,'Handwritten vows carrying double intimate warmth',2),
  ('cp_eternal_wings','Wings of Eternity',9999,'/gifts/cp/eternal-wings.png',1200,3,'/animations/cp/wings.svga',true,'Twin glowing wings that soar together forever',3),
  ('cp_dream_castle','Fairytale Crystal Palace',29999,'/gifts/cp/crystal-castle.png',4000,5,'/animations/cp/castle.svga',true,'A majestic crystal palace built for two souls',4),
  ('cp_galaxy_carriage','Interstellar Wedding Carriage',99999,'/gifts/cp/galaxy-carriage.png',15000,7,'/animations/cp/carriage.svga',true,'Royal cosmic carriage with universal room broadcast',5)
on conflict (id) do update set
  name=excluded.name, price=excluded.price, icon_url=excluded.icon_url,
  intimacy_points=excluded.intimacy_points, required_cp_level=excluded.required_cp_level,
  animation_url=excluded.animation_url, broadcast_threshold=excluded.broadcast_threshold,
  description=excluded.description, sort_order=excluded.sort_order, is_active=true;

alter table public.cp_exclusive_gifts_config enable row level security;
drop policy if exists cp_exclusive_gifts_read_active on public.cp_exclusive_gifts_config;
create policy cp_exclusive_gifts_read_active on public.cp_exclusive_gifts_config
  for select to anon, authenticated using (is_active);
revoke all on public.cp_exclusive_gifts_config from anon, authenticated;
grant select on public.cp_exclusive_gifts_config to anon, authenticated;

-- Each exclusive gift gets a proper audit record; this event is included in weekly CP scores.
create table if not exists public.cp_exclusive_gift_events (
  id uuid primary key default gen_random_uuid(),
  relation_id uuid not null references public.cp_relations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  gift_id text not null references public.cp_exclusive_gifts_config(id),
  coins_spent bigint not null check (coins_spent > 0),
  intimacy bigint not null check (intimacy > 0),
  created_at timestamptz not null default now()
);
create index if not exists cp_exclusive_gift_events_week_idx
  on public.cp_exclusive_gift_events(created_at desc, relation_id);
alter table public.cp_exclusive_gift_events enable row level security;
drop policy if exists cp_exclusive_gift_events_participants_read on public.cp_exclusive_gift_events;
create policy cp_exclusive_gift_events_participants_read on public.cp_exclusive_gift_events
  for select to authenticated using (sender_id=(select auth.uid()) or receiver_id=(select auth.uid()));
revoke all on public.cp_exclusive_gift_events from anon, authenticated;
grant select on public.cp_exclusive_gift_events to authenticated;

-- 3. Broadcast queue consumed by CpGlobalMarquee. Writes only through trusted RPCs.
create table if not exists public.cp_broadcasts (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'announcement',
  title text not null,
  message text not null,
  sender_name text,
  sender_avatar text,
  receiver_name text,
  receiver_avatar text,
  icon_url text,
  created_at timestamptz not null default now()
);
create index if not exists cp_broadcasts_created_at_idx on public.cp_broadcasts(created_at desc);
alter table public.cp_broadcasts enable row level security;
drop policy if exists cp_broadcasts_authenticated_read on public.cp_broadcasts;
create policy cp_broadcasts_authenticated_read on public.cp_broadcasts
  for select to authenticated using (true);
revoke all on public.cp_broadcasts from anon, authenticated;
grant select on public.cp_broadcasts to authenticated;

-- 4. Atomic gift purchase. Wallet debit, ledger, intimacy event and broadcast commit together.
create or replace function public.cp_send_exclusive_gift(p_gift_id text, p_message text default null)
returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_sender uuid := auth.uid();
  v_rel public.cp_relations%rowtype;
  v_partner uuid;
  v_gift public.cp_exclusive_gifts_config%rowtype;
  v_balance bigint;
  v_sender_name text;
  v_sender_avatar text;
  v_partner_name text;
  v_partner_avatar text;
  v_new_intimacy bigint;
  v_new_level integer;
  v_event_id uuid;
begin
  if v_sender is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_gift_id is null or length(p_gift_id) > 100 then raise exception 'INVALID_GIFT_ID'; end if;
  if p_message is not null and length(p_message) > 250 then raise exception 'MESSAGE_TOO_LONG'; end if;

  select * into v_rel from public.cp_relations
   where status='active' and (user1_id=v_sender or user2_id=v_sender)
   for update;
  if not found then raise exception 'NO_ACTIVE_CP'; end if;
  v_partner := case when v_rel.user1_id=v_sender then v_rel.user2_id else v_rel.user1_id end;

  select * into v_gift from public.cp_exclusive_gifts_config
   where id=p_gift_id and is_active=true;
  if not found then raise exception 'GIFT_NOT_FOUND'; end if;
  if coalesce(v_rel.ring_level,1) < v_gift.required_cp_level then
    raise exception 'CP_LEVEL_TOO_LOW';
  end if;

  select username,avatar into v_sender_name,v_sender_avatar from public.profiles where id=v_sender;
  select username,avatar into v_partner_name,v_partner_avatar from public.profiles where id=v_partner;

  update public.profiles set coins=coins-v_gift.price,updated_at=now()
   where id=v_sender and coins >= v_gift.price
   returning coins into v_balance;
  if not found then raise exception 'INSUFFICIENT_COINS'; end if;

  perform set_config('app.trusted_definer','on',true);
  insert into public.wallet_transactions
    (user_id,kind,coins,coins_delta,balance_coins_after,ref_type,note)
  values
    (v_sender,'cp_exclusive_gift',v_gift.price,-v_gift.price,v_balance,'cp',
     format('CP gift: %s to %s',v_gift.name,coalesce(v_partner_name,'partner')));
  perform set_config('app.trusted_definer','off',true);

  insert into public.cp_exclusive_gift_events
    (relation_id,sender_id,receiver_id,gift_id,coins_spent,intimacy)
  values (v_rel.id,v_sender,v_partner,p_gift_id,v_gift.price,v_gift.intimacy_points)
  returning id into v_event_id;

  update public.cp_relations
    set intimacy_score=intimacy_score+v_gift.intimacy_points
    where id=v_rel.id
    returning intimacy_score into v_new_intimacy;

  select level into v_new_level from public.cp_levels_config
   where min_intimacy <= v_new_intimacy order by min_intimacy desc,level desc limit 1;
  if v_new_level is not null then
    update public.cp_relations set ring_level=v_new_level where id=v_rel.id;
  else
    v_new_level := v_rel.ring_level;
  end if;

  if v_gift.broadcast_threshold or v_gift.price >= 20000 then
    insert into public.cp_broadcasts
      (type,title,message,sender_name,sender_avatar,receiver_name,receiver_avatar,icon_url)
    values
      ('gift',format('Romantic Gift: %s',v_gift.name),
       format('%s presented %s to %s! Intimacy +%s%s',
         coalesce(v_sender_name,'A partner'),v_gift.name,coalesce(v_partner_name,'their beloved'),
         v_gift.intimacy_points,case when nullif(trim(p_message),'') is null then '' else ' — '||left(trim(p_message),250) end),
       v_sender_name,v_sender_avatar,v_partner_name,v_partner_avatar,v_gift.icon_url);
  end if;

  return jsonb_build_object('success',true,'event_id',v_event_id,'gift_name',v_gift.name,
    'coins_spent',v_gift.price,'coins_remaining',v_balance,'points_added',v_gift.intimacy_points,
    'new_intimacy',v_new_intimacy,'new_level',v_new_level,'animation_url',v_gift.animation_url,
    'partner_name',v_partner_name);
end $$;

revoke all on function public.cp_send_exclusive_gift(text,text) from public,anon;
grant execute on function public.cp_send_exclusive_gift(text,text) to authenticated;

-- 5. Weekly champion history; one settlement per completed Saudi-local week.
create table if not exists public.cp_weekly_champion_rewards (
  id uuid primary key default gen_random_uuid(),
  relation_id uuid not null references public.cp_relations(id) on delete cascade,
  rank integer not null check (rank between 1 and 3),
  week_start_date date not null,
  intimacy_achieved bigint not null,
  reward_title text not null,
  settled_at timestamptz not null default now(),
  constraint cp_weekly_champion_relation_week_unique unique (relation_id,week_start_date),
  constraint cp_weekly_champion_rank_week_unique unique (rank,week_start_date)
);
alter table public.cp_weekly_champion_rewards enable row level security;
drop policy if exists cp_weekly_champion_participants_read on public.cp_weekly_champion_rewards;
create policy cp_weekly_champion_participants_read on public.cp_weekly_champion_rewards
  for select to authenticated using (
    exists (select 1 from public.cp_relations r where r.id=relation_id
      and (r.user1_id=(select auth.uid()) or r.user2_id=(select auth.uid())))
  );
revoke all on public.cp_weekly_champion_rewards from anon,authenticated;
grant select on public.cp_weekly_champion_rewards to authenticated;

create table if not exists public.cp_weekly_settlement_runs (
  week_start_date date primary key,
  settled_at timestamptz not null default now(),
  settled_couples integer not null default 0
);
alter table public.cp_weekly_settlement_runs enable row level security;
revoke all on public.cp_weekly_settlement_runs from anon,authenticated;

create or replace function public.cp_settle_weekly_leaderboard()
returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_this_week date := (date_trunc('week', (now() at time zone 'Asia/Riyadh') + interval '1 day') - interval '1 day')::date;
  v_last_week date := ((date_trunc('week', (now() at time zone 'Asia/Riyadh') + interval '1 day') - interval '1 day') - interval '7 days')::date;
  v_settled_count integer := 0;
  v_row record;
  v_title text;
begin
  -- Use the previous fully completed Monday-Sunday week, aligned with CP ranking's Riyadh timezone.
  perform pg_advisory_xact_lock(hashtextextended('cp-weekly-settlement:'||v_last_week::text,0));
  if exists(select 1 from public.cp_weekly_settlement_runs where week_start_date=v_last_week) then
    return jsonb_build_object('success',false,'message','Already settled for this week','week_start',v_last_week);
  end if;

  for v_row in
    with events as (
      select relation_id,intimacy,created_at from public.cp_intimacy_events
      union all
      select relation_id,intimacy,created_at from public.cp_exclusive_gift_events
    ), scores as (
      select r.id relation_id,coalesce(sum(e.intimacy),0)::bigint weekly_score
      from public.cp_relations r
      left join events e on e.relation_id=r.id
        and e.created_at >= (v_last_week::timestamp at time zone 'Asia/Riyadh')
        and e.created_at < (v_this_week::timestamp at time zone 'Asia/Riyadh')
      where r.status='active'
      group by r.id
    )
    select relation_id,weekly_score from scores
    where weekly_score > 0
    order by weekly_score desc,relation_id
    limit 3
  loop
    v_title := case v_settled_count
      when 0 then 'Grand Royal CP of the Week (Gold Ring Halo)'
      when 1 then 'Eternal Romance Duo (Silver Feather Halo)'
      else 'Sweet Harmony Duo (Bronze Blossom)'
    end;
    insert into public.cp_weekly_champion_rewards
      (relation_id,rank,week_start_date,intimacy_achieved,reward_title)
    values (v_row.relation_id,v_settled_count+1,v_last_week,v_row.weekly_score,v_title);
    v_settled_count := v_settled_count+1;
  end loop;

  insert into public.cp_weekly_settlement_runs(week_start_date,settled_couples)
  values(v_last_week,v_settled_count);

  return jsonb_build_object('success',true,'settled_couples',v_settled_count,'week_start',v_last_week);
end $$;

revoke all on function public.cp_settle_weekly_leaderboard() from public,anon,authenticated;
grant execute on function public.cp_settle_weekly_leaderboard() to service_role;

commit;
