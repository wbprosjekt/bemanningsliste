-- Fix infinite recursion in RLS policies by creating security definer function
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- Drop existing profiles policies that cause recursion
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;

-- Create new policy using security definer function
CREATE POLICY "Users can view profiles in their organization" 
ON public.profiles 
FOR SELECT 
USING (org_id = public.get_user_org_id());

-- Ensure calendar and color tables exist with proper structure
CREATE TABLE IF NOT EXISTS public.kalender_dag (
    dato DATE NOT NULL PRIMARY KEY,
    iso_uke INTEGER NOT NULL,
    iso_ar INTEGER NOT NULL,
    is_weekend BOOLEAN NOT NULL DEFAULT false,
    is_holiday BOOLEAN NOT NULL DEFAULT false,
    holiday_name TEXT
);

CREATE TABLE IF NOT EXISTS public.project_color (
    tripletex_project_id BIGINT NOT NULL PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
    hex TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables if not already enabled
ALTER TABLE public.kalender_dag ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_color ENABLE ROW LEVEL SECURITY;

-- Create policies for calendar (read-only for authenticated users)
DROP POLICY IF EXISTS "Users can view calendar data" ON public.kalender_dag;
CREATE POLICY "Users can view calendar data" 
ON public.kalender_dag 
FOR SELECT 
TO authenticated
USING (true);

-- Create policies for project colors
DROP POLICY IF EXISTS "Users can view project colors in their organization" ON public.project_color;
DROP POLICY IF EXISTS "Users can manage project colors in their organization" ON public.project_color;

CREATE POLICY "Users can view project colors in their organization" 
ON public.project_color 
FOR SELECT 
USING (org_id = public.get_user_org_id());

CREATE POLICY "Users can manage project colors in their organization" 
ON public.project_color 
FOR ALL 
USING (org_id = public.get_user_org_id());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_kalender_dag_iso_ar_uke ON public.kalender_dag(iso_ar, iso_uke);
CREATE INDEX IF NOT EXISTS idx_project_color_org_id ON public.project_color(org_id);

-- Create trigger for project color timestamps
DROP TRIGGER IF EXISTS update_project_color_updated_at ON public.project_color;
CREATE TRIGGER update_project_color_updated_at
    BEFORE UPDATE ON public.project_color
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();