-- Create organizations table
CREATE TABLE public.org (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    org_nr TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table for additional user information
CREATE TABLE public.profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
    display_name TEXT,
    role TEXT DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create person table for staff members
CREATE TABLE public.person (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
    fornavn TEXT NOT NULL,
    etternavn TEXT NOT NULL,
    aktiv BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create project cache table for Tripletex projects
CREATE TABLE public.ttx_project_cache (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
    project_number INTEGER,
    project_name TEXT,
    customer_name TEXT,
    is_active BOOLEAN DEFAULT true,
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vakt (shift) table
CREATE TABLE public.vakt (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES public.person(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.ttx_project_cache(id) ON DELETE SET NULL,
    dato DATE NOT NULL,
    start_tid TIME,
    slutt_tid TIME,
    beskrivelse TEXT,
    timer DECIMAL(4,2),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create vakt_kommentar table for shift comments
CREATE TABLE public.vakt_kommentar (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
    vakt_id UUID NOT NULL REFERENCES public.vakt(id) ON DELETE CASCADE,
    kommentar TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create vakt_vedlegg table for shift attachments
CREATE TABLE public.vakt_vedlegg (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
    vakt_id UUID NOT NULL REFERENCES public.vakt(id) ON DELETE CASCADE,
    filnavn TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create audit_log table for tracking changes
CREATE TABLE public.audit_log (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
    old_values JSONB,
    new_values JSONB,
    changed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.org ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ttx_project_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vakt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vakt_kommentar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vakt_vedlegg ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for org table
CREATE POLICY "Users can view their own organization" 
ON public.org 
FOR SELECT 
USING (
    id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can update their own organization" 
ON public.org 
FOR UPDATE 
USING (
    id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

-- Create RLS policies for profiles table
CREATE POLICY "Users can view profiles in their organization" 
ON public.profiles 
FOR SELECT 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Create RLS policies for person table
CREATE POLICY "Users can view persons in their organization" 
ON public.person 
FOR SELECT 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage persons in their organization" 
ON public.person 
FOR ALL 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

-- Create RLS policies for ttx_project_cache table
CREATE POLICY "Users can view projects in their organization" 
ON public.ttx_project_cache 
FOR SELECT 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage projects in their organization" 
ON public.ttx_project_cache 
FOR ALL 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

-- Create RLS policies for vakt table
CREATE POLICY "Users can view shifts in their organization" 
ON public.vakt 
FOR SELECT 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage shifts in their organization" 
ON public.vakt 
FOR ALL 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

-- Create RLS policies for vakt_kommentar table
CREATE POLICY "Users can view comments in their organization" 
ON public.vakt_kommentar 
FOR SELECT 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage comments in their organization" 
ON public.vakt_kommentar 
FOR ALL 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

-- Create RLS policies for vakt_vedlegg table
CREATE POLICY "Users can view attachments in their organization" 
ON public.vakt_vedlegg 
FOR SELECT 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage attachments in their organization" 
ON public.vakt_vedlegg 
FOR ALL 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

-- Create RLS policies for audit_log table
CREATE POLICY "Users can view audit logs in their organization" 
ON public.audit_log 
FOR SELECT 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_org_updated_at
    BEFORE UPDATE ON public.org
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_person_updated_at
    BEFORE UPDATE ON public.person
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ttx_project_cache_updated_at
    BEFORE UPDATE ON public.ttx_project_cache
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vakt_updated_at
    BEFORE UPDATE ON public.vakt
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_org_id ON public.profiles(org_id);
CREATE INDEX idx_person_org_id ON public.person(org_id);
CREATE INDEX idx_ttx_project_cache_org_id ON public.ttx_project_cache(org_id);
CREATE INDEX idx_vakt_org_id ON public.vakt(org_id);
CREATE INDEX idx_vakt_person_id ON public.vakt(person_id);
CREATE INDEX idx_vakt_dato ON public.vakt(dato);
CREATE INDEX idx_vakt_kommentar_vakt_id ON public.vakt_kommentar(vakt_id);
CREATE INDEX idx_vakt_vedlegg_vakt_id ON public.vakt_vedlegg(vakt_id);
CREATE INDEX idx_audit_log_org_id ON public.audit_log(org_id);

-- Create storage bucket for private attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('vakt-vedlegg', 'vakt-vedlegg', false);

-- Create storage policies for vakt-vedlegg bucket
CREATE POLICY "Users can view attachments in their organization" 
ON storage.objects 
FOR SELECT 
USING (
    bucket_id = 'vakt-vedlegg' AND 
    name LIKE auth.uid()::text || '/%'
);

CREATE POLICY "Users can upload attachments" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
    bucket_id = 'vakt-vedlegg' AND 
    auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update their attachments" 
ON storage.objects 
FOR UPDATE 
USING (
    bucket_id = 'vakt-vedlegg' AND 
    name LIKE auth.uid()::text || '/%'
);

CREATE POLICY "Users can delete their attachments" 
ON storage.objects 
FOR DELETE 
USING (
    bucket_id = 'vakt-vedlegg' AND 
    name LIKE auth.uid()::text || '/%'
);