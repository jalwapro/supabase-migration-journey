-- ============================================================================
-- Dual-currency shop: every shop item can be bought with coins OR diamonds.
-- Backfills missing prices for existing items and extends purchase_shop_item
-- with a _currency parameter.
-- ============================================================================

-- Coins <-> diamonds conversion used to backfill missing prices.
-- Roughly: 1 diamond ~= 10 coins.

-- Backfill diamond prices where only coin price is set
update public.themes
   set price_diamonds = greatest(1, round(price / 10.0))
 where price > 0 and price_diamonds = 0;

-- Backfill coin prices where only diamond price is set
update public.themes
   set price = greatest(1, price_diamonds * 10)
 where price_diamonds > 0 and price = 0;

-- Extended RPC with currency choice
create or replace function public.purchase_shop_item(_theme_id uuid, _currency text default 'auto')
returns public.user_themes
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _t public.themes%rowtype;
  _cur text;
  _price int;
  _expires timestamptz;
  _row public.user_themes;
begin
  if _uid is null then raise exception 'Sign in to buy'; end if;
  select * into _t from public.themes where id = _theme_id and is_active;
  if not found then raise exception 'Item not found'; end if;

  _cur := lower(coalesce(_currency, 'auto'));
  if _cur = 'auto' then
    _cur := case when _t.price_diamonds > 0 then 'diamonds' else 'coins' end;
  end if;
  if _cur not in ('coins','diamonds') then
    raise exception 'Invalid currency';
  end if;

  _price := case when _cur = 'diamonds' then _t.price_diamonds else _t.price end;
  if _price < 0 then raise exception 'Invalid price'; end if;

  if _price > 0 then
    if _cur = 'diamonds' then
      update public.profiles
         set diamonds = diamonds - _price, updated_at = now()
       where id = _uid and diamonds >= _price;
      if not found then raise exception 'Not enough diamonds'; end if;
      insert into public.wallet_transactions (user_id, kind, diamonds_delta, ref_type, ref_id, note)
        values (_uid, 'shop_purchase', -_price, 'theme', _t.id, 'Bought ' || _t.name);
    else
      update public.profiles
         set coins = coins - _price, updated_at = now()
       where id = _uid and coins >= _price;
      if not found then raise exception 'Not enough coins'; end if;
      insert into public.wallet_transactions (user_id, kind, coins_delta, ref_type, ref_id, note)
        values (_uid, 'shop_purchase', -_price, 'theme', _t.id, 'Bought ' || _t.name);
    end if;
  end if;

  if _t.duration_days is not null and _t.duration_days > 0 then
    _expires := now() + (_t.duration_days || ' days')::interval;
  else
    _expires := null;
  end if;

  insert into public.user_themes (user_id, theme_id, expires_at, purchased_price_diamonds)
    values (_uid, _theme_id, _expires,
            case when _cur = 'diamonds' then _price else 0 end)
    on conflict (user_id, theme_id) do update
      set expires_at = case
            when public.user_themes.expires_at is null then null
            when excluded.expires_at is null then null
            else greatest(public.user_themes.expires_at, now()) + (_t.duration_days || ' days')::interval
          end,
          purchased_price_diamonds = case when _cur = 'diamonds' then _price else public.user_themes.purchased_price_diamonds end
    returning * into _row;

  return _row;
end $$;

grant execute on function public.purchase_shop_item(uuid, text) to authenticated;
-- keep the old single-arg overload working
grant execute on function public.purchase_shop_item(uuid) to authenticated;
