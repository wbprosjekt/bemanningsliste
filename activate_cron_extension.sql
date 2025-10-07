-- Activate pg_cron extension in Supabase
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Check if extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- 3. Create cron jobs for automatic reminders
-- Weekly reminder cron job (runs every hour to check all organizations' individual settings)
SELECT cron.schedule(
  'weekly-reminder-job',
  '0 * * * *', -- Every hour
  $$
  SELECT
    net.http_post(
        url:='https://jlndohflirfixbinqdwe.supabase.co/functions/v1/email-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsbmRvaGZsaXJmaXhiaW5xZHdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzkzMzYwOSwiZXhwIjoyMDczNTA5NjA5fQ.placeholder"}'::jsonb,
        body:='{"action": "send-weekly-reminder", "orgId": "all", "triggered_by": "cron", "time": "' || now()::text || '"}'::jsonb
    ) as request_id;
  $$
);

-- Payroll reminder cron job (runs every day at 9:00 AM to check all organizations' payroll dates)
SELECT cron.schedule(
  'payroll-reminder-job',
  '0 9 * * *', -- Every day at 9:00 AM
  $$
  SELECT
    net.http_post(
        url:='https://jlndohflirfixbinqdwe.supabase.co/functions/v1/email-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsbmRvaGZsaXJmaXhiaW5xZHdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzkzMzYwOSwiZXhwIjoyMDczNTA5NjA5fQ.placeholder"}'::jsonb,
        body:='{"action": "send-payroll-reminder", "orgId": "all", "triggered_by": "cron", "time": "' || now()::text || '"}'::jsonb
    ) as request_id;
  $$
);

-- 4. Check if cron jobs are created
SELECT * FROM cron.job;

-- 5. Test if we can call the Edge Function manually (this might fail if net extension is not enabled)
-- SELECT net.http_post(
--     url:='https://jlndohflirfixbinqdwe.supabase.co/functions/v1/email-reminders',
--     headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsbmRvaGZsaXJmaXhiaW5xZHdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzkzMzYwOSwiZXhwIjoyMDczNTA5NjA5fQ.placeholder"}'::jsonb,
--     body:='{"action": "send-test", "orgId": "test", "testEmail": "test@example.com"}'::jsonb
-- ) as test_result;
