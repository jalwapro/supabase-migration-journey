-- ============================================================================
-- Fix recharge submit (storage upload) and banners 401.
--
-- Bugs:
--   1. `recharge-proofs` bucket has a public READ policy but NO INSERT policy,
--      so signed-in users cannot upload their payment proof → the Submit
--      button silently fails at storage.upload.
--   2. `banners` SELECT policy references public.is_admin(uuid), but anon
--      role lacks EXECUTE on that function → every anon banner fetch 401s
--      with `permission denied for function is_admin`.
-- ============================================================================

-- ---------- 1. Storage: allow authenticated users to upload proofs ---------
drop policy if exists "recharge proofs user upload" on storage.objects;
create policy "recharge proofs user upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'recharge-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "recharge proofs user update" on storage.objects;
create policy "recharge proofs user update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'recharge-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "recharge proofs user delete" on storage.objects;
create policy "recharge proofs user delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'recharge-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------- 2. Allow anon to execute is_admin (returns false for null uid) --
grant execute on function public.is_admin(uuid) to anon;

notify pgrst, 'reload schema';
