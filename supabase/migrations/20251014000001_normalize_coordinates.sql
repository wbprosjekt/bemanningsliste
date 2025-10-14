-- =====================================================
-- MIGRASJON: Normaliserte koordinater for zoom-safe pins
-- Dato: 14. oktober 2025
-- Beskrivelse: Konverterer pixel-baserte koordinater til 
--              normaliserte koordinater (0-1) for korrekt
--              visning ved zoom/pan/resize
-- =====================================================

-- STEG 1: Legg til normaliserte koordinater på oppgaver
-- -------------------------------------------------------
-- x_normalized og y_normalized er desimaltall mellom 0 og 1
-- Eksempel: 0.5 = 50% fra venstre/topp
ALTER TABLE oppgaver
ADD COLUMN x_normalized decimal(5,4),  -- 4 desimaler (0.0000 - 1.0000)
ADD COLUMN y_normalized decimal(5,4);

-- Legg til kommentar for dokumentasjon
COMMENT ON COLUMN oppgaver.x_normalized IS 'Normalisert X-koordinat (0-1) for zoom-safe rendering';
COMMENT ON COLUMN oppgaver.y_normalized IS 'Normalisert Y-koordinat (0-1) for zoom-safe rendering';

-- STEG 2: Legg til original dimensions på plantegninger
-- -------------------------------------------------------
-- Vi trenger original bredde/høyde for å kunne konvertere
ALTER TABLE plantegninger
ADD COLUMN original_width integer,
ADD COLUMN original_height integer;

-- Legg til kommentar
COMMENT ON COLUMN plantegninger.original_width IS 'Original bredde i piksler (fra PDF/bilde)';
COMMENT ON COLUMN plantegninger.original_height IS 'Original høyde i piksler (fra PDF/bilde)';

-- STEG 3: Konverter eksisterende oppgaver (hvis dimensions finnes)
-- -------------------------------------------------------
-- VIKTIG: Dette fungerer kun hvis plantegninger allerede har dimensions
-- Hvis ikke, må dimensions hentes fra PDF/bilde først

UPDATE oppgaver o
SET 
  x_normalized = CASE 
    WHEN p.original_width > 0 AND o.x_position IS NOT NULL 
    THEN o.x_position::decimal / p.original_width
    ELSE NULL
  END,
  y_normalized = CASE 
    WHEN p.original_height > 0 AND o.y_position IS NOT NULL 
    THEN o.y_position::decimal / p.original_height
    ELSE NULL
  END
FROM plantegninger p
WHERE o.plantegning_id = p.id
  AND p.original_width IS NOT NULL
  AND p.original_height IS NOT NULL;

-- STEG 4: Lag indekser for ytelse
-- -------------------------------------------------------
CREATE INDEX idx_oppgaver_normalized_coords 
ON oppgaver(plantegning_id, x_normalized, y_normalized)
WHERE x_normalized IS NOT NULL;

-- STEG 5: Validering
-- -------------------------------------------------------
-- Sjekk at normalized coords er mellom 0 og 1
DO $$
DECLARE
  invalid_count integer;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM oppgaver
  WHERE (x_normalized < 0 OR x_normalized > 1)
     OR (y_normalized < 0 OR y_normalized > 1);
  
  IF invalid_count > 0 THEN
    RAISE WARNING 'Fant % oppgaver med ugyldige normaliserte koordinater', invalid_count;
  ELSE
    RAISE NOTICE 'Alle normaliserte koordinater er gyldige (0-1)';
  END IF;
END $$;

-- STEG 6: Oppdater RLS policies (hvis nødvendig)
-- -------------------------------------------------------
-- Ingen endringer nødvendig - normalized coords arver samme policies

-- VIKTIG NOTATER:
-- -------------------------------------------------------
-- 1. Vi beholder x_position og y_position for bakoverkompatibilitet
-- 2. Client-kode må oppdateres til å bruke normalized først, fallback til position
-- 3. Når alt er verifisert, kan vi droppe gamle kolonner (separat migrering)
-- 4. Plantegninger uten dimensions kan ikke konverteres automatisk

-- Logging
DO $$
DECLARE
  total_oppgaver integer;
  normalized_oppgaver integer;
  missing_dimensions integer;
BEGIN
  SELECT COUNT(*) INTO total_oppgaver FROM oppgaver WHERE plantegning_id IS NOT NULL;
  SELECT COUNT(*) INTO normalized_oppgaver FROM oppgaver WHERE x_normalized IS NOT NULL;
  SELECT COUNT(*) INTO missing_dimensions FROM plantegninger WHERE original_width IS NULL;
  
  RAISE NOTICE '====================================';
  RAISE NOTICE 'NORMALISERTE KOORDINATER - MIGRERING';
  RAISE NOTICE '====================================';
  RAISE NOTICE 'Totalt oppgaver med plantegning: %', total_oppgaver;
  RAISE NOTICE 'Oppgaver med normalized coords: %', normalized_oppgaver;
  RAISE NOTICE 'Plantegninger uten dimensions: %', missing_dimensions;
  RAISE NOTICE '';
  
  IF missing_dimensions > 0 THEN
    RAISE WARNING 'Enkelte plantegninger mangler dimensions - disse må hentes fra PDF/bilde';
  END IF;
  
  IF normalized_oppgaver = total_oppgaver THEN
    RAISE NOTICE '✅ SUKSESS: Alle oppgaver er konvertert til normalized coords';
  ELSIF normalized_oppgaver > 0 THEN
    RAISE NOTICE '⚠️  DELVIS: % av % oppgaver konvertert', normalized_oppgaver, total_oppgaver;
  ELSE
    RAISE NOTICE '⚠️  INFO: Ingen oppgaver konvertert (mangler dimensions på plantegninger)';
  END IF;
END $$;

