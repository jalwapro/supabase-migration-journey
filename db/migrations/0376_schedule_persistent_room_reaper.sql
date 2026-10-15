-- Ensure the persistent-room inactivity reaper is actually scheduled.
DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT jobid INTO existing_job_id
      FROM cron.job
     WHERE jobname = 'close-stale-rooms'
     LIMIT 1;

    IF existing_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(existing_job_id);
    END IF;

    PERFORM cron.schedule(
      'close-stale-rooms',
      '* * * * *',
      'select public.close_stale_rooms();'
    );
  END IF;
END;
$$;
