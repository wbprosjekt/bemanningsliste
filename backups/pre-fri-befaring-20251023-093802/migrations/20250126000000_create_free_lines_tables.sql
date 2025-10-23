-- Create table for free lines (frie_linjer)
CREATE TABLE public.frie_linjer (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  name TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create table for free bubbles (frie_bobler)
CREATE TABLE public.frie_bobler (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  frie_linje_id UUID NOT NULL REFERENCES public.frie_linjer(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  text TEXT NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#94a3b8', -- Hex color
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add indexes for performance
CREATE INDEX idx_frie_linjer_org_week_year ON public.frie_linjer(org_id, week_number, year);
CREATE INDEX idx_frie_linjer_display_order ON public.frie_linjer(org_id, week_number, year, display_order);
CREATE INDEX idx_frie_bobler_frie_linje_id ON public.frie_bobler(frie_linje_id);
CREATE INDEX idx_frie_bobler_date ON public.frie_bobler(date);
CREATE INDEX idx_frie_bobler_display_order ON public.frie_bobler(frie_linje_id, display_order);

-- Add RLS policies
ALTER TABLE public.frie_linjer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frie_bobler ENABLE ROW LEVEL SECURITY;

-- Policy for frie_linjer - users can only see/modify lines for their organization
CREATE POLICY "Users can view frie_linjer for their org" ON public.frie_linjer
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.org_id = frie_linjer.org_id
    )
  );

CREATE POLICY "Users can insert frie_linjer for their org" ON public.frie_linjer
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.org_id = frie_linjer.org_id
    )
  );

CREATE POLICY "Users can update frie_linjer for their org" ON public.frie_linjer
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.org_id = frie_linjer.org_id
    )
  );

CREATE POLICY "Users can delete frie_linjer for their org" ON public.frie_linjer
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.org_id = frie_linjer.org_id
    )
  );

-- Policy for frie_bobler - users can only see/modify bubbles for their organization
CREATE POLICY "Users can view frie_bobler for their org" ON public.frie_bobler
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.frie_linjer 
      JOIN public.profiles ON profiles.org_id = frie_linjer.org_id
      WHERE frie_linjer.id = frie_bobler.frie_linje_id 
      AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert frie_bobler for their org" ON public.frie_bobler
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.frie_linjer 
      JOIN public.profiles ON profiles.org_id = frie_linjer.org_id
      WHERE frie_linjer.id = frie_bobler.frie_linje_id 
      AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update frie_bobler for their org" ON public.frie_bobler
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.frie_linjer 
      JOIN public.profiles ON profiles.org_id = frie_linjer.org_id
      WHERE frie_linjer.id = frie_bobler.frie_linje_id 
      AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete frie_bobler for their org" ON public.frie_bobler
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.frie_linjer 
      JOIN public.profiles ON profiles.org_id = frie_linjer.org_id
      WHERE frie_linjer.id = frie_bobler.frie_linje_id 
      AND profiles.user_id = auth.uid()
    )
  );
