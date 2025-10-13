-- ============================================================
-- BULLETPROOF BEFARING FOREIGN KEYS MIGRATION
-- ============================================================
-- Strategy:
-- 1. DROP all foreign key constraints FIRST (allow any values temporarily)
-- 2. Clean up and migrate data
-- 3. ADD new foreign key constraints LAST (validate against auth.users)
-- ============================================================

-- ============================================================
-- PHASE 1: DROP ALL FOREIGN KEY CONSTRAINTS
-- ============================================================
-- This allows us to freely update data without validation errors

DO $$
BEGIN
  RAISE NOTICE '=== PHASE 1: Dropping foreign key constraints ===';
END $$;

-- Drop befaringer.created_by constraint
ALTER TABLE public.befaringer
  DROP CONSTRAINT IF EXISTS befaringer_created_by_fkey;

-- Drop oppgaver.created_by constraint
ALTER TABLE public.oppgaver
  DROP CONSTRAINT IF EXISTS oppgaver_created_by_fkey;

-- Drop oppgave_kommentarer.created_by constraint
ALTER TABLE public.oppgave_kommentarer
  DROP CONSTRAINT IF EXISTS oppgave_kommentarer_created_by_fkey;

-- Drop oppgave_historikk.endret_av constraint
ALTER TABLE public.oppgave_historikk
  DROP CONSTRAINT IF EXISTS oppgave_historikk_endret_av_fkey;

-- Drop notifikasjoner.bruker_id constraint
ALTER TABLE public.notifikasjoner
  DROP CONSTRAINT IF EXISTS notifikasjoner_bruker_id_fkey;

DO $$
BEGIN
  RAISE NOTICE '✅ All foreign key constraints dropped';
END $$;

-- ============================================================
-- PHASE 2: ANALYZE EXISTING DATA
-- ============================================================

DO $$
DECLARE
  total_befaringer INTEGER;
  orphaned_befaringer INTEGER;
  total_oppgaver INTEGER;
  orphaned_oppgaver INTEGER;
BEGIN
  RAISE NOTICE '=== PHASE 2: Analyzing existing data ===';
  
  -- Check befaringer
  SELECT COUNT(*) INTO total_befaringer FROM public.befaringer;
  SELECT COUNT(*) INTO orphaned_befaringer
  FROM public.befaringer b
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = b.created_by
  );
  
  RAISE NOTICE 'Befaringer: % total, % orphaned', total_befaringer, orphaned_befaringer;
  
  -- Check oppgaver
  SELECT COUNT(*) INTO total_oppgaver FROM public.oppgaver;
  SELECT COUNT(*) INTO orphaned_oppgaver
  FROM public.oppgaver o
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = o.created_by
  );
  
  RAISE NOTICE 'Oppgaver: % total, % orphaned', total_oppgaver, orphaned_oppgaver;
END $$;

-- ============================================================
-- PHASE 3: MIGRATE DATA
-- ============================================================

DO $$
DECLARE
  default_user_id UUID;
  rows_updated INTEGER;
BEGIN
  RAISE NOTICE '=== PHASE 3: Migrating data ===';
  
  -- Find a default user for orphaned records
  -- Try to get an admin user first
  SELECT user_id INTO default_user_id
  FROM public.profiles
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;
  
  -- If no admin, get any user
  IF default_user_id IS NULL THEN
    SELECT user_id INTO default_user_id
    FROM public.profiles
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;
  
  IF default_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found in profiles table! Cannot proceed.';
  END IF;
  
  RAISE NOTICE 'Default user for orphaned records: %', default_user_id;
  
  -- ===== BEFARINGER =====
  RAISE NOTICE 'Migrating befaringer...';
  
  -- Update orphaned befaringer first
  UPDATE public.befaringer
  SET created_by = default_user_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = befaringer.created_by
  );
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE '  - Updated % orphaned befaringer to default user', rows_updated;
  
  -- Migrate valid befaringer from profiles.id to user_id
  UPDATE public.befaringer b
  SET created_by = p.user_id
  FROM public.profiles p
  WHERE b.created_by = p.id;
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE '  - Migrated % valid befaringer', rows_updated;
  
  -- ===== OPPGAVER =====
  RAISE NOTICE 'Migrating oppgaver...';
  
  -- Update orphaned oppgaver
  UPDATE public.oppgaver
  SET created_by = default_user_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = oppgaver.created_by
  );
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE '  - Updated % orphaned oppgaver to default user', rows_updated;
  
  -- Migrate valid oppgaver
  UPDATE public.oppgaver o
  SET created_by = p.user_id
  FROM public.profiles p
  WHERE o.created_by = p.id;
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE '  - Migrated % valid oppgaver', rows_updated;
  
  -- ===== OPPGAVE_KOMMENTARER =====
  RAISE NOTICE 'Migrating oppgave_kommentarer...';
  
  -- Update orphaned
  UPDATE public.oppgave_kommentarer
  SET created_by = default_user_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = oppgave_kommentarer.created_by
  );
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE '  - Updated % orphaned kommentarer to default user', rows_updated;
  
  -- Migrate valid
  UPDATE public.oppgave_kommentarer ok
  SET created_by = p.user_id
  FROM public.profiles p
  WHERE ok.created_by = p.id;
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE '  - Migrated % valid kommentarer', rows_updated;
  
  -- ===== OPPGAVE_HISTORIKK =====
  RAISE NOTICE 'Migrating oppgave_historikk...';
  
  -- Update orphaned
  UPDATE public.oppgave_historikk
  SET endret_av = default_user_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = oppgave_historikk.endret_av
  );
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE '  - Updated % orphaned historikk to default user', rows_updated;
  
  -- Migrate valid
  UPDATE public.oppgave_historikk oh
  SET endret_av = p.user_id
  FROM public.profiles p
  WHERE oh.endret_av = p.id;
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE '  - Migrated % valid historikk', rows_updated;
  
  -- ===== NOTIFIKASJONER =====
  RAISE NOTICE 'Migrating notifikasjoner...';
  
  -- Update orphaned
  UPDATE public.notifikasjoner
  SET bruker_id = default_user_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = notifikasjoner.bruker_id
  );
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE '  - Updated % orphaned notifikasjoner to default user', rows_updated;
  
  -- Migrate valid
  UPDATE public.notifikasjoner n
  SET bruker_id = p.user_id
  FROM public.profiles p
  WHERE n.bruker_id = p.id;
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE '  - Migrated % valid notifikasjoner', rows_updated;
  
  RAISE NOTICE '✅ All data migrated successfully';
