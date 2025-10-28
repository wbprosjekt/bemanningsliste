-- Add IF NOT EXISTS for policies
-- Run this AFTER the main migration to fix duplicates

-- Drop existing policies if they exist and recreate them
-- (Safer approach for re-running migration)

DO $$ 
BEGIN
  -- Drop all ref_* policies
  DROP POLICY IF EXISTS ref_chargers_select ON ref_chargers;
  DROP POLICY IF EXISTS ref_chargers_insert ON ref_chargers;  
  DROP POLICY IF EXISTS ref_chargers_update ON ref_chargers;
  DROP POLICY IF EXISTS ref_chargers_delete ON ref_chargers;
  
  DROP POLICY IF EXISTS ref_rfid_keys_select ON ref_rfid_keys;
  DROP POLICY IF EXISTS ref_rfid_keys_insert ON ref_rfid_keys;
  DROP POLICY IF EXISTS ref_rfid_keys_update ON ref_rfid_keys;
  DROP POLICY IF EXISTS ref_rfid_keys_delete ON ref_rfid_keys;
  
  DROP POLICY IF EXISTS ref_employee_keys_select ON ref_employee_keys;
  DROP POLICY IF EXISTS ref_employee_keys_insert ON ref_employee_keys;
  DROP POLICY IF EXISTS ref_employee_keys_update ON ref_employee_keys;
  DROP POLICY IF EXISTS ref_employee_keys_delete ON ref_employee_keys;
  
  DROP POLICY IF EXISTS ref_employee_settings_select ON ref_employee_settings;
  DROP POLICY IF EXISTS ref_employee_settings_insert ON ref_employee_settings;
  DROP POLICY IF EXISTS ref_employee_settings_update ON ref_employee_settings;
  DROP POLICY IF EXISTS ref_employee_settings_delete ON ref_employee_settings;
  
  DROP POLICY IF EXISTS ref_energy_prices_select ON ref_energy_prices;
  DROP POLICY IF EXISTS ref_energy_prices_insert ON ref_energy_prices;
  
  DROP POLICY IF EXISTS ref_nett_profiles_select ON ref_nett_profiles;
  DROP POLICY IF EXISTS ref_nett_profiles_insert ON ref_nett_profiles;
  DROP POLICY IF EXISTS ref_nett_profiles_update ON ref_nett_profiles;
  DROP POLICY IF EXISTS ref_nett_profiles_delete ON ref_nett_profiles;
  
  DROP POLICY IF EXISTS ref_nett_windows_select ON ref_nett_windows;
  DROP POLICY IF EXISTS ref_nett_windows_insert ON ref_nett_windows;
  
  DROP POLICY IF EXISTS ref_sessions_raw_select ON ref_sessions_raw;
  DROP POLICY IF EXISTS ref_sessions_raw_insert ON ref_sessions_raw;
  
  DROP POLICY IF EXISTS ref_sessions_hourly_select ON ref_sessions_hourly;
  DROP POLICY IF EXISTS ref_sessions_hourly_insert ON ref_sessions_hourly;
  
  DROP POLICY IF EXISTS ref_reimbursements_select ON ref_reimbursements;
  DROP POLICY IF EXISTS ref_reimbursements_insert ON ref_reimbursements;
  DROP POLICY IF EXISTS ref_reimbursements_update ON ref_reimbursements;
  DROP POLICY IF EXISTS ref_reimbursements_delete ON ref_reimbursements;
  
  DROP POLICY IF EXISTS ref_effect_tiers_select ON ref_effect_tiers;
  DROP POLICY IF EXISTS profile_modules_select ON profile_modules;
  DROP POLICY IF EXISTS profile_modules_insert ON profile_modules;
  DROP POLICY IF EXISTS profile_modules_update ON profile_modules;
END $$;

-- Now recreate policies (copy from main migration file)


