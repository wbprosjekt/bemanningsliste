-- NOTE: Create bucket manually in Supabase Dashboard BEFORE running this migration:
-- 1. Go to Storage in Supabase Dashboard
-- 2. Create new bucket with id 'refusjon-reports'
-- 3. Set as private (not public)
-- 4. Limit: 10MB
-- 5. Allowed types: application/pdf, text/csv
--
-- This migration only creates the RLS policies, not the bucket itself

-- Policy: Users can read their own reimbursement reports
-- Drop existing policy first if re-running migration
DROP POLICY IF EXISTS "Users can view own reimbursement reports" ON storage.objects;
CREATE POLICY "Users can view own reimbursement reports" ON storage.objects
FOR SELECT USING (
  bucket_id = 'refusjon-reports' AND
  (storage.foldername(name))[1] = 'reports' AND
  EXISTS (
    SELECT 1 FROM ref_reimbursements r
    WHERE r.pdf_url LIKE '%' || name OR r.csv_url LIKE '%' || name
    AND r.employee_id = auth.uid()
  )
);

-- Policy: Admins can read all reimbursement reports for their org
DROP POLICY IF EXISTS "Admins can view org reimbursement reports" ON storage.objects;
CREATE POLICY "Admins can view org reimbursement reports" ON storage.objects
FOR SELECT USING (
  bucket_id = 'refusjon-reports' AND
  EXISTS (
    SELECT 1 FROM ref_reimbursements r
    JOIN profiles p ON p.id = r.employee_id
    WHERE (r.pdf_url LIKE '%' || name OR r.csv_url LIKE '%' || name)
    AND p.org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
    AND (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'økonomi')
      )
    )
  )
);

-- Policy: Admins can upload reimbursement reports
DROP POLICY IF EXISTS "Admins can upload reimbursement reports" ON storage.objects;
CREATE POLICY "Admins can upload reimbursement reports" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'refusjon-reports' AND
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'økonomi')
  )
);

-- Policy: Admins can update reimbursement reports
DROP POLICY IF EXISTS "Admins can update reimbursement reports" ON storage.objects;
CREATE POLICY "Admins can update reimbursement reports" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'refusjon-reports' AND
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'økonomi')
  )
);

-- Policy: Admins can delete reimbursement reports
DROP POLICY IF EXISTS "Admins can delete reimbursement reports" ON storage.objects;
CREATE POLICY "Admins can delete reimbursement reports" ON storage.objects
FOR DELETE USING (
  bucket_id = 'refusjon-reports' AND
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'økonomi')
  )
);

-- Comments
COMMENT ON POLICY "Users can view own reimbursement reports" ON storage.objects IS 'Allow employees to view their own PDF/CSV reports';
COMMENT ON POLICY "Admins can view org reimbursement reports" ON storage.objects IS 'Allow admins to view all reports for their org';
COMMENT ON POLICY "Admins can upload reimbursement reports" ON storage.objects IS 'Allow admins to upload generated PDF/CSV';
COMMENT ON POLICY "Admins can update reimbursement reports" ON storage.objects IS 'Allow admins to update/regenerate reports';
COMMENT ON POLICY "Admins can delete reimbursement reports" ON storage.objects IS 'Allow admins to delete reports';

