-- =============================================================
-- 0107: PK Pro System
-- - Winner reward (500 coins) + wallet log
-- - Room broadcast (system message) with winner announcement
-- - Notifications to both hosts
-- - pk_champions table: 10-win hosts pending admin approval
-- - Auto-banner (24h) when admin approves champion
-- - banners.expires_at column so auto-banners self-expire
-- =============================================================

-- 0) Extend notification_kind enum for PK events
alter type public.notification_kind add value if not exists 'pk_win';
alter type public.notification_kind add value if not exists 'pk_loss';
alter type public.notification_kind add value if not exists 'pk_draw';
alter type public.notification_kind add value if not exists 'pk_champion_pending';
alter type public.notification_kind add value if not exists 'pk_champion_banner';

-- 1) banners.expires_at (auto-expire) ---------------------------
alter table public.banners
  add column if not exists expires_at timestamptz;

create index if not exists idx_banners_active_exp
  on public.banners(active, expires_at)
  where active = true;

-- 2) pk_champions: pending admin-approved auto-banner entries ---
create table if not exists public.pk_champions (
  id                uuid primary key default gen_random_uuid(),
  host_id           uuid not null references auth.users(id) on delete cascade,
  wins_total        int  not null,
  reached_at        timestamptz not null default now(),
  approved          boolean not null default false,
  approved_at       timestamptz,
  approved_by       uuid references auth.users(id) on delete set null,
  banner_id         uuid references public.banners(id) on delete set null,
  banner_expires_at timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists idx_pk_champions_pending
  on public.pk_champions(approved, reached_at desc);
create index if not exists idx_pk_champions_host
  on public.pk_champions(host_id, reached_at desc);

grant select on public.pk_champions to authenticated;
grant all    on public.pk_champions to service_role;

alter table public.pk_champions enable row level security;

drop policy if exists "pk champions self read" on public.pk_champions;
create policy "pk champions self read"
  on public.pk_champions for select to authenticated
  using (auth.uid() = host_id or public.has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "pk champions admin write" on public.pk_champions;
create policy "pk champions admin write"
  on public.pk_champions for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) Rewrite pk_end_match: reward winner + broadcast + notify + champion detect
create or replace function public.pk_end_match(_match_id uuid)
returns public.pk_matches
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  m  public.pk_matches;
  s  record;
  win uuid;
  loser uuid;
  winner_name text;
  loser_name text;
  wins_after int;
  reward int := 500;
begin
  select * into m from public.pk_matches where id = _match_id for update;
  if m.id is null then raise exception 'match not found'; end if;
  if m.status <> 'active' then return m; end if;

  if me is not null and me <> m.host_a and me <> m.host_b then
    if not public.has_role(me, 'admin'::app_role) then
      raise exception 'not a participant';
    end if;
  end if;

  select score_a, score_b into s from public.pk_match_score(m.id);
  win := case
    when s.score_a > s.score_b then m.host_a
    when s.score_b > s.score_a then m.host_b
    else null
  end;
  loser := case when win = m.host_a then m.host_b when win = m.host_b then m.host_a else null end;

  update public.pk_matches
     set status = 'ended', ended_at = now(),
         score_a = s.score_a, score_b = s.score_b,
         winner_id = win
   where id = m.id
  returning * into m;

  update public.live_rooms set active_pk_match_id = null
   where id in (m.room_a, m.room_b) and active_pk_match_id = m.id;

  -- history rows for both hosts (best-effort, keep existing structure)
  begin
    insert into public.pk_battles(host_id, room_id, room_title, my_score, opponent_name, opponent_score, result, started_at, ended_at)
    select m.host_a, m.room_a,
           coalesce((select title from public.live_rooms where id = m.room_a), 'PK Battle'),
           s.score_a,
           coalesce((select username from public.profiles where id = m.host_b), 'Opponent'),
           s.score_b,
           case when win = m.host_a then 'win' when win = m.host_b then 'loss' else 'draw' end,
           m.started_at, m.ended_at
    union all
    select m.host_b, m.room_b,
           coalesce((select title from public.live_rooms where id = m.room_b), 'PK Battle'),
           s.score_b,
           coalesce((select username from public.profiles where id = m.host_a), 'Opponent'),
           s.score_a,
           case when win = m.host_b then 'win' when win = m.host_a then 'loss' else 'draw' end,
           m.started_at, m.ended_at;
  exception when others then null;
  end;

  -- Lookup names for broadcast
  select username into winner_name from public.profiles where id = win;
  select username into loser_name  from public.profiles where id = loser;

  -- Reward winner: +500 coins + wallet log
  if win is not null then
    update public.profiles set coins = coalesce(coins,0) + reward, updated_at = now() where id = win;
    begin
      insert into public.wallet_transactions(user_id, kind, coins, note)
      values (win, 'pk_win_reward', reward, 'PK Match victory bonus');
    exception when others then null;
    end;
  end if;

  -- Broadcast winner into both rooms (system message)
  begin
    insert into public.room_messages(room_id, user_id, kind, text)
    select rid, coalesce(win, m.host_a), 'system'::public.message_kind,
      case
        when win is null then '🤝 PK Match ended in a draw!'
        else '🏆 @' || coalesce(winner_name,'host') || ' won the PK Match vs @' || coalesce(loser_name,'host') || '!'
      end
    from (values (m.room_a), (m.room_b)) as t(rid);
  exception when others then null;
  end;

  -- Notifications for both hosts
  begin
    if win is not null then
      insert into public.notifications(user_id, kind, title, body, data)
      values
        (win,   'pk_win',  '🏆 PK Victory!', 'You defeated @'||coalesce(loser_name,'opponent')||' (+'||reward||' coins)', jsonb_build_object('match_id', m.id)),
        (loser, 'pk_loss', 'PK Match ended', '@'||coalesce(winner_name,'host')||' won this round. Rematch?',           jsonb_build_object('match_id', m.id));
    else
      insert into public.notifications(user_id, kind, title, body, data)
      values
        (m.host_a, 'pk_draw', 'PK Draw', 'The match ended in a draw', jsonb_build_object('match_id', m.id)),
        (m.host_b, 'pk_draw', 'PK Draw', 'The match ended in a draw', jsonb_build_object('match_id', m.id));
    end if;
  exception when others then null;
  end;

  -- 10-win milestone: enqueue for admin approval
  if win is not null then
    select count(*) into wins_after from public.pk_battles where host_id = win and result = 'win';
    if wins_after > 0 and wins_after % 10 = 0 then
      -- Only insert if no unapproved champion row exists in last 24h for this host+count
      if not exists (
        select 1 from public.pk_champions
         where host_id = win and wins_total = wins_after
      ) then
        insert into public.pk_champions(host_id, wins_total) values (win, wins_after);
        begin
          insert into public.notifications(user_id, kind, title, body, data)
          select p.user_id, 'pk_champion_pending', '⭐ New PK Champion',
                 '@'||coalesce(winner_name,'host')||' hit '||wins_after||' PK wins — review for banner',
                 jsonb_build_object('host_id', win, 'wins', wins_after)
          from public.user_roles p
          where p.role = 'admin'::app_role;
        exception when others then null;
        end;
      end if;
    end if;
  end if;

  return m;
end;
$$;

grant execute on function public.pk_end_match(uuid) to authenticated;

-- 4) Admin approves champion → creates 24h banner ---------------
create or replace function public.pk_champion_approve(_champion_id uuid)
returns public.pk_champions
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  c  public.pk_champions;
  host_profile record;
  b_id uuid;
  b_expires timestamptz := now() + interval '24 hours';
  image_url text;
  link_url text;
