-- Detailed diagnostic for plantegninger RLS issue

-- 1. Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'plantegninger';

-- 2. Check ALL existing policies (very detailed)
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies 
WHERE tablename = 'plantegninger'
ORDER BY policyname;

-- 3. Check if policies were created successfully
SELECT 
  COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'plantegninger';

-- 4. Check table owner and permissions
SELECT 
  tablename,
  tableowner,
  tablespace
FROM pg_tables 
WHERE tablename = 'plantegninger';

-- 5. Try to manually query the table (will fail if RLS blocks it)
SELECT COUNT(*) as total_plantegninger 
FROM plantegninger;
