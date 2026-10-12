-- Authenticated agent order inbox, used by the unified Coin Agent workspace.
create or replace function public.p2p_agent_orders_for_user(actor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.agent_profiles a join public.coin_sellers cs on cs.user_id=a.user_id
    where a.user_id=actor_id and a.coin_agent_enabled and a.is_active and not a.is_banned and cs.is_active) then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(o) order by o.created_at desc)
    from public.p2p_orders o where o.agent_id=actor_id
  ),'[]'::jsonb);
end;
$$;
revoke all on function public.p2p_agent_orders_for_user(uuid) from public,anon,authenticated;
grant execute on function public.p2p_agent_orders_for_user(uuid) to service_role;
