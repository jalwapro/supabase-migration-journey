-- Admin hard-delete for a Coin Seller assignment.
-- Removes seller-only transaction history and stock with the seller row.
create or replace function public.admin_delete_coin_seller(p_seller_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_seller_id is null then
    raise exception 'Seller id is required';
  end if;
  if not exists (select 1 from public.coin_sellers where user_id = p_seller_id) then
    raise exception 'Coin seller not found';
  end if;

  delete from public.coin_seller_transactions where seller_id = p_seller_id;
  delete from public.coin_seller_inventory where seller_id = p_seller_id;
  delete from public.coin_sellers where user_id = p_seller_id;
end;
$$;

revoke all on function public.admin_delete_coin_seller(uuid) from public, anon;
grant execute on function public.admin_delete_coin_seller(uuid) to authenticated;
