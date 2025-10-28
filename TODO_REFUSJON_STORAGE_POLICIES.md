# TODO: Setup Refusjon Storage Policies

## Status: Manual step required

Bucket `refusjon-reports` has been created, but RLS policies need to be added manually via Supabase Dashboard.

## Why Manual?

The migration `20250130000001_setup_refusjon_storage.sql` tries to create RLS policies on `storage.objects`, which requires service role/admin privileges that aren't available in standard migrations.

## How to Complete (Choose One):

### Option 1: Via Supabase Dashboard (Recommended)
1. Go to Supabase Dashboard → Storage
2. Click on bucket `refusjon-reports`
3. Go to "Policies" tab
4. Click "New Policy"
5. Copy the SQL from `supabase/migrations/20250130000001_setup_refusjon_storage.sql` (lines 10-80)
6. Run each `CREATE POLICY` statement

### Option 2: Via SQL Editor with Service Role
1. Go to Supabase Dashboard → SQL Editor
2. Paste the policies from the migration file
3. Run the SQL (this will work with service role context)

## Required Policies:

1. **Users can view own reimbursement reports**
   - Allows employees to download their own PDF/CSV
   - Policy checks: `r.employee_id = auth.uid()`

2. **Admins can view org reimbursement reports**
   - Allows admins to view all reports for their org
   - Policy checks: admin role + same org

3. **Admins can upload reimbursement reports**
   - Allows admins to upload generated PDF/CSV
   - Policy checks: admin/økonomi role

4. **Admins can update reimbursement reports**
   - Allows admins to regenerate reports
   - Policy checks: admin/økonomi role

5. **Admins can delete reimbursement reports**
   - Allows admins to delete reports
   - Policy checks: admin/økonomi role

## File Reference:
- `supabase/migrations/20250130000001_setup_refusjon_storage.sql`

## Alternative:
Skipped for now - storage functionality will work without strict RLS initially. Can be added later when full refusjon module is complete.


