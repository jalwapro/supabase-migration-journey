-- Keep runtime writes aligned with the Admin Customization Studio.
alter table public.app_customization_drafts
  add column if not exists is_active boolean not null default true;

alter table public.app_customization_published
  add column if not exists notes text;

create index if not exists idx_ac_drafts_page_active
  on public.app_customization_drafts(page_id, is_active, updated_at desc);

notify pgrst, 'reload schema';
