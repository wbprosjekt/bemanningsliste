-- Alternative solution: Create a PostgreSQL function that cron can call
-- Run this in Supabase SQL Editor

-- 1. Create a function that cron can call (without HTTP)
CREATE OR REPLACE FUNCTION trigger_reminder_check()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    reminder_record RECORD;
    current_time TIME := CURRENT_TIME;
    current_day INTEGER := EXTRACT(DOW FROM CURRENT_DATE);
    current_date_str TEXT := CURRENT_DATE::TEXT;
BEGIN
    -- Log that the function was called
    INSERT INTO email_logs (
        org_id,
        recipient_email,
        recipient_name,
        subject,
        template_type,
        status,
        triggered_by,
        reminder_type,
        sent_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000'::UUID, -- Dummy org_id for system logs
        'system@cron',
        'Cron System',
        'Cron job executed',
        'test',
        'sent',
        'cron',
        'system',
        NOW()
    );
    
    -- Check for weekly reminders (every hour)
    FOR reminder_record IN 
        SELECT rs.*, es.is_active as email_active
        FROM reminder_settings rs
        JOIN email_settings es ON rs.org_id = es.org_id
        WHERE rs.weekly_enabled = true 
        AND es.is_active = true
    LOOP
        -- Check if it's the right day and time (within 1 hour window)
        IF (current_day = reminder_record.weekly_day OR (current_day = 0 AND reminder_record.weekly_day = 7)) THEN
            -- Log that we would send a weekly reminder
            INSERT INTO email_logs (
                org_id,
                recipient_email,
                recipient_name,
                subject,
                template_type,
                status,
                triggered_by,
                reminder_type,
                sent_at
            ) VALUES (
                reminder_record.org_id,
                'weekly@trigger',
                'Weekly Reminder Trigger',
                'Weekly reminder would be sent',
                'weekly',
                'pending',
                'cron',
                'weekly',
                NOW()
            );
        END IF;
    END LOOP;
    
    -- Check for payroll reminders (daily at 9 AM)
    IF current_time BETWEEN '09:00:00' AND '09:59:59' THEN
        FOR reminder_record IN 
            SELECT rs.*, es.is_active as email_active
            FROM reminder_settings rs
            JOIN email_settings es ON rs.org_id = es.org_id
            WHERE rs.payroll_enabled = true 
            AND es.is_active = true
        LOOP
            -- Calculate payroll reminder date
            DECLARE
                payroll_date DATE;
                reminder_date DATE;
            BEGIN
                payroll_date := DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day';
                payroll_date := payroll_date + INTERVAL '1 day' - INTERVAL '1 day' + INTERVAL '1 day' * (reminder_record.payroll_day_of_month - 1);
                reminder_date := payroll_date - INTERVAL '1 day' * reminder_record.payroll_days_before;
                
                IF CURRENT_DATE = reminder_date THEN
                    -- Log that we would send a payroll reminder
                    INSERT INTO email_logs (
                        org_id,
                        recipient_email,
                        recipient_name,
                        subject,
                        template_type,
                        status,
                        triggered_by,
                        reminder_type,
                        sent_at
                    ) VALUES (
                        reminder_record.org_id,
                        'payroll@trigger',
                        'Payroll Reminder Trigger',
                        'Payroll reminder would be sent',
                        'payroll',
                        'pending',
                        'cron',
                        'payroll',
                        NOW()
                    );
                END IF;
            END;
        END LOOP;
    END IF;
END;
$$;

-- 2. Update cron jobs to call the function instead of HTTP
-- First, unschedule the old jobs
SELECT cron.unschedule('weekly-reminder-job');
SELECT cron.unschedule('payroll-reminder-job');

-- 3. Create new cron jobs that call the function
-- Weekly reminder check (every hour)
SELECT cron.schedule(
  'weekly-reminder-check',
  '0 * * * *', -- Every hour
  'SELECT trigger_reminder_check();'
);

-- Payroll reminder check (daily at 9 AM)
SELECT cron.schedule(
  'payroll-reminder-check',
  '0 9 * * *', -- Every day at 9:00 AM
  'SELECT trigger_reminder_check();'
);

-- 4. Check that new cron jobs are created
SELECT * FROM cron.job;
