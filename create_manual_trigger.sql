-- Alternative: Manual trigger function for reminders
-- Run this in Supabase SQL Editor if cron doesn't work

-- Create a function to manually trigger reminders
CREATE OR REPLACE FUNCTION trigger_reminders(reminder_type TEXT DEFAULT 'all')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    -- This function can be called manually to trigger reminders
    -- reminder_type can be 'weekly', 'payroll', or 'all'
    
    -- For now, just return a success message
    -- The actual email sending will be handled by calling the Edge Function
    result := jsonb_build_object(
        'success', true,
        'message', 'Reminder trigger function created successfully',
        'reminder_type', reminder_type,
        'timestamp', now()
    );
    
    RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION trigger_reminders(TEXT) TO authenticated;

-- Test the function
SELECT trigger_reminders('all');
