-- Temporarily disable RLS for storage.objects for testing
-- This allows uploading PDF/CSV reports without authentication

-- Check current RLS status for storage.objects
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'storage' 
AND tablename = 'objects';

-- Temporarily allow all access to refusjon-reports bucket
-- CAUTION: This disables RLS - only use for testing!
UPDATE storage.buckets SET public = true WHERE id = 'refusjon-reports';

-- Drop ALL existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own reimbursement reports" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view org reimbursement reports" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload reimbursement reports" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update reimbursement reports" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete reimbursement reports" ON storage.objects;
DROP POLICY IF EXISTS "Allow all access for testing" ON storage.objects;

-- Create permissive policy for testing (allows anyone to upload to refusjon-reports)
CREATE POLICY "Allow all access for testing" ON storage.objects
FOR ALL
USING (bucket_id = 'refusjon-reports')
WITH CHECK (bucket_id = 'refusjon-reports');

SELECT 'RLS temporarily disabled for refusjon-reports bucket' as status;

