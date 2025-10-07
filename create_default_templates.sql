-- Create default email templates for all organizations
-- Run this in Supabase SQL Editor

-- Insert default test email template for all existing organizations
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
