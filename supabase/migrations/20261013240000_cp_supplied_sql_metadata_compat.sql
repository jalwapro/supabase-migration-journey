-- Compatibility fields from the supplied CP couple SQL.
-- Keep the existing cp_relations schema as the single source of truth:
-- do NOT create a second cp_relationships table or duplicate RPCs.
-- No LiveKit tables, tokens, rooms, or APIs are modified.

begin;

alter table public.cp_proposals
  add column if not exists message text not null default 'Will you be my CP?',
  add column if not exists ring_type text not null default 'Silver Love Ring',
  add column if not exists ring_icon text not null default '/gifts/basic-3d/love-ring.png',
  add column if not exists resolved_at timestamptz;

alter table public.cp_relations
  add column if not exists ring_name text not null default 'Silver Love Ring',
  add column if not exists ring_icon text not null default '/gifts/basic-3d/love-ring.png',
  add column if not exists space_bio text not null default 'Forever together in Jalwa ❤️',
  add column if not exists started_at timestamptz not null default now(),
  add column if not exists dissolved_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

-- Backfill metadata timestamps from the existing canonical fields.
update public.cp_proposals
   set resolved_at = responded_at
 where resolved_at is null and responded_at is not null;

update public.cp_relations
   set started_at = created_at
 where started_at is null;

update public.cp_relations
   set dissolved_at = ended_at
 where dissolved_at is null and ended_at is not null;

update public.cp_relations
   set updated_at = coalesce(ended_at, created_at, now())
 where updated_at is null;

commit;
