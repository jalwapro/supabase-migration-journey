-- Harden manual recharge RPC: only signed-in users may submit a recharge request.
revoke all on function public.create_manual_recharge(uuid, public.pay_method, text, text, text) from public, anon;
grant execute on function public.create_manual_recharge(uuid, public.pay_method, text, text, text) to authenticated;
