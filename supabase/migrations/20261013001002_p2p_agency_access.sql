-- Least-privilege read access needed by the settlement UI.
begin;
drop policy if exists p2p_super_agent_read_admin_directory on public.p2p_profiles;
create policy p2p_super_agent_read_admin_directory on public.p2p_profiles
for select to authenticated
using(role='admin' and active=true and (select p2p_private.current_role())='super_agent');
commit;
