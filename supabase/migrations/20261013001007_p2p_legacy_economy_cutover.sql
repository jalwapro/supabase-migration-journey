-- Final cutover from legacy Coin Seller / Coin Agent balances to the
-- independent P2P Master-Agency wallets. Existing account/profile/history data
-- is retained; only balances and open legacy marketplace requests are reset.
begin;

-- Close legacy open requests first so their status/audit triggers can record
-- the closure. Completed historical records remain untouched.
update public.coin_agent_trades
set status='cancelled',
    cancelled_at=coalesce(cancelled_at,now()),
    payment_note=concat_ws(E'\n',nullif(payment_note,''),'Closed by P2P Master-Agency cutover'),
    updated_at=now()
where status not in ('completed','cancelled','rejected');

update public.p2p_orders
set status='cancelled',
    cancelled_at=coalesce(cancelled_at,now()),
    resolution_note=concat_ws(E'\n',nullif(resolution_note,''),'Closed by P2P Master-Agency cutover'),
    updated_at=now()
where status in ('pending','paid','appealed');

-- Keep seller/agent records and transaction history for audit, but remove
-- spendable stock from the retired marketplace.
update public.coin_seller_inventory
set available_coins=0, updated_at=now()
where available_coins<>0;

update public.coin_agent_balances
set available_diamonds=0, updated_at=now()
where available_diamonds<>0;

update public.coin_sellers
set is_active=false, is_listed=false, updated_at=now()
where is_active or is_listed;

-- The owner explicitly approved a zero-balance cutover. Write a transaction
-- history entry before resetting the legacy profile wallet values.
insert into public.wallet_transactions(
  user_id,kind,coins,diamonds,coins_delta,diamonds_delta,
  ref_type,note,balance_coins_after
)
select p.id,'p2p_cutover_reset',0,0,
       -coalesce(p.coins,0),-coalesce(p.diamonds,0),
       'p2p_cutover',
       'Legacy coin/diamond balances reset for P2P Master-Agency cutover',
       0
from public.profiles p
where coalesce(p.coins,0)<>0 or coalesce(p.diamonds,0)<>0;

-- Mark the change for the existing coin economy audit trigger, then zero both
-- legacy wallet balances. New P2P balances start at zero in p2p_wallets.
select set_config('app.coin_operation','p2p_cutover_reset',true);
update public.profiles
set coins=0, diamonds=0, updated_at=now()
where coalesce(coins,0)<>0 or coalesce(diamonds,0)<>0;

notify pgrst,'reload schema';
commit;
