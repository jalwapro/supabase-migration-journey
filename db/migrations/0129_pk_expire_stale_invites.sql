-- =============================================================
-- Auto-expire stale PK invites
-- - RPC any authenticated user can call to sweep expired 'pending' invites
-- - Trigger on insert also sweeps stale rows so a fresh challenge always
--   arrives on a clean slate
-- =============================================================

create or replace function public.pk_expire_stale_invites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.pk_invites
     set status = 'expired'
   where status = 'pending'
     and expires_at < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.pk_expire_stale_invites() to authenticated;

-- Sweep on every new invite insert so stale rows never accumulate.
create or replace function public.pk_invites_sweep_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pk_invites
     set status = 'expired'
   where status = 'pending'
     and expires_at < now();
  return new;
end;
$$;

drop trigger if exists trg_pk_invites_sweep on public.pk_invites;
create trigger trg_pk_invites_sweep
  before insert on public.pk_invites
  for each row execute function public.pk_invites_sweep_trg();
