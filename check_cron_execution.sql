-- Check if cron jobs are actually running
-- Run this in Supabase SQL Editor

-- 1. Check cron job run history
SELECT 
    jobid,
    start_time,
    end_time,
    status,
    return_message
FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;

-- 2. Check if net extension is available
SELECT * FROM pg_extension WHERE extname = 'net';

-- 3. Test if we can make HTTP calls (this might fail)
SELECT net.http_post(
    url:='https://httpbin.org/post',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:='{"test": "hello"}'::jsonb
) as test_result;
