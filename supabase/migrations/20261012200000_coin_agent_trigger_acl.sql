-- Trigger-only security-definer functions must never be directly callable through PostgREST.
revoke all on function public.guard_agent_profile_country() from public, anon, authenticated;
revoke all on function public.guard_agent_profile_active_status() from public, anon, authenticated;
revoke all on function public.enforce_p2p_order_country() from public, anon, authenticated;
revoke all on function public.enforce_coin_agent_trade_country() from public, anon, authenticated;
revoke all on function public.disable_agent_when_coin_seller_suspended() from public, anon, authenticated;
