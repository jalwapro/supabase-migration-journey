create unique index if not exists uq_recharge_orders_gateway_txn_ref on public.recharge_orders (gateway_provider, gateway_transaction_ref) where gateway_provider is not null and gateway_transaction_ref is not null;

create or replace function public.gateway_credit_recharge_by_ref(_provider text,_order_ref text,_provider_txn text,_status text,_amount_pkr numeric,_raw jsonb default '{}'::jsonb) returns table(success boolean,message text,new_balance bigint) language plpgsql security definer set search_path=public as $$
declare o public.recharge_orders%rowtype; b bigint; v_provider text:=lower(trim(coalesce(_provider,''))); v_order_ref text:=trim(coalesce(_order_ref,'')); v_txn text:=trim(coalesce(_provider_txn,'')); v_status text:=upper(trim(coalesce(_status,'')));
begin
if v_provider not in ('jazzcash','easypaisa') or v_order_ref='' then return query select false,'Invalid gateway callback'::text,0::bigint; return; end if;
select * into o from public.recharge_orders where gateway_provider=v_provider and gateway_order_ref=v_order_ref for update;
if not found then return query select false,'Recharge order not found'::text,0::bigint; return; end if;
if o.status='completed' then select coins into b from public.profiles where id=o.user_id; return query select true,'Already credited'::text,coalesce(b,0); return; end if;
if v_status not in ('SUCCESS','PAID') then update public.recharge_orders set gateway_status=lower(v_status),gateway_payload=coalesce(_raw,'{}'::jsonb),status=case when v_status in ('FAILED','FAILURE','CANCELLED','EXPIRED','REVERSED','BLOCKED') then 'failed'::public.recharge_order_status else status end where id=o.id; return query select false,('Payment status: '||v_status)::text,0::bigint; return; end if;
if v_txn='' then return query select false,'Missing provider transaction reference'::text,0::bigint; return; end if;
if _amount_pkr is null or _amount_pkr<>o.amount_pkr then return query select false,'Payment amount mismatch'::text,0::bigint; return; end if;
if exists(select 1 from public.recharge_orders x where x.gateway_provider=v_provider and x.gateway_transaction_ref=v_txn and x.id<>o.id) then return query select false,'Provider transaction already used'::text,0::bigint; return; end if;
update public.recharge_orders set gateway_transaction_ref=v_txn,gateway_status='success',gateway_payload=coalesce(_raw,'{}'::jsonb) where id=o.id;
update public.profiles set coins=coins+o.coins_total,updated_at=now() where id=o.user_id returning coins into b;
if b is null then raise exception 'Profile not found'; end if;
update public.recharge_orders set status='completed',completed_at=now() where id=o.id;
insert into public.wallet_transactions(user_id,kind,coins_delta,balance_coins_after,ref_type,ref_id,note) values(o.user_id,'recharge',o.coins_total, b, case when v_provider='easypaisa' then 'easypaisa_ipn' else 'jazzcash_ipn' end,o.id,case when v_provider='easypaisa' then 'Recharge via Easypaisa (verified)' else 'Recharge via JazzCash (verified IPN)' end);
return query select true,'Payment confirmed and coins credited'::text,b;
end; $$;
revoke all on function public.gateway_credit_recharge_by_ref(text,text,text,text,numeric,jsonb) from public,anon,authenticated;
grant execute on function public.gateway_credit_recharge_by_ref(text,text,text,text,numeric,jsonb) to service_role;
