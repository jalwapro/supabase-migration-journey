-- Agent storefront for the new Master-Agency model.
-- Buyers contact the selected Sub-Agent externally; only the Sub-Agent's P2P
-- coin inventory transfer RPC moves coins after payment is confirmed.
begin;

create table public.p2p_agent_listings (
  user_id uuid primary key references public.p2p_profiles(user_id) on delete restrict,
  country_code text not null check(country_code ~ '^[A-Z]{2}$'),
  currency_code text not null check(currency_code ~ '^[A-Z]{3}$'),
  whatsapp_number text not null check(length(regexp_replace(whatsapp_number,'[^0-9]','','g')) between 8 and 16),
  sell_price_per_1000 numeric(20,2) not null check(sell_price_per_1000>0),
  listed boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.p2p_agent_listings enable row level security;
revoke all on public.p2p_agent_listings from anon,authenticated;
grant select on public.p2p_agent_listings to authenticated;

create policy p2p_marketplace_read_listed_agents on public.p2p_agent_listings
for select to authenticated
using (
  listed=true
  and exists (
    select 1 from public.p2p_profiles a
    join public.p2p_profiles s on s.user_id=a.super_agent_id
    where a.user_id=p2p_agent_listings.user_id
      and a.role='sub_agent' and a.active=true
      and s.role='super_agent' and s.active=true
  )
);
create policy p2p_agent_read_own_listing on public.p2p_agent_listings
for select to authenticated using(user_id=(select auth.uid()));
create policy p2p_admin_read_agent_listings on public.p2p_agent_listings
for select to authenticated using((select p2p_private.current_role())='admin');

create or replace function public.p2p_agent_save_listing(
  p_country_code text,
  p_currency_code text,
  p_whatsapp_number text,
  p_sell_price_per_1000 numeric,
  p_listed boolean
) returns void
language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_phone text;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if (select p2p_private.current_role()) is distinct from 'sub_agent' then
    raise exception 'ACTIVE_SUB_AGENT_REQUIRED';
  end if;
  if not exists(
    select 1 from public.p2p_profiles a join public.p2p_profiles s on s.user_id=a.super_agent_id
    where a.user_id=v_actor and a.role='sub_agent' and a.active and s.role='super_agent' and s.active
  ) then raise exception 'AGENCY_INACTIVE'; end if;
  if coalesce(p_country_code,'') !~ '^[A-Za-z]{2}$'
    or coalesce(p_currency_code,'') !~ '^[A-Za-z]{3}$'
    or p_sell_price_per_1000 is null or p_sell_price_per_1000<=0
    or p_listed is null then raise exception 'INVALID_LISTING'; end if;
  v_phone:=regexp_replace(coalesce(p_whatsapp_number,''),'[^0-9]','','g');
  if length(v_phone) not between 8 and 16 then raise exception 'VALID_WHATSAPP_REQUIRED'; end if;
  if not exists(select 1 from public.p2p_exchange_rates where currency_code=upper(p_currency_code) and active)
    or not exists(select 1 from public.p2p_exchange_rates where currency_code='PKR' and active) then
    raise exception 'AGENT_CURRENCY_RATE_UNAVAILABLE';
  end if;
  insert into public.p2p_agent_listings(user_id,country_code,currency_code,whatsapp_number,sell_price_per_1000,listed,updated_at)
  values(v_actor,upper(p_country_code),upper(p_currency_code),v_phone,p_sell_price_per_1000,p_listed,now())
  on conflict(user_id) do update set country_code=excluded.country_code,currency_code=excluded.currency_code,
    whatsapp_number=excluded.whatsapp_number,sell_price_per_1000=excluded.sell_price_per_1000,
    listed=excluded.listed,updated_at=now();
end $$;
revoke all on function public.p2p_agent_save_listing(text,text,text,numeric,boolean) from public,anon;
grant execute on function public.p2p_agent_save_listing(text,text,text,numeric,boolean) to authenticated;

commit;