begin
  if me is null or not public.has_role(me, 'admin'::app_role) then
    raise exception 'admin required';
  end if;

  select * into c from public.pk_champions where id = _champion_id for update;
  if c.id is null then raise exception 'champion not found'; end if;
  if c.approved then return c; end if;

  select id, username, avatar into host_profile
    from public.profiles where id = c.host_id;

  image_url := coalesce(host_profile.avatar, '');
  link_url  := '/profile/' || c.host_id::text;

  insert into public.banners(image, image_url, title, subtitle, cta_text, link, link_url, active, is_active, sort_order, expires_at)
  values (
    image_url, image_url,
    '🏆 PK Champion',
    '@' || coalesce(host_profile.username, 'host') || ' — '||c.wins_total||' PK wins',
    'View Profile',
    link_url, link_url,
    true, true, 0, b_expires
  )
  returning id into b_id;

  update public.pk_champions
     set approved = true,
         approved_at = now(),
         approved_by = me,
         banner_id = b_id,
         banner_expires_at = b_expires
   where id = c.id
  returning * into c;

  -- Notify the host
  begin
    insert into public.notifications(user_id, kind, title, body, data)
    values (c.host_id, 'pk_champion_banner', '🎉 You are on the home banner!',
            'Your PK Champion banner is live for 24 hours', jsonb_build_object('banner_id', b_id));
  exception when others then null;
  end;

  return c;
end;
$$;

grant execute on function public.pk_champion_approve(uuid) to authenticated;

-- 5) Admin rejects (just marks approved=true w/o banner so it disappears)
create or replace function public.pk_champion_reject(_champion_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'admin required';
  end if;
  update public.pk_champions
     set approved = true, approved_at = now(), approved_by = auth.uid()
   where id = _champion_id and approved = false;
end;
$$;

grant execute on function public.pk_champion_reject(uuid) to authenticated;

-- 6) Cleanup: cron-friendly function to deactivate expired banners
create or replace function public.banners_expire_sweep()
returns int
language sql
security definer
set search_path = public
as $$
  with upd as (
    update public.banners
       set active = false, is_active = false
     where active = true and expires_at is not null and expires_at < now()
     returning 1
  ) select count(*)::int from upd;
$$;

grant execute on function public.banners_expire_sweep() to authenticated;

-- 7) Realtime for pk_champions + banners (admin dashboard live updates)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='pk_champions') then
    execute 'alter publication supabase_realtime add table public.pk_champions';
  end if;
end$$;
alter table public.pk_champions replica identity full;
