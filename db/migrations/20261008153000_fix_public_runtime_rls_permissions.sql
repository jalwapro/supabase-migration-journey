-- Fix anonymous cold-start 42501 errors on public runtime content.
--
-- Admin authorization stays authenticated-only. Anonymous users already have
-- dedicated read policies for public banners; they must never evaluate the
-- SECURITY DEFINER is_admin() function.

drop policy if exists "Admins manage banners" on public.banners;
create policy "Admins manage banners"
  on public.banners
  as permissive
  for all
  to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

grant select on table public.banners to anon, authenticated;

grant select on table public.app_customization_pages to anon, authenticated;
drop policy if exists "Public reads enabled published customization pages" on public.app_customization_pages;
create policy "Public reads enabled published customization pages"
  on public.app_customization_pages
  as permissive
  for select
  to anon, authenticated
  using (is_enabled = true and status = 'published');

grant select on table public.app_customization_published to anon, authenticated;
drop policy if exists "Public reads current published customization" on public.app_customization_published;
create policy "Public reads current published customization"
  on public.app_customization_published
  as permissive
  for select
  to anon, authenticated
  using (is_current = true);

grant select on table public.app_studio_design_tokens to anon, authenticated;
drop policy if exists "Public reads published studio design tokens" on public.app_studio_design_tokens;
create policy "Public reads published studio design tokens"
  on public.app_studio_design_tokens
  as permissive
  for select
  to anon, authenticated
  using (status = 'published');

revoke execute on function public.is_admin(uuid) from anon, public;
grant execute on function public.is_admin(uuid) to authenticated;

notify pgrst, 'reload schema';
notify pgrst, 'reload config';
