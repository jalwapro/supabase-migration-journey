-- Enforce: one active live room per host at a time.
create unique index if not exists uniq_live_rooms_one_active_per_host
  on public.live_rooms(host_id)
  where status = 'live';
