-- Weekly ranking must count both qualifying romantic gifts and exclusive CP gifts.
create or replace function public.cp_weekly_ranking()
returns table(
  rank bigint,
  relation_id uuid,
  user1_id uuid,
  user2_id uuid,
  weekly_intimacy bigint,
  total_intimacy bigint,
  level integer
)
language sql stable security definer
set search_path=public,pg_temp
as $$
  with week_start as (
    select (date_trunc('week',(now() at time zone 'Asia/Riyadh')+interval '1 day')-interval '1 day')
      at time zone 'Asia/Riyadh' as start_at
  ), events as (
    select relation_id,intimacy,created_at from public.cp_intimacy_events
    union all
    select relation_id,intimacy,created_at from public.cp_exclusive_gift_events
  ), scores as (
    select r.id,r.user1_id,r.user2_id,r.intimacy_score,r.ring_level,
      coalesce(sum(e.intimacy) filter(where e.created_at>=w.start_at),0)::bigint as weekly
    from public.cp_relations r
    cross join week_start w
    left join events e on e.relation_id=r.id
    where r.status='active'
    group by r.id,r.user1_id,r.user2_id,r.intimacy_score,r.ring_level
  )
  select row_number() over(order by weekly desc,intimacy_score desc,id)::bigint,
    id,user1_id,user2_id,weekly,intimacy_score,ring_level
  from scores
  order by weekly desc,intimacy_score desc,id
  limit 100
$$;
revoke all on function public.cp_weekly_ranking() from public,anon;
grant execute on function public.cp_weekly_ranking() to authenticated;
