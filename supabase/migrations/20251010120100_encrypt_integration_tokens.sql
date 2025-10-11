-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create encryption helper function
-- Uses AES encryption with a key stored in database configuration
-- The key should be set with: ALTER DATABASE postgres SET app.encryption_key = 'your-32-byte-key';
CREATE OR REPLACE FUNCTION public.encrypt_token(token TEXT)
RETURNS TEXT AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  -- Get encryption key from secrets table
  SELECT value INTO encryption_key FROM secrets WHERE key = 'encryption_key';
  
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found in secrets table';
  END IF;
  
  -- Encrypt and encode to base64
  RETURN encode(
    encrypt(
      token::bytea,
      encryption_key::bytea,
      'aes'
    ),
    'base64'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create decryption helper function
CREATE OR REPLACE FUNCTION public.decrypt_token(encrypted TEXT)
RETURNS TEXT AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  -- Handle NULL or empty input
  IF encrypted IS NULL OR encrypted = '' THEN
    RETURN NULL;
  END IF;
  
  -- Get encryption key from secrets table
  SELECT value INTO encryption_key FROM secrets WHERE key = 'encryption_key';
  
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found in secrets table';
  END IF;
  
  -- Decode from base64 and decrypt
  RETURN convert_from(
    decrypt(
      decode(encrypted, 'base64'),
      encryption_key::bytea,
      'aes'
    ),
    'utf8'
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to decrypt token. Ensure the encryption key is correct.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helper function to check if token is encrypted (starts with encrypted marker or is base64)
CREATE OR REPLACE FUNCTION public.is_token_encrypted(token TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF token IS NULL OR token = '' THEN
    RETURN FALSE;
  END IF;
  
  -- Check if it looks like base64 (encrypted format)
  -- Base64 characters are: A-Z, a-z, 0-9, +, /, and = for padding
  RETURN token ~ '^[A-Za-z0-9+/]+=*$' AND length(token) > 20;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add comments for documentation
COMMENT ON FUNCTION public.encrypt_token(TEXT) IS 'Encrypts a token using AES encryption. Requires app.encryption_key to be set in database config.';
COMMENT ON FUNCTION public.decrypt_token(TEXT) IS 'Decrypts a token that was encrypted with encrypt_token(). Requires app.encryption_key to be set in database config.';
COMMENT ON FUNCTION public.is_token_encrypted(TEXT) IS 'Checks if a token appears to be encrypted (base64 format).';

-- NOTE: Migration of existing data should be done carefully
-- The following UPDATE statements are commented out for safety
-- Uncomment and run manually after setting the encryption key

/*
-- Step 1: Set encryption key (run this first in SQL editor):
-- ALTER DATABASE postgres SET app.encryption_key = 'your-secure-32-byte-random-key-here';

-- Step 2: Migrate consumer_token
UPDATE public.integration_settings
SET settings = jsonb_set(
  settings,
  '{consumer_token_encrypted}',
  to_jsonb(encrypt_token(settings->>'consumer_token'))
)
WHERE settings->>'consumer_token' IS NOT NULL
  AND settings->>'consumer_token' != ''
  AND (settings->>'consumer_token_encrypted' IS NULL OR settings->>'consumer_token_encrypted' = '');

-- Step 3: Migrate employee_token
UPDATE public.integration_settings
SET settings = jsonb_set(
  settings,
  '{employee_token_encrypted}',
  to_jsonb(encrypt_token(settings->>'employee_token'))
)
WHERE settings->>'employee_token' IS NOT NULL
  AND settings->>'employee_token' != ''
  AND (settings->>'employee_token_encrypted' IS NULL OR settings->>'employee_token_encrypted' = '');

-- Step 4: Migrate session_token
UPDATE public.integration_settings
SET settings = jsonb_set(
  settings,
  '{session_token_encrypted}',
  to_jsonb(encrypt_token(settings->>'session_token'))
)
WHERE settings->>'session_token' IS NOT NULL
  AND settings->>'session_token' != ''
  AND (settings->>'session_token_encrypted' IS NULL OR settings->>'session_token_encrypted' = '');

-- Step 5: After verifying encrypted tokens work, remove plaintext tokens
-- UPDATE public.integration_settings
-- SET settings = settings - 'consumer_token' - 'employee_token' - 'session_token';
*/

