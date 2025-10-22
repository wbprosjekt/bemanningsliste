-- Fix RLS policies for project_activity table to allow admin deletion
-- This script will create proper RLS policies for the project_activity table
-- SAFE VERSION - Checks existing policies first

-- First, let's check current RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'project_activity';

-- Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'project_activity';

-- Check if table exists and has the expected structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'project_activity' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Drop existing policies if they exist (to start fresh)
DROP POLICY IF EXISTS "Users can view project activity" ON project_activity;
DROP POLICY IF EXISTS "Users can insert project activity" ON project_activity;
DROP POLICY IF EXISTS "Users can update project activity" ON project_activity;
DROP POLICY IF EXISTS "Users can delete project activity" ON project_activity;
DROP POLICY IF EXISTS "Admins can delete project activity" ON project_activity;

-- Create new policies that allow proper access
-- 1. Users can view project activity for their organization
CREATE POLICY "Users can view project activity" ON project_activity
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.org_id = (
                SELECT org_id FROM ttx_project_cache 
                WHERE ttx_project_cache.id = project_activity.project_id
            )
        )
    );

-- 2. Users can insert project activity for their organization
CREATE POLICY "Users can insert project activity" ON project_activity
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.org_id = (
                SELECT org_id FROM ttx_project_cache 
                WHERE ttx_project_cache.id = project_activity.project_id
            )
        )
        AND created_by = auth.uid()
    );

-- 3. Users can update their own comments, admins can update any
CREATE POLICY "Users can update project activity" ON project_activity
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.org_id = (
                SELECT org_id FROM ttx_project_cache 
                WHERE ttx_project_cache.id = project_activity.project_id
            )
            AND (
                profiles.role = 'admin' 
                OR project_activity.created_by = auth.uid()
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.org_id = (
                SELECT org_id FROM ttx_project_cache 
                WHERE ttx_project_cache.id = project_activity.project_id
            )
        )
    );

-- 4. Users can delete their own comments, admins can delete any
CREATE POLICY "Users can delete project activity" ON project_activity
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.org_id = (
                SELECT org_id FROM ttx_project_cache 
                WHERE ttx_project_cache.id = project_activity.project_id
            )
            AND (
                profiles.role = 'admin' 
                OR project_activity.created_by = auth.uid()
            )
        )
    );

-- Enable RLS on the table
ALTER TABLE project_activity ENABLE ROW LEVEL SECURITY;

-- Verify the policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'project_activity'
ORDER BY policyname;

-- ROLLBACK SECTION (run this if something goes wrong)
-- Uncomment the lines below to rollback changes:

/*
-- Disable RLS temporarily (if needed)
ALTER TABLE project_activity DISABLE ROW LEVEL SECURITY;

-- Or drop all policies to start fresh
DROP POLICY IF EXISTS "Users can view project activity" ON project_activity;
DROP POLICY IF EXISTS "Users can insert project activity" ON project_activity;
DROP POLICY IF EXISTS "Users can update project activity" ON project_activity;
DROP POLICY IF EXISTS "Users can delete project activity" ON project_activity;
*/