END $$;

-- ============================================================
-- PHASE 4: VERIFY DATA INTEGRITY
-- ============================================================

DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  RAISE NOTICE '=== PHASE 4: Verifying data integrity ===';
  
  -- Check befaringer references
  SELECT COUNT(*) INTO invalid_count
  FROM public.befaringer b
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = b.created_by
  );
  
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Found % befaringer with invalid created_by references!', invalid_count;
  END IF;
  RAISE NOTICE '✅ Befaringer: All references valid';
  
  -- Check oppgaver references
  SELECT COUNT(*) INTO invalid_count
  FROM public.oppgaver o
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = o.created_by
  );
  
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Found % oppgaver with invalid created_by references!', invalid_count;
  END IF;
  RAISE NOTICE '✅ Oppgaver: All references valid';
  
  -- Check oppgave_kommentarer references
  SELECT COUNT(*) INTO invalid_count
  FROM public.oppgave_kommentarer ok
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = ok.created_by
  );
  
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Found % kommentarer with invalid created_by references!', invalid_count;
  END IF;
  RAISE NOTICE '✅ Kommentarer: All references valid';
  
  -- Check oppgave_historikk references
  SELECT COUNT(*) INTO invalid_count
  FROM public.oppgave_historikk oh
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = oh.endret_av
  );
  
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Found % historikk with invalid endret_av references!', invalid_count;
  END IF;
  RAISE NOTICE '✅ Historikk: All references valid';
  
  -- Check notifikasjoner references
  SELECT COUNT(*) INTO invalid_count
  FROM public.notifikasjoner n
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = n.bruker_id
  );
  
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Found % notifikasjoner with invalid bruker_id references!', invalid_count;
  END IF;
  RAISE NOTICE '✅ Notifikasjoner: All references valid';
  
  RAISE NOTICE '✅ All data integrity checks passed';
END $$;

-- ============================================================
-- PHASE 5: ADD NEW FOREIGN KEY CONSTRAINTS
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '=== PHASE 5: Adding new foreign key constraints ===';
END $$;

-- Add befaringer.created_by constraint
ALTER TABLE public.befaringer
  ADD CONSTRAINT befaringer_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id);

-- Add oppgaver.created_by constraint
ALTER TABLE public.oppgaver
  ADD CONSTRAINT oppgaver_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id);

-- Add oppgave_kommentarer.created_by constraint
ALTER TABLE public.oppgave_kommentarer
  ADD CONSTRAINT oppgave_kommentarer_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id);

-- Add oppgave_historikk.endret_av constraint
ALTER TABLE public.oppgave_historikk
  ADD CONSTRAINT oppgave_historikk_endret_av_fkey
  FOREIGN KEY (endret_av) REFERENCES auth.users(id);

-- Add notifikasjoner.bruker_id constraint
ALTER TABLE public.notifikasjoner
  ADD CONSTRAINT notifikasjoner_bruker_id_fkey
  FOREIGN KEY (bruker_id) REFERENCES auth.users(id);

DO $$
BEGIN
  RAISE NOTICE '✅ All foreign key constraints added';
END $$;

-- ============================================================
-- PHASE 6: ADD DOCUMENTATION
-- ============================================================

COMMENT ON COLUMN public.befaringer.created_by IS 'User ID (auth.uid) of creator';
COMMENT ON COLUMN public.oppgaver.created_by IS 'User ID (auth.uid) of creator';
COMMENT ON COLUMN public.oppgave_kommentarer.created_by IS 'User ID (auth.uid) of creator';
COMMENT ON COLUMN public.oppgave_historikk.endret_av IS 'User ID (auth.uid) of person who made the change';
COMMENT ON COLUMN public.notifikasjoner.bruker_id IS 'User ID (auth.uid) of recipient';

-- ============================================================
-- PHASE 7: REFRESH SCHEMA CACHE
-- ============================================================

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- FINAL SUCCESS MESSAGE
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ MIGRATION COMPLETED SUCCESSFULLY! ✅';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '- All foreign keys now point to auth.users(id)';
  RAISE NOTICE '- Orphaned records assigned to default user';
  RAISE NOTICE '- Data integrity verified';
  RAISE NOTICE '- Schema cache refreshed';
  RAISE NOTICE '';
END $$;


