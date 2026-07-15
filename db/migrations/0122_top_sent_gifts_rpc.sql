-- Top-N most-sent gifts RPC used by scripts/cache-top-gifts.mjs to
-- pre-download the hottest gift clips into public/gifts/ for
-- instant, TikTok-smooth playback (no cold-cache first-hit stall).
--
-- Read-only aggregate — safe to expose to anon so the caching
-- script can run with just the publishable key.

create or replace function public.get_top_sent_gifts(limit_n int default 20)
returns table (
  gift_id     uuid,
  name        text,
  emoji       text,
  clip_path   text,
  clip_type   text,
  image_url   text,
  sends       bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    g.id           as gift_id,
    g.name,
    g.emoji,
    g.clip_path,
    g.clip_type,
    g.image_url,
    count(gs.id)   as sends
  from public.gifts g
  join public.gift_sends gs on gs.gift_id = g.id
  group by g.id
  order by count(gs.id) desc, g.name asc
  limit greatest(1, least(coalesce(limit_n, 20), 100))
$$;

grant execute on function public.get_top_sent_gifts(int) to anon, authenticated, service_role;
