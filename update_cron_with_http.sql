-- Update cron jobs to use pg_net for real HTTP calls to Edge Functions
-- Run this in Supabase SQL Editor

-- 1. First, unschedule any existing cron jobs (ignore errors if they don't exist)
DO $$
BEGIN
    BEGIN
        PERFORM cron.unschedule('weekly-reminder-check');
    EXCEPTION WHEN OTHERS THEN
        -- Job doesn't exist, ignore error
    END;
    
    BEGIN
        PERFORM cron.unschedule('payroll-reminder-check');
    EXCEPTION WHEN OTHERS THEN
        -- Job doesn't exist, ignore error
    END;
    
    BEGIN
        PERFORM cron.unschedule('weekly-reminder-job');
    EXCEPTION WHEN OTHERS THEN
        -- Job doesn't exist, ignore error
    END;
    
    BEGIN
        PERFORM cron.unschedule('payroll-reminder-job');
    EXCEPTION WHEN OTHERS THEN
        -- Job doesn't exist, ignore error
    END;
END $$;

-- 2. Create new cron jobs that call Edge Functions directly
-- NOTE: Before running this, set the required secrets:
-- ALTER DATABASE postgres SET app.service_role_key = 'your-actual-service-role-key';
-- ALTER DATABASE postgres SET app.email_reminders_secret = 'your-random-secret-key';
-- ALTER DATABASE postgres SET app.nightly_sync_secret = 'your-random-secret-key';

-- Weekly reminder cron job (runs every hour to check all organizations' individual settings)
SELECT cron.schedule(
  'weekly-reminder-job',
  '0 * * * *', -- Every hour
  $$
  SELECT net.http_post(
      url:='https://jlndohflirfixbinqdwe.supabase.co/functions/v1/email-reminders',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
        'X-Trigger-Secret', current_setting('app.email_reminders_secret')
      ),
      body:=jsonb_build_object(
        'action', 'send-weekly-reminder',
        'orgId', 'all',
        'triggered_by', 'cron',
        'time', now()::text
      )
  ) as request_id;
  $$
);

-- Payroll reminder cron job (runs every day at 9:00 AM to check all organizations' payroll dates)
SELECT cron.schedule(
  'payroll-reminder-job',
  '0 9 * * *', -- Every day at 9:00 AM
  $$
  SELECT net.http_post(
      url:='https://jlndohflirfixbinqdwe.supabase.co/functions/v1/email-reminders',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
        'X-Trigger-Secret', current_setting('app.email_reminders_secret')
      ),
      body:=jsonb_build_object(
        'action', 'send-payroll-reminder',
        'orgId', 'all',
        'triggered_by', 'cron',
        'time', now()::text
      )
  ) as request_id;
  $$
);

-- Nightly sync job (runs every night at 2:00 AM)
SELECT cron.schedule(
  'nightly-sync-job',
  '0 2 * * *', -- Every day at 2:00 AM
  $$
  SELECT net.http_post(
      url:='https://jlndohflirfixbinqdwe.supabase.co/functions/v1/nightly-sync',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Trigger-Secret', current_setting('app.nightly_sync_secret')
      ),
      body:=jsonb_build_object(
        'triggered_by', 'cron',
        'time', now()::text
      )
  ) as request_id;
  $$
);

-- 3. Check that new cron jobs are created
SELECT * FROM cron.job;

-- 4. Test the Edge Function call manually
SELECT net.http_post(
    url:='https://jlndohflirfixbinqdwe.supabase.co/functions/v1/email-reminders',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body:='{"action": "send-test", "orgId": "test", "testEmail": "test@example.com"}'::jsonb
) as test_edge_function;
