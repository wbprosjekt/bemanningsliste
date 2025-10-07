-- Enable pg_cron extension and create cron jobs
-- Run this in Supabase SQL Editor

-- First, enable the pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Weekly reminder cron job (runs every hour to check all organizations' individual settings)
SELECT cron.schedule(
  'weekly-reminder-job',
  '0 * * * *', -- Every hour
  $$
  SELECT
    net.http_post(
        url:='https://jlndohflirfixbinqdwe.supabase.co/functions/v1/email-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
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
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
        body:='{"action": "send-payroll-reminder", "orgId": "all", "triggered_by": "cron", "time": "' || now()::text || '"}'::jsonb
    ) as request_id;
  $$
);

-- Check existing cron jobs
SELECT * FROM cron.job;
