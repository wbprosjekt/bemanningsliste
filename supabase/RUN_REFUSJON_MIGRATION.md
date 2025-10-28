# Refusjon Module Migration Guide

## Supabase Dashboard Method (Easiest)

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Navigate to**: SQL Editor (left sidebar)
3. **Create new query** and paste this entire file:
   
   File: `supabase/migrations/20250130000000_create_refusjon_hjemmelading_module.sql`
   
4. **Click "Run"** (or Cmd/Ctrl + Enter)
5. Wait for "Success, no rows returned"

---

## What This Migration Creates

- `ref_chargers` - Charging station locations
- `ref_rfid_keys` - RFID key inventory  
- `ref_employee_keys` - Maps employees to RFID keys
- `ref_employee_settings` - Pricing policy per employee
- `ref_energy_prices` - Historical spot prices (cache)
- `ref_nett_profiles` - TOU net tariff profiles
- `ref_nett_windows` - Time windows for TOU
- `ref_sessions_raw` - CSV import raw data
- `ref_sessions_hourly` - Time-split hourly sessions
- `ref_reimbursements` - Generated reimbursement records
- `ref_effect_tiers` - Effect-based charge tiers
- `profile_modules` - Module access control

Plus all RLS policies for security.

---

## After Migration

Run this to regenerate TypeScript types:

\`\`\`bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/integrations/supabase/types.ts
\`\`\`

Or use Supabase CLI:
\`\`\`bash
supabase gen types typescript --linked > src/integrations/supabase/types.ts
\`\`\`

