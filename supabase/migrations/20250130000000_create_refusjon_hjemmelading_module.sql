-- Migration: Refusjon hjemmelading module
-- Creates tables for CSV-based reimbursement system for electric car charging
-- Supports RFID validation, time-splitting, spot/Norgespris pricing, TOU nettariff, and effect tiers

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Chargers table (ladepunkt)
CREATE TABLE IF NOT EXISTS ref_chargers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  easee_charger_id TEXT,
  address TEXT,
  timezone TEXT NOT NULL DEFAULT 'Europe/Oslo',
  area TEXT NOT NULL CHECK (area IN ('NO1', 'NO2', 'NO3', 'NO4', 'NO5')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ref_chargers_unique ON ref_chargers(org_id, easee_charger_id) WHERE easee_charger_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ref_chargers_org ON ref_chargers(org_id);

-- 2. RFID Keys table
CREATE TABLE IF NOT EXISTS ref_rfid_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
  easee_key_id TEXT NOT NULL,
  label TEXT,
  type TEXT NOT NULL CHECK (type IN ('bedrift', 'privat')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ref_rfid_keys_unique ON ref_rfid_keys(org_id, easee_key_id);
CREATE INDEX IF NOT EXISTS idx_ref_rfid_keys_org ON ref_rfid_keys(org_id);

-- 3. Employee-RFID-Charger mapping table
CREATE TABLE IF NOT EXISTS ref_employee_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rfid_key_id UUID NOT NULL REFERENCES ref_rfid_keys(id) ON DELETE RESTRICT,
  charger_id UUID REFERENCES ref_chargers(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ref_employee_keys_unique ON ref_employee_keys(org_id, profile_id, rfid_key_id);
CREATE INDEX IF NOT EXISTS idx_ref_employee_keys_profile ON ref_employee_keys(profile_id);
CREATE INDEX IF NOT EXISTS idx_ref_employee_keys_rfid ON ref_employee_keys(rfid_key_id);
CREATE INDEX IF NOT EXISTS idx_ref_employee_keys_charger ON ref_employee_keys(charger_id);

-- 4. Nett profiles (TOU nettleie)
CREATE TABLE IF NOT EXISTS ref_nett_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Oslo',
  meta JSONB, -- effective_from, effective_to, holidays, includes_vat
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ref_nett_profiles_org ON ref_nett_profiles(org_id);

-- 5. Effect tiers (trinn for effektledd)
CREATE TABLE IF NOT EXISTS ref_effect_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  threshold_kw NUMERIC NOT NULL,
  monthly_fee_nok NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ref_effect_tiers_org ON ref_effect_tiers(org_id);

-- 6. Employee settings (prisstrategi per ansatt)
CREATE TABLE IF NOT EXISTS ref_employee_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  default_area TEXT CHECK (default_area IN ('NO1', 'NO2', 'NO3', 'NO4', 'NO5')),
  policy TEXT NOT NULL CHECK (policy IN ('norgespris', 'spot_med_stromstotte')),
  fastpris_nok_per_kwh NUMERIC,
  manedlig_tak_kwh NUMERIC,
  terskel_nok_per_kwh NUMERIC DEFAULT 0.75,
  stotte_andel NUMERIC DEFAULT 0.9,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  nett_profile_id UUID REFERENCES ref_nett_profiles(id),
  employee_effect_base_tier_id UUID REFERENCES ref_effect_tiers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ref_employee_settings_profile ON ref_employee_settings(profile_id, effective_from);
CREATE INDEX IF NOT EXISTS idx_ref_employee_settings_org ON ref_employee_settings(org_id);

-- 7. Energy prices (spot cache)
CREATE TABLE IF NOT EXISTS ref_energy_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'spot',
  area TEXT NOT NULL,
  ts_hour TIMESTAMPTZ NOT NULL,
  nok_per_kwh NUMERIC NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ref_energy_prices_unique ON ref_energy_prices(org_id, provider, area, ts_hour);
CREATE INDEX IF NOT EXISTS idx_ref_energy_prices_lookup ON ref_energy_prices(org_id, area, ts_hour);

-- 8. Nett windows (TOU timeintervaller)
CREATE TABLE IF NOT EXISTS ref_nett_windows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES ref_nett_profiles(id) ON DELETE CASCADE,
  dow INTEGER NOT NULL CHECK (dow BETWEEN 0 AND 6), -- 0=Mon, 6=Sun
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  energy_ore_per_kwh NUMERIC NOT NULL,
  time_ore_per_kwh NUMERIC DEFAULT 0,
  meta JSONB
);

CREATE INDEX IF NOT EXISTS idx_ref_nett_windows_profile ON ref_nett_windows(profile_id);

-- 9. Raw CSV sessions (for audit trail)
CREATE TABLE IF NOT EXISTS ref_sessions_raw (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_month DATE NOT NULL,
  csv_hash TEXT NOT NULL,
  row JSONB NOT NULL, -- original normalized CSV row
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ref_sessions_raw_lookup ON ref_sessions_raw(org_id, employee_id, period_month);
CREATE INDEX IF NOT EXISTS idx_ref_sessions_raw_hash ON ref_sessions_raw(csv_hash);

-- 10. Hourly split sessions (for pricing)
CREATE TABLE IF NOT EXISTS ref_sessions_hourly (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_month DATE NOT NULL,
  local_ts_hour TIMESTAMPTZ NOT NULL,
  kwh_bit NUMERIC NOT NULL,
  rfid_key_id UUID REFERENCES ref_rfid_keys(id),
  charger_id UUID REFERENCES ref_chargers(id),
  address TEXT,
  meta JSONB, -- for debugging/reference
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ref_sessions_hourly_lookup ON ref_sessions_hourly(org_id, employee_id, period_month);
CREATE INDEX IF NOT EXISTS idx_ref_sessions_hourly_time ON ref_sessions_hourly(local_ts_hour);

-- 11. Reimbursements (generated reports)
CREATE TABLE IF NOT EXISTS ref_reimbursements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_month DATE NOT NULL,
  total_kwh NUMERIC NOT NULL,
  total_energy_nok NUMERIC NOT NULL,
  total_nett_nok NUMERIC NOT NULL,
  total_support_nok NUMERIC NOT NULL,
  total_effect_nok NUMERIC DEFAULT 0,
  total_amount_nok NUMERIC NOT NULL,
  policy_snapshot JSONB, -- snapshot of policy used
  pdf_url TEXT,
  csv_url TEXT,
  meta JSONB, -- source: 'csv-easee-key-detailed', parameters used, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ref_reimbursements_unique ON ref_reimbursements(org_id, employee_id, period_month);
CREATE INDEX IF NOT EXISTS idx_ref_reimbursements_employee ON ref_reimbursements(employee_id);

-- 12. Profile modules (access control per module)
CREATE TABLE IF NOT EXISTS profile_modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL CHECK (module_name IN ('refusjon_hjemmelading', 'befaring', 'bemanningsliste')),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_modules_unique ON profile_modules(profile_id, module_name);
CREATE INDEX IF NOT EXISTS idx_profile_modules_lookup ON profile_modules(profile_id, module_name, enabled);

-- RLS Policies
ALTER TABLE ref_chargers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_rfid_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_employee_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_employee_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_energy_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_nett_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_nett_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_sessions_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_sessions_hourly ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_reimbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_effect_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_modules ENABLE ROW LEVEL SECURITY;

-- Chargers: admin/økonomi ser allt i org, ansatt ser ikke
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_chargers_select ON ref_chargers FOR SELECT
  USING (auth.jwt() ->> 'role' IN ('admin', 'økonomi') OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND org_id = ref_chargers.org_id
  ));

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_chargers_insert ON ref_chargers FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_chargers_update ON ref_chargers FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_chargers_delete ON ref_chargers FOR DELETE
  USING (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));

-- RFID Keys: admin/økonomi ser allt i org, ansatt ser ikke
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_rfid_keys_select ON ref_rfid_keys FOR SELECT
  USING (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_rfid_keys_insert ON ref_rfid_keys FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_rfid_keys_update ON ref_rfid_keys FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_rfid_keys_delete ON ref_rfid_keys FOR DELETE
  USING (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));

-- Employee Keys: admin/økonomi ser allt i org, ansatt ser ikke
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_employee_keys_select ON ref_employee_keys FOR SELECT
  USING (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_employee_keys_insert ON ref_employee_keys FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_employee_keys_update ON ref_employee_keys FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_employee_keys_delete ON ref_employee_keys FOR DELETE
  USING (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));

-- Employee Settings: ansatt ser kun egne, admin/økonomi ser allt i org
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_employee_settings_select ON ref_employee_settings FOR SELECT
  USING (profile_id = auth.uid() OR auth.jwt() ->> 'role' IN ('admin', 'økonomi'));

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_employee_settings_insert ON ref_employee_settings FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_employee_settings_update ON ref_employee_settings FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_employee_settings_delete ON ref_employee_settings FOR DELETE
  USING (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));

-- Energy Prices: admin/økonomi ser allt i org, ansatt ser ikke
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_energy_prices_select ON ref_energy_prices FOR SELECT
  USING (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_energy_prices_insert ON ref_energy_prices FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_energy_prices_update ON ref_energy_prices FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_energy_prices_delete ON ref_energy_prices FOR DELETE
  USING (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));

-- Nett Profiles: admin/økonomi ser allt i org, ansatt ser ikke
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_nett_profiles_select ON ref_nett_profiles FOR SELECT
  USING (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_nett_profiles_insert ON ref_nett_profiles FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_nett_profiles_update ON ref_nett_profiles FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_nett_profiles_delete ON ref_nett_profiles FOR DELETE
  USING (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));

-- Nett Windows: admin/økonomi ser allt, ansatt ser ikke
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_nett_windows_select ON ref_nett_windows FOR SELECT
  USING (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_nett_windows_insert ON ref_nett_windows FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_nett_windows_update ON ref_nett_windows FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_nett_windows_delete ON ref_nett_windows FOR DELETE
  USING (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));

-- Sessions Raw: ansatt ser kun egne, admin/økonomi ser allt i org
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_sessions_raw_select ON ref_sessions_raw FOR SELECT
  USING (employee_id = auth.uid() OR auth.jwt() ->> 'role' IN ('admin', 'økonomi'));

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_sessions_raw_insert ON ref_sessions_raw FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_sessions_raw_update ON ref_sessions_raw FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_sessions_raw_delete ON ref_sessions_raw FOR DELETE
  USING (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));

