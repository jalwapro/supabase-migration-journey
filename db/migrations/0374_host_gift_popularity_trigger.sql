-- 0374 — Canonical gift -> host popularity accounting
-- Keep popularity accounting in the same transaction as send_gift().
-- Only gifts received by the room host affect host popularity.

create or replace function public.handle_gift_popularity_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host_id uuid;
  v_popularity_gain bigint := greatest(0, coalesce(new.diamonds_earned, 0));
begin
  if v_popularity_gain <= 0 or new.room_id is null or new.receiver_id is null then
    return new;
  end if;

  select lr.host_id
    into v_host_id
    from public.live_rooms lr
   where lr.id = new.room_id;

  -- A gift to a seated user is not host popularity.
  if v_host_id is null or v_host_id <> new.receiver_id then
    return new;
  end if;

  insert into public.host_popularity_stats (
    host_id,
    cumulative_popularity,
    gifts_power,
    updated_at
  )
  values (
    v_host_id,
    v_popularity_gain,
    v_popularity_gain,
    now()
  )
  on conflict (host_id) do update
  set cumulative_popularity = public.host_popularity_stats.cumulative_popularity + excluded.cumulative_popularity,
      gifts_power = public.host_popularity_stats.gifts_power + excluded.gifts_power,
      updated_at = now();

  return new;
end;
$$;

revoke execute on function public.handle_gift_popularity_update() from public;
revoke execute on function public.handle_gift_popularity_update() from anon;
revoke execute on function public.handle_gift_popularity_update() from authenticated;

drop trigger if exists trg_update_host_popularity on public.gift_sends;
create trigger trg_update_host_popularity
after insert on public.gift_sends
for each row
execute function public.handle_gift_popularity_update();

do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'host_popularity_stats'
  ) then
    execute 'alter publication supabase_realtime add table public.host_popularity_stats';
  end if;
  execute 'alter table public.host_popularity_stats replica identity full';
end $$;
