-- Ensure ref_employee_settings has a net_profile_id column and foreign key

ALTER TABLE ref_employee_settings
  ADD COLUMN IF NOT EXISTS net_profile_id UUID REFERENCES ref_nett_profiles(id);

