-- Admin-controlled opacity for the default Jalwa background (0..100)
alter table public.app_settings
  add column if not exists default_bg_opacity smallint not null default 60
    check (default_bg_opacity between 0 and 100);
