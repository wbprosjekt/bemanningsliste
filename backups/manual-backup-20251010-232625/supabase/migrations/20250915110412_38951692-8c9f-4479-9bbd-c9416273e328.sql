-- Add forventet_dagstimer to person table
ALTER TABLE public.person 
ADD COLUMN forventet_dagstimer DECIMAL(4,2) DEFAULT 8.0;

-- Create vakt_timer table for time logging entries
CREATE TABLE public.vakt_timer (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
    vakt_id UUID NOT NULL REFERENCES public.vakt(id) ON DELETE CASCADE,
    timer DECIMAL(4,2) NOT NULL CHECK (timer::numeric % 0.25 = 0), -- Validate 0.25 steps
    aktivitet_id UUID REFERENCES public.ttx_activity_cache(id) ON DELETE SET NULL,
    notat TEXT,
    status TEXT DEFAULT 'utkast' CHECK (status IN ('utkast', 'sendt', 'godkjent')),
    lonnstype TEXT DEFAULT 'normal',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create person_prosjekt_pref table for project preferences
CREATE TABLE public.person_prosjekt_pref (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES public.person(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.ttx_project_cache(id) ON DELETE CASCADE,
    last_aktivitet_id UUID REFERENCES public.ttx_activity_cache(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(person_id, project_id)
);

-- Create ttx_activity_cache table for Tripletex activities
CREATE TABLE public.ttx_activity_cache (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
    ttx_id BIGINT, -- Tripletex activity ID
    navn TEXT NOT NULL,
    aktiv BOOLEAN DEFAULT true,
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security on new tables
ALTER TABLE public.vakt_timer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_prosjekt_pref ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ttx_activity_cache ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for vakt_timer table
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

-- Create RLS policies for person_prosjekt_pref table
CREATE POLICY "Users can view project preferences in their organization" 
ON public.person_prosjekt_pref 
FOR SELECT 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage project preferences in their organization" 
ON public.person_prosjekt_pref 
FOR ALL 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

-- Create RLS policies for ttx_activity_cache table
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

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_vakt_timer_updated_at
    BEFORE UPDATE ON public.vakt_timer
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_person_prosjekt_pref_updated_at
    BEFORE UPDATE ON public.person_prosjekt_pref
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ttx_activity_cache_updated_at
    BEFORE UPDATE ON public.ttx_activity_cache
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_vakt_timer_org_id ON public.vakt_timer(org_id);
CREATE INDEX idx_vakt_timer_vakt_id ON public.vakt_timer(vakt_id);
CREATE INDEX idx_person_prosjekt_pref_person_project ON public.person_prosjekt_pref(person_id, project_id);
CREATE INDEX idx_ttx_activity_cache_org_id ON public.ttx_activity_cache(org_id);
CREATE INDEX idx_ttx_activity_cache_aktiv ON public.ttx_activity_cache(aktiv);

-- Add some sample activity data for testing
INSERT INTO public.ttx_activity_cache (org_id, ttx_id, navn, aktiv) VALUES
-- We'll need to get org_id from actual orgs later, for now using placeholder
((SELECT id FROM public.org LIMIT 1), 1001, 'Utvikling', true),
((SELECT id FROM public.org LIMIT 1), 1002, 'Testing', true),
((SELECT id FROM public.org LIMIT 1), 1003, 'Dokumentasjon', true),
((SELECT id FROM public.org LIMIT 1), 1004, 'Møter', true),
((SELECT id FROM public.org LIMIT 1), 1005, 'Support', true);