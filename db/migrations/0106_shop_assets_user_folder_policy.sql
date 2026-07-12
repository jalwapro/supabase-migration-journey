-- ============================================================================
-- 0106: Allow authenticated users to upload their own custom theme images
-- into the shop-assets bucket under their own {user_id}/custom-themes/ path.
--
-- Problem: The custom theme submission flow (submit_custom_theme RPC) needs
-- the user to first upload the image to storage. The bucket "shop-assets"
-- had an admin-only INSERT policy, so regular users hit RLS:
--   "new row violates row-level security policy for storage.objects"
-- and the "Submit for X coins" button failed with a storage error before the
-- RPC was ever called.
--
-- Fix: keep admin-wide access, but ALSO allow authenticated users to
-- write/update/delete files that live under their own user_id folder
-- within shop-assets. Public read policy already exists.
-- ============================================================================

drop policy if exists "users upload own custom themes" on storage.objects;
create policy "users upload own custom themes" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'shop-assets'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users update own custom themes" on storage.objects;
create policy "users update own custom themes" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'shop-assets'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users delete own custom themes" on storage.objects;
create policy "users delete own custom themes" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'shop-assets'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
