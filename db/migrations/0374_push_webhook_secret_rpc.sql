-- Secure server-side RPC for push webhook authentication.
create or replace function public.get_push_webhook_secret_hash()
returns text
language sql
security definer
set search_path = public, private
as $$
  select secret_hash
  from private.push_webhook_config
  where id = true
  limit 1;
$$;

revoke all on function public.get_push_webhook_secret_hash() from public, anon, authenticated;
grant execute on function public.get_push_webhook_secret_hash() to service_role;
