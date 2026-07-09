-- ============================================================================
-- Daily host "love" heart: viewer sends 100 coins to host once per 24h.
-- Client shows a black heart (available) → red blink on tap → dim/disabled
-- until 24h elapsed since the last insert.
-- ============================================================================

create table if not exists public.host_love_hearts (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users(id) on delete cascade,
  to_host   uuid not null references auth.users(id) on delete cascade,
  coins_spent int not null default 100,
  created_at timestamptz not null default now()
);

create index if not exists idx_host_love_from_to_time
  on public.host_love_hearts(from_user, to_host, created_at desc);
create index if not exists idx_host_love_host_time
  on public.host_love_hearts(to_host, created_at desc);

grant select, insert on public.host_love_hearts to authenticated;
grant all on public.host_love_hearts to service_role;

alter table public.host_love_hearts enable row level security;

drop policy if exists "love read self or host" on public.host_love_hearts;
create policy "love read self or host"
  on public.host_love_hearts for select to authenticated
  using (from_user = auth.uid() or to_host = auth.uid());

drop policy if exists "love insert self" on public.host_love_hearts;
create policy "love insert self"
  on public.host_love_hearts for insert to authenticated
  with check (from_user = auth.uid());

-- RPC: charge 100 coins, credit host, log heart. Errors on cooldown / broke.
create or replace function public.send_host_love(_host uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  last_at timestamptz;
  cost int := 100;
begin
  if me is null then
    raise exception 'auth required';
  end if;
  if me = _host then
    raise exception 'cannot love yourself';
  end if;

  select max(created_at) into last_at
    from public.host_love_hearts
    where from_user = me and to_host = _host;

  if last_at is not null and last_at > now() - interval '24 hours' then
    raise exception 'cooldown' using hint = to_char(last_at + interval '24 hours', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  end if;

  update public.profiles
     set coins = coins - cost
   where id = me and coins >= cost;
  if not found then
    raise exception 'insufficient coins';
  end if;

  update public.profiles
     set diamonds = diamonds + 1
   where id = _host;

  insert into public.host_love_hearts(from_user, to_host, coins_spent)
  values (me, _host, cost);

  return now() + interval '24 hours';
end;
$$;

grant execute on function public.send_host_love(uuid) to authenticated;
