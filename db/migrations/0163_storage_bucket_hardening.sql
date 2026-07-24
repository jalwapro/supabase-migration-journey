-- C9: Storage bucket privacy hardening.
--
-- Findings (from storage.buckets + storage.objects policies):
--
--  1. `recharge-proofs` bucket is public=true AND has a "recharge proofs
--     public read" policy on storage.objects. Anyone with (or who guesses)
--     the object URL can fetch payment screenshots — full PII: sender name,
--     bank account number, transaction ID, phone. Highest severity.
--
--  2. `gallery` has both a broad "gallery public read" policy AND a
--     visibility-aware "Gallery view allowed files" policy that calls
--     `gallery_object_visible(name)`. RLS OR's them, so the visibility gate
--     never fires. The visibility function is dead code today.
--
--  3. `chat-media` and `voice-notes` are DM attachments/voice notes with a
--     SELECT policy that only checks `bucket_id = ...`, so any authenticated
--     user can list/download every DM attachment via the SDK. The buckets
--     are also public=true, so `/object/public/...` bypasses RLS entirely.
--     We tighten the RLS side here (defense-in-depth) and flag the public
--     URL side; migrating those two buckets to signed URLs is follow-up
--     work because every stored `media_url` is a public URL today.
--
--  4. `recharge proofs user delete` / `user update` USING clauses check the
--     owning folder but the "user delete" and "user update" have no
--     with_check; that is acceptable because delete has no with_check and
--     update rows would keep the same path. Left as-is.
--
-- Fix summary:
--   • recharge-proofs → private bucket, drop public read, add owner+admin SELECT.
--   • gallery → drop redundant public read so the visibility function gates.
--   • chat-media / voice-notes → replace blanket "auth read" with a
--     DM-participant check joined against public.direct_messages.

begin;

-- 1. recharge-proofs -------------------------------------------------------
update storage.buckets
   set public = false
 where id = 'recharge-proofs';

drop policy if exists "recharge proofs public read" on storage.objects;

drop policy if exists "recharge proofs owner read" on storage.objects;
create policy "recharge proofs owner read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'recharge-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "recharge proofs admin read" on storage.objects;
create policy "recharge proofs admin read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'recharge-proofs'
    and public.is_admin(auth.uid())
  );

drop policy if exists "recharge proofs admin manage" on storage.objects;
create policy "recharge proofs admin manage"
  on storage.objects for all to authenticated
  using (bucket_id = 'recharge-proofs' and public.is_admin(auth.uid()))
  with check (bucket_id = 'recharge-proofs' and public.is_admin(auth.uid()));

-- 2. gallery: drop redundant blanket public read ---------------------------
drop policy if exists "gallery public read" on storage.objects;
-- Keeps "Gallery view allowed files" which honours gallery_object_visible().

-- 3. chat-media & voice-notes: DM-participant SELECT -----------------------
drop policy if exists "chat-media auth read" on storage.objects;
create policy "chat-media dm participant read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-media'
    and (
      -- Uploader (sender) always sees their own object.
      (storage.foldername(name))[1] = auth.uid()::text
      -- Recipient sees it via the DM row that references it.
      or exists (
        select 1 from public.direct_messages dm
         where dm.recipient_id = auth.uid()
           and dm.media_url like '%/' || name
      )
    )
  );

drop policy if exists "voice-notes auth read" on storage.objects;
create policy "voice-notes dm participant read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'voice-notes'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.direct_messages dm
         where dm.recipient_id = auth.uid()
           and dm.media_url like '%/' || name
      )
    )
  );

commit;
