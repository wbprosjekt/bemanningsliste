-- =====================================================
-- MIGRASJON: Bilde-optimalisering (Presigned URLs + Thumbnails)
-- Dato: 14. oktober 2025
-- Beskrivelse: Legger til støtte for presigned uploads,
--              thumbnail-generering og webp-format
-- =====================================================

-- STEG 1: Legg til nye kolonner for bilde-optimalisering
-- -------------------------------------------------------
ALTER TABLE oppgave_bilder
ADD COLUMN storage_path text,              -- 'projects/{id}/images/{uuid}.webp'
ADD COLUMN thumbnail_1024_path text,       -- Path til 1024px thumbnail
ADD COLUMN thumbnail_2048_path text,       -- Path til 2048px thumbnail
ADD COLUMN original_width integer,         -- Original bredde i piksler
ADD COLUMN original_height integer,        -- Original høyde i piksler
ADD COLUMN file_format text DEFAULT 'webp', -- 'webp', 'jpeg', 'png'
ADD COLUMN is_optimized boolean DEFAULT false, -- Om thumbnails er generert
ADD COLUMN file_size_bytes bigint;         -- Filstørrelse i bytes

-- Legg til kommentarer
COMMENT ON COLUMN oppgave_bilder.storage_path IS 'Full path i Supabase Storage';
COMMENT ON COLUMN oppgave_bilder.thumbnail_1024_path IS 'Path til 1024px thumbnail (for liste-visning)';
COMMENT ON COLUMN oppgave_bilder.thumbnail_2048_path IS 'Path til 2048px thumbnail (for preview)';
COMMENT ON COLUMN oppgave_bilder.is_optimized IS 'True når thumbnails er generert';

-- STEG 2: Oppdater eksisterende bilder (sett storage_path fra file_url)
-- -------------------------------------------------------
-- Hvis file_url allerede eksisterer, kopier til storage_path
UPDATE oppgave_bilder
SET storage_path = file_url
WHERE file_url IS NOT NULL AND storage_path IS NULL;

-- STEG 3: Legg til foto-innboks funksjonalitet
-- -------------------------------------------------------
-- Disse kolonnene støtter "inbox" workflow hvor bilder
-- kan lastes opp uten befaring/oppgave og tagges senere

-- Allerede eksisterende (fra tidligere migrering):
-- - is_tagged boolean DEFAULT false
-- - inbox_date timestamp DEFAULT now()
-- - tagged_by uuid REFERENCES auth.users(id)
-- - tagged_at timestamp

-- Hvis disse IKKE eksisterer, legg dem til:
DO $$
BEGIN
  -- Sjekk om is_tagged finnes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'oppgave_bilder' AND column_name = 'is_tagged'
  ) THEN
    ALTER TABLE oppgave_bilder ADD COLUMN is_tagged boolean DEFAULT false;
  END IF;
  
  -- Sjekk om inbox_date finnes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'oppgave_bilder' AND column_name = 'inbox_date'
  ) THEN
    ALTER TABLE oppgave_bilder ADD COLUMN inbox_date timestamp DEFAULT now();
  END IF;
  
  -- Sjekk om tagged_by finnes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'oppgave_bilder' AND column_name = 'tagged_by'
  ) THEN
    ALTER TABLE oppgave_bilder ADD COLUMN tagged_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Sjekk om tagged_at finnes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'oppgave_bilder' AND column_name = 'tagged_at'
  ) THEN
    ALTER TABLE oppgave_bilder ADD COLUMN tagged_at timestamp;
  END IF;
  
  -- Sjekk om prosjekt_id finnes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'oppgave_bilder' AND column_name = 'prosjekt_id'
  ) THEN
    ALTER TABLE oppgave_bilder ADD COLUMN prosjekt_id uuid REFERENCES ttx_project_cache(id);
  END IF;
END $$;

-- Marker eksisterende bilder som "tagged" (de har allerede befaring/oppgave)
UPDATE oppgave_bilder
SET is_tagged = true
WHERE (befaring_id IS NOT NULL OR oppgave_id IS NOT NULL)
  AND is_tagged = false;

