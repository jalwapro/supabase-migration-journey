-- 0021_uploads_and_chat_media.sql
-- Adds storage buckets for admin uploads (banners, ads, room-backgrounds,
-- gifts, splash, vip, misc) and chat media/voice buckets. Also extends
-- direct_messages so private chat can carry images, video, files, voice
-- notes, and shared private-album references.

-- ================================================================
-- 1) STORAGE BUCKETS  (idempotent)
-- ================================================================
insert into storage.buckets (id, name, public) values
  ('banners',       'banners',       true),
  ('ads',           'ads',           true),
  ('room-bg',       'room-bg',       true),
  ('vip-assets',    'vip-assets',    true),
  ('splash-assets', 'splash-assets', true),
  ('chat-media',    'chat-media',    true),
  ('voice-notes',   'voice-notes',   true)
on conflict (id) do nothing;

-- ================================================================
-- 2) PUBLIC-READ / ADMIN-WRITE POLICIES for admin buckets
-- ================================================================
do $$
declare
  b text;
begin
  foreach b in array array['banners','ads','room-bg','vip-assets','splash-assets']
  loop
    execute format($f$
      drop policy if exists "%1$s public read" on storage.objects;
      create policy "%1$s public read" on storage.objects
        for select using (bucket_id = %1$L);

      drop policy if exists "%1$s admin insert" on storage.objects;
      create policy "%1$s admin insert" on storage.objects
        for insert to authenticated
        with check (bucket_id = %1$L and public.is_admin(auth.uid()));

      drop policy if exists "%1$s admin update" on storage.objects;
      create policy "%1$s admin update" on storage.objects
        for update to authenticated
        using (bucket_id = %1$L and public.is_admin(auth.uid()));

      drop policy if exists "%1$s admin delete" on storage.objects;
      create policy "%1$s admin delete" on storage.objects
        for delete to authenticated
        using (bucket_id = %1$L and public.is_admin(auth.uid()));
    $f$, b);
  end loop;
end $$;

-- ================================================================
-- 3) CHAT-MEDIA / VOICE-NOTES: per-user folder, public read
-- ================================================================
do $$
declare
  b text;
begin
  foreach b in array array['chat-media','voice-notes']
  loop
    execute format($f$
      drop policy if exists "%1$s auth read" on storage.objects;
      create policy "%1$s auth read" on storage.objects
        for select to authenticated
        using (bucket_id = %1$L);

      drop policy if exists "%1$s owner insert" on storage.objects;
      create policy "%1$s owner insert" on storage.objects
        for insert to authenticated
        with check (
          bucket_id = %1$L
          and (storage.foldername(name))[1] = auth.uid()::text
        );

      drop policy if exists "%1$s owner update" on storage.objects;
      create policy "%1$s owner update" on storage.objects
        for update to authenticated
        using (
          bucket_id = %1$L
          and (storage.foldername(name))[1] = auth.uid()::text
        );

      drop policy if exists "%1$s owner delete" on storage.objects;
      create policy "%1$s owner delete" on storage.objects
        for delete to authenticated
        using (
          bucket_id = %1$L
          and (storage.foldername(name))[1] = auth.uid()::text
        );
    $f$, b);
  end loop;
end $$;

-- ================================================================
-- 4) EXTEND direct_messages FOR RICH MEDIA + ALBUM SHARE
-- Real column names (from 0005_friends_dms.sql): sender_id, receiver_id, text
-- ================================================================
alter table public.direct_messages
  alter column text drop not null;

alter table public.direct_messages
  add column if not exists kind text not null default 'text',
  add column if not exists media_url text,
  add column if not exists media_mime text,
  add column if not exists duration_seconds integer,
  add column if not exists gallery_image_id uuid references public.gallery_images(id) on delete set null;

-- kind ∈ text | image | video | file | voice | album
alter table public.direct_messages
  drop constraint if exists direct_messages_kind_check;
alter table public.direct_messages
  add constraint direct_messages_kind_check
  check (kind in ('text','image','video','file','voice','album'));

-- payload sanity: non-text kinds must carry a media_url or a gallery ref
alter table public.direct_messages
  drop constraint if exists direct_messages_payload_check;
alter table public.direct_messages
  add constraint direct_messages_payload_check
  check (
    (kind = 'text'  and text is not null) or
    (kind = 'album' and gallery_image_id is not null) or
    (kind in ('image','video','file','voice') and media_url is not null)
  );

-- helpful index for gallery lookups from chat
create index if not exists idx_direct_messages_gallery_ref
  on public.direct_messages (gallery_image_id)
  where gallery_image_id is not null;
