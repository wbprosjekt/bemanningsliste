-- Create underleverandorer table for subcontractors
CREATE TABLE public.underleverandorer (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
    navn TEXT NOT NULL,
    kontaktperson TEXT,
    epost TEXT,
    telefon TEXT,
    adresse TEXT,
    organisasjonsnummer TEXT,
    timepris DECIMAL(10,2),
    aktiv BOOLEAN DEFAULT true,
    notater TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add type field to person table to distinguish employees from subcontractors
ALTER TABLE public.person 
ADD COLUMN person_type TEXT DEFAULT 'ansatt' CHECK (person_type IN ('ansatt', 'underleverandor'));

-- Add reference to subcontractor in person table
ALTER TABLE public.person 
ADD COLUMN underleverandor_id UUID REFERENCES public.underleverandorer(id) ON DELETE SET NULL;

-- Enable Row Level Security
ALTER TABLE public.underleverandorer ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for underleverandorer table
CREATE POLICY "Users can view subcontractors in their organization" 
ON public.underleverandorer 
FOR SELECT 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage subcontractors in their organization" 
ON public.underleverandorer 
FOR ALL 
USING (
    org_id IN (
        SELECT org_id FROM public.profiles WHERE user_id = auth.uid()
    )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_underleverandorer_updated_at
    BEFORE UPDATE ON public.underleverandorer
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_underleverandorer_org_id ON public.underleverandorer(org_id);
CREATE INDEX idx_underleverandorer_aktiv ON public.underleverandorer(aktiv);
CREATE INDEX idx_person_underleverandor_id ON public.person(underleverandor_id);
CREATE INDEX idx_person_type ON public.person(person_type);