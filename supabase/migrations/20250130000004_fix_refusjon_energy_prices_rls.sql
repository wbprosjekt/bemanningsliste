-- Fix RLS policies for ref_energy_prices
-- Run this in Supabase SQL Editor

-- Drop existing policies
DROP POLICY IF EXISTS ref_energy_prices_select ON ref_energy_prices;
DROP POLICY IF EXISTS ref_energy_prices_insert ON ref_energy_prices;
DROP POLICY IF EXISTS ref_energy_prices_update ON ref_energy_prices;
DROP POLICY IF EXISTS ref_energy_prices_delete ON ref_energy_prices;

-- CREATE policies with correct syntax
CREATE POLICY ref_energy_prices_select ON ref_energy_prices FOR SELECT
  USING (true);

CREATE POLICY ref_energy_prices_insert ON ref_energy_prices FOR INSERT
  WITH CHECK (true);

CREATE POLICY ref_energy_prices_update ON ref_energy_prices FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY ref_energy_prices_delete ON ref_energy_prices FOR DELETE
  USING (true);


