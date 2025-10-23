-- Add Tripletex ID columns to existing tables
ALTER TABLE public.person 
ADD COLUMN tripletex_employee_id BIGINT UNIQUE,
ADD COLUMN epost TEXT;

ALTER TABLE public.ttx_project_cache 
ADD COLUMN tripletex_project_id BIGINT UNIQUE;

ALTER TABLE public.vakt 
ADD COLUMN tripletex_project_id BIGINT;

ALTER TABLE public.vakt_timer 
ADD COLUMN tripletex_entry_id BIGINT,
ADD COLUMN client_reference TEXT UNIQUE,
ADD COLUMN kilde TEXT DEFAULT 'intern' CHECK (kilde IN ('intern', 'tripletex'));

-- Create ttx_employee_cache table for Tripletex employee data
CREATE TABLE public.ttx_employee_cache (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
    tripletex_employee_id BIGINT NOT NULL,
    fornavn TEXT NOT NULL,
    etternavn TEXT NOT NULL,
    epost TEXT,
    aktiv BOOLEAN DEFAULT true,
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(org_id, tripletex_employee_id)
);

-- Create integration settings table
CREATE TABLE public.integration_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
    integration_type TEXT NOT NULL,
    settings JSONB NOT NULL DEFAULT '{}',
    aktiv BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(org_id, integration_type)
);

-- Enable Row Level Security on new tables
ALTER TABLE public.ttx_employee_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for ttx_employee_cache table
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

-- Create RLS policies for integration_settings table
CREATE POLICY "Users can view integration settings in their organization" 
ON public.integration_settings 
FOR SELECT 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage integration settings in their organization" 
ON public.integration_settings 
FOR ALL 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_ttx_employee_cache_updated_at
    BEFORE UPDATE ON public.ttx_employee_cache
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_integration_settings_updated_at
    BEFORE UPDATE ON public.integration_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_ttx_employee_cache_org_id ON public.ttx_employee_cache(org_id);
CREATE INDEX idx_ttx_employee_cache_tripletex_id ON public.ttx_employee_cache(tripletex_employee_id);
CREATE INDEX idx_ttx_employee_cache_epost ON public.ttx_employee_cache(epost);
CREATE INDEX idx_person_tripletex_employee_id ON public.person(tripletex_employee_id);
CREATE INDEX idx_vakt_timer_client_reference ON public.vakt_timer(client_reference);
CREATE INDEX idx_integration_settings_org_type ON public.integration_settings(org_id, integration_type);

-- Add function to generate client reference for idempotency
CREATE OR REPLACE FUNCTION public.generate_client_reference(org_uuid UUID, timer_uuid UUID)
RETURNS TEXT AS $$
BEGIN
    RETURN org_uuid::text || '-' || timer_uuid::text;
END;
$$ LANGUAGE plpgsql IMMUTABLE;