-- Enable RLS with proper policies for profile_modules

-- Enable RLS
ALTER TABLE profile_modules ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own module access
CREATE POLICY "Users can view own module access" ON profile_modules
FOR SELECT
USING (
  profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);

-- Policy: Admins can view all module access in their org
CREATE POLICY "Admins can view org module access" ON profile_modules
FOR SELECT
USING (
  profile_id IN (
    SELECT id FROM profiles p
    WHERE p.org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'økonomi')
    )
  )
);

-- Policy: Only admins can insert/update/delete
CREATE POLICY "Admins can manage module access" ON profile_modules
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'økonomi')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'økonomi')
  )
);

SELECT 'RLS enabled for profile_modules with proper policies' as status;


