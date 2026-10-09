-- Store city and ISO country code, never exact GPS coordinates.
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists country_code text;

-- The result columns changed, so drop and recreate the existing RPC.
drop function if exists public.get_profile_public(uuid);
create function public.get_profile_public(_id uuid)
returns table (
  id uuid, username text, full_name text, avatar text, frame text, ring text,
  bubble text, car text, entrance text, special_id text, data_card text, bio text,
  gender text, country text, country_code text, city text,
  coins bigint, diamonds bigint, level int, xp bigint, is_vip boolean,
  vip_level int, vip_expiry timestamptz, user_code text, last_seen timestamptz,
  created_at timestamptz, total_gifted_coins bigint
)
language sql stable security definer set search_path = public
as $$
  select p.id, p.username, p.full_name, p.avatar, p.frame, p.ring, p.bubble,
    p.car, p.entrance, p.special_id, p.data_card, p.bio, p.gender, p.country,
    p.country_code, p.city,
    case when p.id = auth.uid() or public.is_admin(auth.uid()) then p.coins::bigint else 0::bigint end,
    case when p.id = auth.uid() or public.is_admin(auth.uid()) then p.diamonds::bigint else 0::bigint end,
    p.level, p.xp::bigint, p.is_vip, p.vip_level, p.vip_expiry, p.user_code,
    p.last_seen, p.created_at, p.total_gifted_coins::bigint
  from public.profiles p where p.id = _id;
$$;
grant execute on function public.get_profile_public(uuid) to anon, authenticated;
