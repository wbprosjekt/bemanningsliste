-- =====================================================
-- INVITE CODES SYSTEM - SaaS Multi-Tenant Ready
-- =====================================================
-- Created: 2025-10-08
-- Purpose: Enable users to join existing organizations via invite codes
-- =====================================================

-- 1. Create invite_codes table
CREATE TABLE IF NOT EXISTS public.invite_codes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
    code TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    max_uses INT NOT NULL DEFAULT 1,
    current_uses INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Create invite_code_uses table (audit log)
CREATE TABLE IF NOT EXISTS public.invite_code_uses (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    invite_code_id UUID NOT NULL REFERENCES public.invite_codes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    ip_address TEXT,
    user_agent TEXT
);

-- 3. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_invite_codes_org_id ON public.invite_codes(org_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON public.invite_codes(code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_invite_codes_created_by ON public.invite_codes(created_by);
CREATE INDEX IF NOT EXISTS idx_invite_codes_expires_at ON public.invite_codes(expires_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_invite_code_uses_invite_code_id ON public.invite_code_uses(invite_code_id);
CREATE INDEX IF NOT EXISTS idx_invite_code_uses_user_id ON public.invite_code_uses(user_id);

-- 4. Add RLS policies for invite_codes
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- Admins can view invite codes in their org
CREATE POLICY "Admins can view invite codes in their org"
  ON public.invite_codes
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND org_id = invite_codes.org_id
      AND role IN ('admin', 'manager')
    )
  );

-- Admins can create invite codes in their org
CREATE POLICY "Admins can create invite codes in their org"
  ON public.invite_codes
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND org_id = invite_codes.org_id
      AND role IN ('admin', 'manager')
    )
  );

-- Admins can update invite codes in their org
CREATE POLICY "Admins can update invite codes in their org"
  ON public.invite_codes
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND org_id = invite_codes.org_id
      AND role IN ('admin', 'manager')
    )
  );

-- Admins can delete invite codes in their org
CREATE POLICY "Admins can delete invite codes in their org"
  ON public.invite_codes
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND org_id = invite_codes.org_id
      AND role IN ('admin', 'manager')
    )
  );

-- 5. Add RLS policies for invite_code_uses
ALTER TABLE public.invite_code_uses ENABLE ROW LEVEL SECURITY;

-- Admins can view usage logs in their org
CREATE POLICY "Admins can view usage logs in their org"
  ON public.invite_code_uses
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 
      FROM public.invite_codes ic
      JOIN public.profiles p ON p.org_id = ic.org_id
      WHERE ic.id = invite_code_uses.invite_code_id
      AND p.user_id = auth.uid()
      AND p.role IN ('admin', 'manager')
    )
  );

-- Users can see their own usage
CREATE POLICY "Users can view own usage"
  ON public.invite_code_uses
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid()
  );

-- 6. Function to validate and use invite code
CREATE OR REPLACE FUNCTION public.validate_and_use_invite_code(
  p_code TEXT,
  p_user_id UUID
)
RETURNS TABLE (
  valid BOOLEAN,
  org_id UUID,
  org_name TEXT,
  role TEXT,
  error_message TEXT
) AS $$
DECLARE
  v_invite_code RECORD;
  v_org RECORD;
BEGIN
  -- Find invite code
  SELECT * INTO v_invite_code
  FROM public.invite_codes
  WHERE code = p_code
  AND is_active = true
  FOR UPDATE;

  -- Check if code exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::TEXT, 'Ugyldig invitasjonskode'::TEXT;
    RETURN;
  END IF;

  -- Check if expired
  IF v_invite_code.expires_at < now() THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::TEXT, 'Invitasjonskoden har utløpt'::TEXT;
    RETURN;
  END IF;

  -- Check if max uses reached
  IF v_invite_code.current_uses >= v_invite_code.max_uses THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::TEXT, 'Invitasjonskoden er allerede brukt opp'::TEXT;
    RETURN;
  END IF;

  -- Check if user already has profile in this org
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = p_user_id 
    AND org_id = v_invite_code.org_id
  ) THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::TEXT, 'Du er allerede medlem av denne organisasjonen'::TEXT;
    RETURN;
  END IF;

  -- Get org details
  SELECT * INTO v_org
  FROM public.org
  WHERE id = v_invite_code.org_id;

  -- Increment usage count
  UPDATE public.invite_codes
  SET current_uses = current_uses + 1,
      updated_at = now()
  WHERE id = v_invite_code.id;

  -- Log usage
  INSERT INTO public.invite_code_uses (invite_code_id, user_id)
  VALUES (v_invite_code.id, p_user_id);

  -- Return success
  RETURN QUERY SELECT 
    true, 
    v_invite_code.org_id, 
    v_org.name, 
    v_invite_code.role,
    NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function to generate invite code
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate random 8-character code
    v_code := lower(substring(md5(random()::text) from 1 for 8));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.invite_codes WHERE code = v_code) INTO v_exists;
    
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- 8. Add updated_at trigger for invite_codes
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_invite_codes_updated_at
  BEFORE UPDATE ON public.invite_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Add comments for documentation
COMMENT ON TABLE public.invite_codes IS 
  'SaaS invite codes system: Enables users to join existing organizations';

COMMENT ON FUNCTION public.validate_and_use_invite_code IS 
  'Validates invite code and increments usage counter if valid';

COMMENT ON FUNCTION public.generate_invite_code IS 
  'Generates unique 8-character invite code';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Invite codes system installed successfully';
  RAISE NOTICE '✅ RLS policies applied';
  RAISE NOTICE '✅ SaaS multi-tenant ready';
END $$;

