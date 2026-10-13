-- Public CP badge metadata for authenticated room/chat UI plus automatic weekly settlement.
begin;

create or replace function public.cp_room_badges(p_user_ids uuid[])
returns table (
  user_id uuid,
  partner_id uuid,
  partner_username text,
  partner_avatar text,
  cp_level integer,
  cp_level_name text,
  badge_url text,
  intimacy_score bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_user_ids is null or cardinality(p_user_ids) = 0 then
    return;
  end if;

  return query
    select
      pair.user_id,
      partner.id,
      partner.username,
      partner.avatar,
      coalesce(level_config.level, relation.ring_level, 1),
      coalesce(level_config.name, 'Sweethearts'),
      level_config.badge_url,
      relation.intimacy_score
    from public.cp_relations relation
    cross join lateral (
      values
        (relation.user1_id, relation.user2_id),
        (relation.user2_id, relation.user1_id)
    ) as pair(user_id, partner_id)
    join public.profiles partner on partner.id = pair.partner_id
    left join lateral (
      select cfg.level, cfg.name, cfg.badge_url
      from public.cp_levels_config cfg
      where cfg.min_intimacy <= relation.intimacy_score
      order by cfg.min_intimacy desc
      limit 1
    ) level_config on true
    where relation.status = 'active'
      and pair.user_id = any(p_user_ids);
end;
$$;

revoke all on function public.cp_room_badges(uuid[]) from public, anon;
grant execute on function public.cp_room_badges(uuid[]) to authenticated;

-- Run shortly after midnight Monday in Riyadh (Sunday 21:05 UTC).
-- The function settles the previous fully completed Monday-Sunday week and is idempotent.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'cp-weekly-settlement';
    perform cron.schedule(
      'cp-weekly-settlement',
      '5 21 * * 0',
      'select public.cp_settle_weekly_leaderboard();'
    );
  end if;
end $$;

commit;
