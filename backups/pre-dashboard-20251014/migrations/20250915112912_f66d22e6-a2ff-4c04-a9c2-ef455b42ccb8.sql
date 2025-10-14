-- Create calendar table for date planning
CREATE TABLE public.kalender_dag (
    dato DATE NOT NULL PRIMARY KEY,
    iso_uke INTEGER NOT NULL,
    iso_ar INTEGER NOT NULL,
    is_weekend BOOLEAN NOT NULL DEFAULT false,
    is_holiday BOOLEAN NOT NULL DEFAULT false,
    holiday_name TEXT
);

-- Create project color table for UI customization
CREATE TABLE public.project_color (
    tripletex_project_id BIGINT NOT NULL PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
    hex TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add default expected hours on holidays setting to integration_settings or create settings table
ALTER TABLE public.integration_settings 
ADD COLUMN IF NOT EXISTS default_expected_hours_on_holidays NUMERIC(4,2) DEFAULT 0;

-- Add missing fields to person table
ALTER TABLE public.person 
ADD COLUMN IF NOT EXISTS epost TEXT,
ADD COLUMN IF NOT EXISTS tripletex_employee_id BIGINT,
ADD COLUMN IF NOT EXISTS forventet_dagstimer NUMERIC(4,2) DEFAULT 8.0;

-- Add missing fields to ttx_project_cache
ALTER TABLE public.ttx_project_cache 
ADD COLUMN IF NOT EXISTS tripletex_project_id BIGINT;

-- Add missing tables for cache
CREATE TABLE IF NOT EXISTS public.ttx_activity_cache (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
    ttx_id BIGINT,
    navn TEXT NOT NULL,
    aktiv BOOLEAN DEFAULT true,
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ttx_employee_cache (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
    tripletex_employee_id BIGINT NOT NULL,
    fornavn TEXT NOT NULL,
    etternavn TEXT NOT NULL,
    epost TEXT,
    aktiv BOOLEAN DEFAULT true,
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add missing fields to vakt_timer table
CREATE TABLE IF NOT EXISTS public.vakt_timer (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
    vakt_id UUID NOT NULL REFERENCES public.vakt(id) ON DELETE CASCADE,
    aktivitet_id UUID REFERENCES public.ttx_activity_cache(id),
    timer NUMERIC(4,2) NOT NULL,
    status TEXT DEFAULT 'utkast' CHECK (status IN ('utkast', 'klar', 'godkjent', 'sendt')),
    lonnstype TEXT DEFAULT 'normal',
    notat TEXT,
    client_reference TEXT,
    kilde TEXT DEFAULT 'intern',
    tripletex_entry_id BIGINT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Update audit_log to match requirements
ALTER TABLE public.audit_log 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS action TEXT,
ADD COLUMN IF NOT EXISTS target TEXT,
ADD COLUMN IF NOT EXISTS target_id UUID;

-- Enable RLS on new tables
ALTER TABLE public.kalender_dag ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_color ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ttx_activity_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ttx_employee_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vakt_timer ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for new tables

-- Calendar table - read access for org users
CREATE POLICY "Users can view calendar data" 
ON public.kalender_dag 
FOR SELECT 
TO authenticated
USING (true);

-- Project color table
CREATE POLICY "Users can view project colors in their organization" 
ON public.project_color 
FOR SELECT 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage project colors in their organization" 
ON public.project_color 
FOR ALL 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

-- Activity cache policies
CREATE POLICY "Users can view activities in their organization" 
ON public.ttx_activity_cache 
FOR SELECT 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage activities in their organization" 
ON public.ttx_activity_cache 
FOR ALL 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

-- Employee cache policies
CREATE POLICY "Users can view employee cache in their organization" 
ON public.ttx_employee_cache 
FOR SELECT 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage employee cache in their organization" 
ON public.ttx_employee_cache 
FOR ALL 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

-- Timer entries policies
CREATE POLICY "Users can view time entries in their organization" 
ON public.vakt_timer 
FOR SELECT 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage time entries in their organization" 
ON public.vakt_timer 
FOR ALL 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_kalender_dag_iso_ar_uke ON public.kalender_dag(iso_ar, iso_uke);
CREATE INDEX IF NOT EXISTS idx_project_color_org_id ON public.project_color(org_id);
CREATE INDEX IF NOT EXISTS idx_ttx_activity_cache_org_id ON public.ttx_activity_cache(org_id);
CREATE INDEX IF NOT EXISTS idx_ttx_employee_cache_org_id ON public.ttx_employee_cache(org_id);
CREATE INDEX IF NOT EXISTS idx_vakt_timer_org_id ON public.vakt_timer(org_id);
CREATE INDEX IF NOT EXISTS idx_vakt_timer_vakt_id ON public.vakt_timer(vakt_id);

-- Create triggers for timestamp updates
CREATE TRIGGER update_project_color_updated_at
    BEFORE UPDATE ON public.project_color
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ttx_activity_cache_updated_at
    BEFORE UPDATE ON public.ttx_activity_cache
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ttx_employee_cache_updated_at
    BEFORE UPDATE ON public.ttx_employee_cache
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vakt_timer_updated_at
    BEFORE UPDATE ON public.vakt_timer
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create client reference generation function
CREATE OR REPLACE FUNCTION public.generate_client_reference(org_uuid uuid, timer_uuid uuid)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN org_uuid::text || '-' || timer_uuid::text;
END;
$$;