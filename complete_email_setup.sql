-- Complete email system setup
-- Run this in Supabase SQL Editor

-- First, create email_templates table (from reminder system migration)
CREATE TABLE IF NOT EXISTS public.email_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
    template_type TEXT NOT NULL CHECK (template_type IN ('payroll', 'weekly', 'test')),
    
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb, -- Array of available variables
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one template per type per organization
    UNIQUE(org_id, template_type)
);

-- Enable RLS on email_templates
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for email_templates
DROP POLICY IF EXISTS "Users can view email templates in their organization" ON public.email_templates;
DROP POLICY IF EXISTS "Admin/Manager can update email templates in their organization" ON public.email_templates;
DROP POLICY IF EXISTS "Admin/Manager can insert email templates in their organization" ON public.email_templates;
DROP POLICY IF EXISTS "Service role can manage email templates" ON public.email_templates;

CREATE POLICY "Users can view email templates in their organization" 
ON public.email_templates 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND org_id = email_templates.org_id 
        AND role IN ('admin', 'manager')
    )
);

CREATE POLICY "Admin/Manager can update email templates in their organization" 
ON public.email_templates 
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND org_id = email_templates.org_id 
        AND role IN ('admin', 'manager')
    )
);

CREATE POLICY "Admin/Manager can insert email templates in their organization" 
ON public.email_templates 
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND org_id = email_templates.org_id 
        AND role IN ('admin', 'manager')
    )
);

CREATE POLICY "Service role can manage email templates" 
ON public.email_templates 
FOR ALL 
USING (auth.role() = 'service_role');

-- Create reminder_logs table
CREATE TABLE IF NOT EXISTS public.reminder_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
    reminder_type TEXT NOT NULL CHECK (reminder_type IN ('payroll', 'weekly', 'test')),
    
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    recipients_count INTEGER DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial')),
    error_message TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on reminder_logs
ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage reminder logs" 
ON public.reminder_logs 
FOR ALL 
USING (auth.role() = 'service_role');

-- Now insert default email templates for all existing organizations
INSERT INTO public.email_templates (org_id, template_type, subject, body_html, body_text, variables)
SELECT 
    o.id as org_id,
    'test' as template_type,
    'Test e-post fra Bemanningsliste' as subject,
    '<h2>Test e-post</h2>
    <p>Hei {{navn}},</p>
    <p>Dette er en test e-post sendt {{dato}} for å verifisere at e-post systemet fungerer korrekt.</p>
    <p>Hvis du mottar denne e-posten, betyr det at e-post konfigurasjonen er riktig satt opp.</p>
    <br>
    <p>Med vennlig hilsen,<br>Bemanningsliste systemet</p>' as body_html,
    'Test e-post

Hei {{navn}},

Dette er en test e-post sendt {{dato}} for å verifisere at e-post systemet fungerer korrekt.

Hvis du mottar denne e-posten, betyr det at e-post konfigurasjonen er riktig satt opp.

Med vennlig hilsen,
Bemanningsliste systemet' as body_text,
'["navn", "dato"]'::jsonb as variables
FROM public.org o
WHERE NOT EXISTS (
    SELECT 1 FROM public.email_templates et 
    WHERE et.org_id = o.id AND et.template_type = 'test'
);

-- Insert default payroll reminder template
INSERT INTO public.email_templates (org_id, template_type, subject, body_html, body_text, variables)
SELECT 
    o.id as org_id,
    'payroll' as template_type,
    'Påminnelse: Lønnslister må fylles ut' as subject,
    '<h2>Påminnelse om lønnslister</h2>
    <p>Hei {{navn}},</p>
    <p>Dette er en påminnelse om at lønnslister må fylles ut innen {{dato}}.</p>
    <p>Vennligst logg inn på <a href="{{site_url}}">{{site_url}}</a> for å fylle ut timene dine.</p>
    <br>
    <p>Med vennlig hilsen,<br>Bemanningsliste systemet</p>' as body_html,
    'Påminnelse om lønnslister

Hei {{navn}},

Dette er en påminnelse om at lønnslister må fylles ut innen {{dato}}.

Vennligst logg inn på {{site_url}} for å fylle ut timene dine.

Med vennlig hilsen,
Bemanningsliste systemet' as body_text,
'["navn", "dato", "site_url"]'::jsonb as variables
FROM public.org o
WHERE NOT EXISTS (
    SELECT 1 FROM public.email_templates et 
    WHERE et.org_id = o.id AND et.template_type = 'payroll'
);

-- Insert default weekly reminder template
INSERT INTO public.email_templates (org_id, template_type, subject, body_html, body_text, variables)
SELECT 
    o.id as org_id,
    'weekly' as template_type,
    'Ukentlig påminnelse: Fyll ut timene dine' as subject,
    '<h2>Ukentlig påminnelse</h2>
    <p>Hei {{navn}},</p>
    <p>Dette er en ukentlig påminnelse om å fylle ut timene dine for uke {{uke}}.</p>
    <p>Vennligst logg inn på <a href="{{site_url}}">{{site_url}}</a> for å registrere timene dine.</p>
    <br>
    <p>Med vennlig hilsen,<br>Bemanningsliste systemet</p>' as body_html,
    'Ukentlig påminnelse

Hei {{navn}},

Dette er en ukentlig påminnelse om å fylle ut timene dine for uke {{uke}}.

Vennligst logg inn på {{site_url}} for å registrere timene dine.

Med vennlig hilsen,
Bemanningsliste systemet' as body_text,
'["navn", "uke", "site_url"]'::jsonb as variables
FROM public.org o
WHERE NOT EXISTS (
    SELECT 1 FROM public.email_templates et 
    WHERE et.org_id = o.id AND et.template_type = 'weekly'
);
