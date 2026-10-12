create table if not exists public.coin_agent_user_ledger (
 id uuid primary key default gen_random_uuid(),
 trade_id uuid not null references public.coin_agent_trades(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete restrict,
 source_type text not null check(source_type in ('profile_diamonds','red_diamonds')),
 entry_type text not null check(entry_type in ('diamond_hold','payout_confirmed','diamond_refund')),
 diamond_delta bigint not null,
 balance_after bigint not null check(balance_after>=0),
 note text not null,
 created_at timestamptz not null default now()
);
create unique index if not exists coin_agent_user_ledger_trade_entry on public.coin_agent_user_ledger(trade_id,entry_type);
create index if not exists coin_agent_user_ledger_user on public.coin_agent_user_ledger(user_id,created_at desc);
alter table public.coin_agent_user_ledger enable row level security;
revoke all on public.coin_agent_user_ledger from anon,authenticated;
grant select on public.coin_agent_user_ledger to authenticated;

create or replace function public.coin_agent_user_ledger_trigger()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_balance bigint;
begin
 if tg_op='INSERT' then
  if new.source_type='profile_diamonds' then select diamonds into v_balance from public.profiles where id=new.user_id;
  else select red_diamonds into v_balance from public.host_popularity_stats where host_id=new.user_id; end if;
  insert into public.coin_agent_user_ledger(trade_id,user_id,source_type,entry_type,diamond_delta,balance_after,note)
   values(new.id,new.user_id,new.source_type,'diamond_hold',-new.diamonds,greatest(coalesce(v_balance,0),0),'Diamonds held for Coin Agent payout trade');
  return new;
 elsif tg_op='UPDATE' and new.status is distinct from old.status then
  if new.status='completed' then
   if new.source_type='profile_diamonds' then select diamonds into v_balance from public.profiles where id=new.user_id;
   else select red_diamonds into v_balance from public.host_popularity_stats where host_id=new.user_id; end if;
   insert into public.coin_agent_user_ledger(trade_id,user_id,source_type,entry_type,diamond_delta,balance_after,note)
    values(new.id,new.user_id,new.source_type,'payout_confirmed',0,greatest(coalesce(v_balance,0),0),'User confirmed receipt of agent payout') on conflict(trade_id,entry_type) do nothing;
  elsif new.status='cancelled' then
   if new.source_type='profile_diamonds' then select diamonds into v_balance from public.profiles where id=new.user_id;
   else select red_diamonds into v_balance from public.host_popularity_stats where host_id=new.user_id; end if;
   insert into public.coin_agent_user_ledger(trade_id,user_id,source_type,entry_type,diamond_delta,balance_after,note)
    values(new.id,new.user_id,new.source_type,'diamond_refund',new.diamonds,greatest(coalesce(v_balance,0),0),'Cancelled trade refunded held diamonds') on conflict(trade_id,entry_type) do nothing;
  end if;
  return new;
 end if;
 return new;
end;
$$;
drop trigger if exists coin_agent_user_ledger_after_trade_insert on public.coin_agent_trades;
create trigger coin_agent_user_ledger_after_trade_insert after insert on public.coin_agent_trades for each row execute function public.coin_agent_user_ledger_trigger();
drop trigger if exists coin_agent_user_ledger_after_trade_update on public.coin_agent_trades;
create trigger coin_agent_user_ledger_after_trade_update after update of status on public.coin_agent_trades for each row execute function public.coin_agent_user_ledger_trigger();
