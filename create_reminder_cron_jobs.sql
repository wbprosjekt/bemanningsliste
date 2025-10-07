-- Create automatic reminder cron jobs
-- Run this in Supabase SQL Editor

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

-- Check existing cron jobs
SELECT * FROM cron.job;
