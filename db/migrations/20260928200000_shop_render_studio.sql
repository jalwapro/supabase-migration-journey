-- Shop Render Studio: use the same shared render-config engine as Gift/Entrance Studio.
begin;

alter table public.themes
  add column if not exists render_config jsonb not null default '{}'::jsonb;

create index if not exists idx_themes_render_config_gin
  on public.themes using gin (render_config);

notify pgrst, 'reload schema';
commit;
