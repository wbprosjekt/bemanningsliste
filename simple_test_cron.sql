-- Simple test to check if cron jobs are working
-- Run this in Supabase SQL Editor

-- 1. Check if pg_cron extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- 2. Check if cron jobs are created
SELECT * FROM cron.job;

-- 3. Check cron job history (if any jobs have run)
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- 4. Check if our tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('reminder_settings', 'email_logs', 'email_settings', 'email_templates');

-- 5. Check if we have any reminder settings
SELECT COUNT(*) as reminder_settings_count FROM public.reminder_settings;

-- 6. Check if we have any email settings
SELECT COUNT(*) as email_settings_count FROM public.email_settings;
