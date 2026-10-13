-- CP ranking resets at 00:00 Asia/Riyadh on Sunday.
-- Riyadh is UTC+3, so run the weekly settlement at 21:05 UTC on Saturday.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'cp-weekly-settlement';
    perform cron.schedule(
      'cp-weekly-settlement',
      '5 21 * * 6',
      'select public.cp_settle_weekly_leaderboard();'
    );
  end if;
end $$;