-- Sessions Hourly: ansatt ser kun egne, admin/økonomi ser allt i org
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_sessions_hourly_select ON ref_sessions_hourly FOR SELECT
  USING (employee_id = auth.uid() OR auth.jwt() ->> 'role' IN ('admin', 'økonomi'));

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_sessions_hourly_insert ON ref_sessions_hourly FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_sessions_hourly_update ON ref_sessions_hourly FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_sessions_hourly_delete ON ref_sessions_hourly FOR DELETE
  USING (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));

-- Reimbursements: ansatt ser kun egne, admin/økonomi ser allt i org
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_reimbursements_select ON ref_reimbursements FOR SELECT
  USING (employee_id = auth.uid() OR auth.jwt() ->> 'role' IN ('admin', 'økonomi'));

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_reimbursements_insert ON ref_reimbursements FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_reimbursements_update ON ref_reimbursements FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_reimbursements_delete ON ref_reimbursements FOR DELETE
  USING (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));

-- Effect Tiers: admin/økonomi ser allt i org, ansatt ser ikke
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_effect_tiers_select ON ref_effect_tiers FOR SELECT
  USING (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_effect_tiers_insert ON ref_effect_tiers FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_effect_tiers_update ON ref_effect_tiers FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  ref_effect_tiers_delete ON ref_effect_tiers FOR DELETE
  USING (auth.jwt() ->> 'role' IN ('admin', 'økonomi'));

-- Profile Modules: ansatt ser kun egne, admin ser allt
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  profile_modules_select ON profile_modules FOR SELECT
  USING (profile_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin');

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  profile_modules_insert ON profile_modules FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  profile_modules_update ON profile_modules FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'admin');
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename =  profile_modules_delete ON profile_modules FOR DELETE
  USING (auth.jwt() ->> 'role' = 'admin');

-- Comments for documentation
COMMENT ON TABLE ref_chargers IS 'Ladepunkt with area and timezone for CSV matching';
COMMENT ON TABLE ref_rfid_keys IS 'RFID keys used to identify firmalading vs privat';
COMMENT ON TABLE ref_employee_keys IS 'Maps RFID keys to employees and chargers';
COMMENT ON TABLE ref_employee_settings IS 'Pricing policy per employee (Norgespris or Spot+støtte)';
COMMENT ON TABLE ref_energy_prices IS 'Cached spot prices from external API';
COMMENT ON TABLE ref_nett_profiles IS 'TOU nettariff profiles with versioning support';
COMMENT ON TABLE ref_nett_windows IS 'Time-of-use windows for nettariff calculation';
COMMENT ON TABLE ref_sessions_raw IS 'Original CSV rows for audit trail';
COMMENT ON TABLE ref_sessions_hourly IS 'Time-split charging sessions for pricing';
COMMENT ON TABLE ref_reimbursements IS 'Generated reimbursement reports (PDF/CSV)';
COMMENT ON TABLE ref_effect_tiers IS 'Effect tiers for peak-based surcharge';
COMMENT ON TABLE profile_modules IS 'Module access control per user profile';

