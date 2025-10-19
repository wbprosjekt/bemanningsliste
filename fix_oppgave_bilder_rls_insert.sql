-- Fix RLS policy for oppgave_bilder INSERT

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert their own oppgave_bilder" ON oppgave_bilder;

-- Create new policy to allow authenticated users to insert oppgave_bilder
CREATE POLICY "Users can insert their own oppgave_bilder"
ON oppgave_bilder
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- Also ensure SELECT policy exists
DROP POLICY IF EXISTS "Users can view oppgave_bilder" ON oppgave_bilder;

CREATE POLICY "Users can view oppgave_bilder"
ON oppgave_bilder
FOR SELECT
TO authenticated
USING (true);

