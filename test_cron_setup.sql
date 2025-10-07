-- Check if cron jobs are working
-- Run this in Supabase SQL Editor

-- 1. Check if pg_cron extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- 2. Check if cron jobs are created
SELECT * FROM cron.job;

-- 3. Check cron job history (if any jobs have run)
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- 4. Test if we can call the Edge Function manually
SELECT net.http_post(
    url:='https://jlndohflirfixbinqdwe.supabase.co/functions/v1/email-reminders',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsbmRvaGZsaXJmaXhiaW5xZHdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzkzMzYwOSwiZXhwIjoyMDczNTA5NjA5fQ.placeholder"}'::jsonb,
    body:='{"action": "send-test", "orgId": "test", "testEmail": "test@example.com"}'::jsonb
) as test_result;
