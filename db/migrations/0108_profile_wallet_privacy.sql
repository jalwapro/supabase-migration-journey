-- Mask coins/diamonds from other users at the DB layer.
-- Public reads via profiles still allowed for cosmetic fields; a security-definer
-- RPC returns coins/diamonds only to owner or admins.

create or replace function public.get_profile_public(_id uuid)
returns table (
  id uuid,
  username text,
  full_name text,
  avatar text,
  frame text,
  ring text,
  bubble text,
  car text,
  entrance text,
  special_id text,
  data_card text,
  bio text,
  gender text,
  country text,
  coins bigint,
  diamonds bigint,
  level int,
  xp bigint,
  is_vip boolean,
  vip_level int,
  vip_expiry timestamptz,
  user_code text,
  last_seen timestamptz,
  created_at timestamptz,
  total_gifted_coins bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.full_name,
    p.avatar,
    p.frame,
    p.ring,
    p.bubble,
    p.car,
    p.entrance,
    p.special_id,
    p.data_card,
    p.bio,
    p.gender,
    p.country,
    case when p.id = auth.uid() or public.is_admin(auth.uid())
         then p.coins::bigint else 0::bigint end as coins,
    case when p.id = auth.uid() or public.is_admin(auth.uid())
         then p.diamonds::bigint else 0::bigint end as diamonds,
    p.level,
    p.xp::bigint,
    p.is_vip,
    p.vip_level,
    p.vip_expiry,
    p.user_code,
    p.last_seen,
    p.created_at,
    p.total_gifted_coins::bigint
  from public.profiles p
  where p.id = _id;
$$;

grant execute on function public.get_profile_public(uuid) to anon, authenticated;
