-- Allow admins and super_admins to manage cp_exclusive_gifts_config
begin;

grant select, insert, update, delete on public.cp_exclusive_gifts_config to authenticated;

drop policy if exists cp_exclusive_gifts_admin_write on public.cp_exclusive_gifts_config;
create policy cp_exclusive_gifts_admin_write on public.cp_exclusive_gifts_config
  for all to authenticated
  using (
    public.has_role(auth.uid(), 'admin'::public.app_role) or 
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
  with check (
    public.has_role(auth.uid(), 'admin'::public.app_role) or 
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

-- Also allow admins to view all gifts (even inactive ones)
drop policy if exists cp_exclusive_gifts_admin_read_all on public.cp_exclusive_gifts_config;
create policy cp_exclusive_gifts_admin_read_all on public.cp_exclusive_gifts_config
  for select to authenticated
  using (
    is_active = true or
    public.has_role(auth.uid(), 'admin'::public.app_role) or 
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

commit;
