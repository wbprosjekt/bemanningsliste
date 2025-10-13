-- =====================================================
-- FINAL COMPLETE FIX FOR BEFARING MODULE
-- =====================================================

-- Step 1: Fix the get_user_org_id() function
DROP FUNCTION IF EXISTS public.get_user_org_id();
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid AS $$
  SELECT org_id FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Step 2: Add file_type column (force drop and recreate if exists)
DO $$ 
BEGIN
  -- Drop column if exists and recreate to ensure clean state
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'plantegninger' 
    AND column_name = 'file_type'
  ) THEN
    ALTER TABLE public.plantegninger DROP COLUMN file_type;
  END IF;
  
  -- Add the column
  ALTER TABLE public.plantegninger ADD COLUMN file_type text DEFAULT 'image';
END $$;

-- Update existing records
UPDATE public.plantegninger 
SET file_type = CASE 
  WHEN image_url LIKE '%.pdf' THEN 'pdf'
  ELSE 'image'
END;

-- Step 3: Drop ALL existing policies for plantegninger
DROP POLICY IF EXISTS "Users see plantegninger in own org" ON public.plantegninger;
DROP POLICY IF EXISTS "Admins manage plantegninger in own org" ON public.plantegninger;
DROP POLICY IF EXISTS "Users manage plantegninger in own org" ON public.plantegninger;

-- Step 4: Create NEW policies for plantegninger with proper WITH CHECK
-- Policy for SELECT (all users can see)
CREATE POLICY "Users see plantegninger in own org"
  ON public.plantegninger 
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.befaringer b
      WHERE b.id = plantegninger.befaring_id
      AND b.org_id = public.get_user_org_id()
    )
  );

-- Policy for INSERT (admins can insert)
CREATE POLICY "Admins insert plantegninger in own org"
  ON public.plantegninger 
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.befaringer b
      WHERE b.id = plantegninger.befaring_id
      AND b.org_id = public.get_user_org_id()
    )
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('admin', 'manager')
  );

-- Policy for UPDATE (admins can update)
CREATE POLICY "Admins update plantegninger in own org"
  ON public.plantegninger 
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.befaringer b
      WHERE b.id = plantegninger.befaring_id
      AND b.org_id = public.get_user_org_id()
    )
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('admin', 'manager')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.befaringer b
      WHERE b.id = plantegninger.befaring_id
      AND b.org_id = public.get_user_org_id()
    )
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('admin', 'manager')
  );

-- Policy for DELETE (admins can delete)
CREATE POLICY "Admins delete plantegninger in own org"
  ON public.plantegninger 
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.befaringer b
      WHERE b.id = plantegninger.befaring_id
      AND b.org_id = public.get_user_org_id()
    )
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('admin', 'manager')
  );

-- Step 5: Fix storage policies
DROP POLICY IF EXISTS "Users can view befaring assets from their org" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload befaring assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can update befaring assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete befaring assets" ON storage.objects;

-- Storage SELECT policy
CREATE POLICY "Users can view befaring assets from their org" 
ON storage.objects
FOR SELECT 
USING (
  bucket_id = 'befaring-assets' AND
  EXISTS (
    SELECT 1 FROM public.befaringer b
    INNER JOIN public.profiles p ON p.org_id = b.org_id
    WHERE p.user_id = auth.uid()
    AND b.id::text = split_part(name, '/', 1)
  )
);

-- Storage INSERT policy
CREATE POLICY "Users can upload befaring assets" 
ON storage.objects
FOR INSERT 
WITH CHECK (
  bucket_id = 'befaring-assets' AND
  EXISTS (
    SELECT 1 FROM public.befaringer b
    INNER JOIN public.profiles p ON p.org_id = b.org_id
    WHERE p.user_id = auth.uid()
    AND b.id::text = split_part(name, '/', 1)
  )
);

-- Storage UPDATE policy
CREATE POLICY "Users can update befaring assets" 
ON storage.objects
FOR UPDATE 
USING (
  bucket_id = 'befaring-assets' AND
  EXISTS (
    SELECT 1 FROM public.befaringer b
    INNER JOIN public.profiles p ON p.org_id = b.org_id
    WHERE p.user_id = auth.uid()
    AND b.id::text = split_part(name, '/', 1)
  )
)
WITH CHECK (
  bucket_id = 'befaring-assets' AND
  EXISTS (
    SELECT 1 FROM public.befaringer b
    INNER JOIN public.profiles p ON p.org_id = b.org_id
    WHERE p.user_id = auth.uid()
    AND b.id::text = split_part(name, '/', 1)
  )
);

-- Storage DELETE policy
CREATE POLICY "Users can delete befaring assets" 
ON storage.objects
FOR DELETE 
USING (
  bucket_id = 'befaring-assets' AND
  EXISTS (
    SELECT 1 FROM public.befaringer b
    INNER JOIN public.profiles p ON p.org_id = b.org_id
    WHERE p.user_id = auth.uid()
    AND b.id::text = split_part(name, '/', 1)
  )
);

-- Step 6: Refresh schema cache
NOTIFY pgrst, 'reload schema';

