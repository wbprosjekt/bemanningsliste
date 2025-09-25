# Fix Database Schema: Add 'name' column to frie_linjer table

## Problem
The application is trying to update a 'name' column in the 'frie_linjer' table, but this column doesn't exist in the database. This causes a PGRST204 error: "Could not find the 'name' column of 'frie_linjer' in the schema cache".

## Required Fix
Add a 'name' column to the 'frie_linjer' table in Supabase to allow editing of line names (e.g., "Linje 1", "Linje 2", etc.).

## Database Migration Needed
Run this SQL command in Supabase to add the missing column:

```sql
-- Add name column to frie_linjer table
ALTER TABLE public.frie_linjer 
ADD COLUMN name TEXT;

-- Add comment to document the purpose
COMMENT ON COLUMN public.frie_linjer.name IS 'Custom name for the free line (e.g., "Linje 1", "Linje 2", etc.)';
```

## What This Enables
After adding this column, users will be able to:
- Click on "Linje 1", "Linje 2" labels in the free text lines
- Edit the line names to custom text
- Save the changes without getting PGRST204 errors

## Files Already Updated
The frontend code is already implemented and ready - it just needs the database column to exist.

Please run the SQL migration above in Supabase to resolve this issue.