-- STEG 4: Indekser for performance
-- -------------------------------------------------------
-- Indeks for inbox (utaggede bilder per prosjekt)
CREATE INDEX IF NOT EXISTS idx_oppgave_bilder_inbox 
ON oppgave_bilder(prosjekt_id, inbox_date DESC) 
WHERE is_tagged = false;

-- Indeks for storage_path (rask lookup)
CREATE INDEX IF NOT EXISTS idx_oppgave_bilder_storage 
ON oppgave_bilder(storage_path);

-- Indeks for optimalisering-jobb (finn bilder som trenger thumbnails)
CREATE INDEX IF NOT EXISTS idx_oppgave_bilder_optimization 
ON oppgave_bilder(is_optimized, uploaded_at DESC) 
WHERE is_optimized = false;

-- Indeks for prosjekt (foto-innboks query)
CREATE INDEX IF NOT EXISTS idx_oppgave_bilder_prosjekt 
ON oppgave_bilder(prosjekt_id, is_tagged);

-- STEG 5: Lag view for foto-innboks (prosjekt-gruppert)
-- -------------------------------------------------------
CREATE OR REPLACE VIEW project_photo_inbox AS
SELECT 
  p.id as project_id,
  p.project_name,
  p.project_number,
  p.org_id,
  COUNT(ob.id) as untagged_count,
  array_agg(
    jsonb_build_object(
      'id', ob.id,
      'file_url', COALESCE(ob.storage_path, ob.file_url),
      'thumbnail_1024', ob.thumbnail_1024_path,
      'thumbnail_2048', ob.thumbnail_2048_path,
      'file_name', ob.file_name,
      'uploaded_by', pr.display_name,
      'uploaded_at', ob.uploaded_at,
      'file_size', ob.file_size_bytes,
      'is_optimized', ob.is_optimized
    ) ORDER BY ob.uploaded_at DESC
  ) FILTER (WHERE ob.id IS NOT NULL) as images
FROM ttx_project_cache p
LEFT JOIN oppgave_bilder ob ON ob.prosjekt_id = p.id AND ob.is_tagged = false
LEFT JOIN profiles pr ON ob.uploaded_by = pr.user_id
WHERE p.is_active = true
GROUP BY p.id, p.project_name, p.project_number, p.org_id
HAVING COUNT(ob.id) > 0;

-- Grant access
GRANT SELECT ON project_photo_inbox TO authenticated;

COMMENT ON VIEW project_photo_inbox IS 'Foto-innboks gruppert per prosjekt (kun utaggede bilder)';

-- STEG 6: Validering og logging
-- -------------------------------------------------------
DO $$
DECLARE
  total_images integer;
  tagged_images integer;
  inbox_images integer;
  optimized_images integer;
  projects_with_inbox integer;
BEGIN
  SELECT COUNT(*) INTO total_images FROM oppgave_bilder;
  SELECT COUNT(*) INTO tagged_images FROM oppgave_bilder WHERE is_tagged = true;
  SELECT COUNT(*) INTO inbox_images FROM oppgave_bilder WHERE is_tagged = false;
  SELECT COUNT(*) INTO optimized_images FROM oppgave_bilder WHERE is_optimized = true;
  SELECT COUNT(*) INTO projects_with_inbox FROM project_photo_inbox;
  
  RAISE NOTICE '====================================';
  RAISE NOTICE 'BILDE-OPTIMALISERING - MIGRERING';
  RAISE NOTICE '====================================';
  RAISE NOTICE 'Totalt bilder: %', total_images;
  RAISE NOTICE 'Tagged bilder: %', tagged_images;
  RAISE NOTICE 'Inbox bilder: %', inbox_images;
  RAISE NOTICE 'Optimaliserte bilder: %', optimized_images;
  RAISE NOTICE 'Prosjekter med inbox: %', projects_with_inbox;
  RAISE NOTICE '';
  
  IF inbox_images > 0 THEN
    RAISE NOTICE '⚠️  INFO: % bilder i inbox - disse kan tagges via foto-innboks', inbox_images;
  END IF;
  
  IF optimized_images = 0 THEN
    RAISE NOTICE '⚠️  INFO: Ingen bilder er optimalisert enda - thumbnails genereres ved neste opplasting';
  END IF;
  
  RAISE NOTICE '✅ SUKSESS: Bilde-optimalisering migrering fullført';
END $$;

