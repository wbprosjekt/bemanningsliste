-- Debug script to check current state of RLS policies and schema

-- 1. Check if file_type column exists
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'plantegninger' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check current RLS policies for plantegninger
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'plantegninger'
ORDER BY policyname;

-- 3. Check current RLS policies for storage.objects (befaring-assets)
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage'
AND policyname LIKE '%befaring%'
ORDER BY policyname;

-- 4. Test get_user_org_id() function
SELECT public.get_user_org_id() as user_org_id;

-- 5. Check your current profile (only id, user_id, org_id, role)
SELECT id, user_id, org_id, role
FROM public.profiles
WHERE user_id = auth.uid();

-- 6. Check if the befaring exists and you have access
SELECT id, org_id, title, status
FROM public.befaringer
WHERE id = 'f32933d1-0077-458e-a480-9d84bce0155e'::uuid;

