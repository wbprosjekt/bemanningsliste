-- Add test data for befaring system

-- Insert test underleverandorer (replace with actual org_id)
INSERT INTO public.underleverandorer (org_id, navn, epost, telefon, fag)
VALUES 
  ('your-org-id-here', 'EL-Partner AS', 'post@elpartner.no', '12345678', ARRAY['elektriker']),
  ('your-org-id-here', 'Rør & Varme AS', 'info@roervarme.no', '87654321', ARRAY['vvs', 'rørlegger']),
  ('your-org-id-here', 'Byggteknikk AS', 'kontakt@byggteknikk.no', '11223344', ARRAY['tømrer', 'murer']),
  ('your-org-id-here', 'Maler & Dekor AS', 'post@maler.no', '55667788', ARRAY['maler']),
  ('your-org-id-here', 'Flislegging Pro', 'info@flislegging.no', '99887766', ARRAY['flislegger']),
  ('your-org-id-here', 'Glassmester Hans', 'hans@glass.no', '44332211', ARRAY['glassmester']),
  ('your-org-id-here', 'Klima & Vent', 'klima@vent.no', '77889900', ARRAY['klima', 'ventilasjon'])
ON CONFLICT DO NOTHING;

-- Note: Replace 'your-org-id-here' with actual org_id from your database
-- You can find your org_id by running:
-- SELECT id, navn FROM public.org;

