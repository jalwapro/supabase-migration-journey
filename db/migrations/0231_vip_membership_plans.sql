-- VIP membership plans (1/3/6/9/12 months) + vip_only flag on shop items.

-- 1. Seed 5 VIP tiers (idempotent by name)
INSERT INTO public.vip_tiers (name, price, duration_days, level_boost, badge_emoji, perks, sort, is_active)
VALUES
  ('VIP 1 Month',   50000,  30, 1, '👑',
    'All VIP emojis · Exclusive VIP frames, themes, entrance, entry effect · VIP badge · Priority spotlight', 1, true),
  ('VIP 3 Months',  135000, 90, 2, '👑',
    'Everything in 1 Month · 10% bonus coins on top-ups · Exclusive VIP-only shop items', 2, true),
  ('VIP 6 Months',  240000, 180, 3, '💎',
    'Everything in 3 Months · Free monthly VIP frame · Custom entrance banner', 3, true),
  ('VIP 9 Months',  330000, 270, 4, '💎',
    'Everything in 6 Months · Personal VIP support · Rare seasonal skins', 4, true),
  ('VIP 12 Months', 400000, 365, 5, '🏆',
    'Everything · Lifetime badge upgrade · Free premium theme every month · Top-tier spotlight', 5, true)
ON CONFLICT DO NOTHING;

-- Some deployments may already have unique(name); ensure duplicates don't crash if run twice.
-- (No unique constraint by default, so guard manually.)
DELETE FROM public.vip_tiers a
  USING public.vip_tiers b
 WHERE a.ctid < b.ctid
   AND a.name = b.name;

-- 2. Add vip_only flag to shop items
ALTER TABLE public.themes    ADD COLUMN IF NOT EXISTS vip_only boolean NOT NULL DEFAULT false;
ALTER TABLE public.dp_frames ADD COLUMN IF NOT EXISTS vip_only boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_themes_vip_only    ON public.themes(vip_only)    WHERE vip_only;
CREATE INDEX IF NOT EXISTS idx_dp_frames_vip_only ON public.dp_frames(vip_only) WHERE vip_only;

-- 3. Enforce VIP-only in purchase_shop_item (both signatures)
CREATE OR REPLACE FUNCTION public.purchase_shop_item(_theme_id uuid, _currency text DEFAULT 'auto')
RETURNS public.user_themes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  _uid uuid := auth.uid();
  _t public.themes%rowtype;
  _cur text;
  _price int;
  _expires timestamptz;
  _row public.user_themes;
  _is_vip boolean;
begin
  if _uid is null then raise exception 'Sign in to buy'; end if;
  select * into _t from public.themes where id = _theme_id and is_active;
  if not found then raise exception 'Item not found'; end if;

  if _t.vip_only then
    select (is_vip and (vip_expiry is null or vip_expiry > now()))
      into _is_vip from public.profiles where id = _uid;
    if not coalesce(_is_vip, false) then
      raise exception 'VIP membership required to buy this item' using errcode = '42501';
    end if;
  end if;

  _cur := lower(coalesce(_currency, 'auto'));
  if _cur = 'auto' then
    _cur := case when _t.price_diamonds > 0 then 'diamonds' else 'coins' end;
  end if;

  if _cur = 'diamonds' then
    _price := _t.price_diamonds;
    if _price > 0 then
      update public.profiles set diamonds = diamonds - _price, updated_at = now()
        where id = _uid and diamonds >= _price;
      if not found then raise exception 'Not enough diamonds'; end if;
      insert into public.wallet_transactions (user_id, kind, diamonds_delta, ref_type, ref_id, note)
        values (_uid, 'shop_purchase', -_price, 'theme', _t.id, 'Bought ' || _t.name);
    end if;
  else
    _price := _t.price;
    if _price > 0 then
      update public.profiles set coins = coins - _price, updated_at = now()
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
    values (_uid, _theme_id, _expires, _t.price_diamonds)
    on conflict (user_id, theme_id) do update
      set expires_at = case
            when public.user_themes.expires_at is null then null
            when excluded.expires_at is null then null
            else greatest(public.user_themes.expires_at, now()) + (_t.duration_days || ' days')::interval
          end,
          purchased_price_diamonds = _t.price_diamonds
    returning * into _row;
  return _row;
end $$;

REVOKE ALL ON FUNCTION public.purchase_shop_item(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.purchase_shop_item(uuid, text) TO authenticated;
