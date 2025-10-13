-- ============================================================
-- MIGRATION TEMPLATE - BEST PRACTICES
-- ============================================================
-- Author: [NAME]
-- Date: [DATE]
-- Description: [WHAT THIS MIGRATION DOES]
-- ============================================================

-- ============================================================
-- 1. CREATE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.example_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
  
  -- Data fields
  name text NOT NULL,
  description text,
  
  -- Foreign keys - FOLLOW THESE RULES:
  -- ✅ Use auth.users(id) for: created_by, updated_by, endret_av, bruker_id
  --    (ANY field that comes from auth.uid())
  -- ⚠️ Use profiles(id) for: ansvarlig_person_id, tildelt_til
  --    (ONLY for manual assignment from dropdowns)
  
  created_by uuid NOT NULL REFERENCES auth.users(id),  -- ✅ From auth.uid()
  -- ansvarlig_person_id uuid REFERENCES profiles(id), -- ⚠️ Manual assignment
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- 2. CREATE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_example_table_org_id 
  ON public.example_table(org_id);

-- ============================================================
-- 3. ENABLE RLS
-- ============================================================

ALTER TABLE public.example_table ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. CREATE RLS POLICIES
-- ============================================================

-- SELECT: Users can view in their org
DROP POLICY IF EXISTS "Users view example_table in own org" ON public.example_table;
CREATE POLICY "Users view example_table in own org"
  ON public.example_table FOR SELECT
  USING (org_id = public.get_user_org_id());

-- INSERT/UPDATE/DELETE: All users in org
DROP POLICY IF EXISTS "Users manage example_table in own org" ON public.example_table;
CREATE POLICY "Users manage example_table in own org"
  ON public.example_table FOR ALL
  USING (org_id = public.get_user_org_id())
  WITH CHECK (org_id = public.get_user_org_id());

-- ============================================================
-- 5. CREATE TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamp
DROP TRIGGER IF EXISTS update_example_table_updated_at ON public.example_table;
CREATE TRIGGER update_example_table_updated_at
  BEFORE UPDATE ON public.example_table
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 6. ADD COMMENTS
-- ============================================================

COMMENT ON TABLE public.example_table IS 'Description of what this table stores';
COMMENT ON COLUMN public.example_table.created_by IS 'User ID (auth.uid) of creator';

-- ============================================================
-- 7. REFRESH SCHEMA CACHE
-- ============================================================

NOTIFY pgrst, 'reload schema';



