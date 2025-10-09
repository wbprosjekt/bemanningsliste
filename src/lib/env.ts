/**
 * Environment variables validation and configuration
 * This ensures all required environment variables are present and valid
 */

interface EnvConfig {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
}

/**
 * Validates Supabase API key format
 * Supports all Supabase key formats (JWT, supabase_*, sbp_*, and others)
 * Focuses on security validation (preventing service_role exposure)
 * 
 * @param key - The API key to validate
 * @param keyType - Type of key ('anon' or 'service_role')
 * @returns true if valid, false otherwise
 */
function validateSupabaseKey(key: string, keyType: 'anon' | 'service_role'): { valid: boolean; error?: string } {
  if (!key || typeof key !== 'string') {
    return { valid: false, error: 'Key is empty or not a string' };
  }

  // Minimum length check (20 chars is reasonable for any key)
  if (key.length < 20) {
    return { valid: false, error: 'Key is too short (minimum 20 characters)' };
  }

  // Check for obvious placeholders
  const placeholders = ['placeholder', 'YOUR_', 'REPLACE_', 'TODO', 'FIXME', 'test123'];
  if (placeholders.some(p => key.toLowerCase().includes(p.toLowerCase()))) {
    return { valid: false, error: 'Key appears to be a placeholder' };
  }

  // CRITICAL SECURITY CHECK: Prevent service_role key in anon slot
  // This check works for all key formats
  if (keyType === 'anon') {
    // Check if key contains service_role indicators
    if (key.includes('service_role') || key.includes('service-role')) {
      return { valid: false, error: '🚨 CRITICAL: Service role key in anon key slot!' };
    }

    // For JWT format, decode and check role
    if (key.startsWith('eyJ')) {
      const segments = key.split('.');
      if (segments.length === 3) {
        try {
          const payloadBase64 = segments[1];
          const payload = JSON.parse(atob(payloadBase64));
          
          if (payload.role === 'service_role') {
            return { valid: false, error: '🚨 CRITICAL: Service role key in anon key slot!' };
          }
        } catch (error) {
          // If we can't decode, just continue - it might be a valid key
          console.warn('Could not decode JWT payload, assuming valid');
        }
      }
    }
  }

  // If we got here, the key passed all security checks
  return { valid: true };
}

/**
 * Validates that all required environment variables are present
 * Throws an error if any are missing or invalid
 */
function validateEnvironment(): EnvConfig {
  const requiredEnvVars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  const missingVars: string[] = [];
  const invalidVars: string[] = [];

  // Check for missing variables
  Object.entries(requiredEnvVars).forEach(([key, value]) => {
    if (!value) {
      missingVars.push(key);
    }
  });

  // Validate Supabase URL format
  if (requiredEnvVars.NEXT_PUBLIC_SUPABASE_URL && 
      !requiredEnvVars.NEXT_PUBLIC_SUPABASE_URL.startsWith('https://')) {
    invalidVars.push('NEXT_PUBLIC_SUPABASE_URL (must be HTTPS)');
  }

  // Validate Supabase anon key format
  if (requiredEnvVars.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const anonKeyValidation = validateSupabaseKey(
      requiredEnvVars.NEXT_PUBLIC_SUPABASE_ANON_KEY, 
      'anon'
    );
    
    if (!anonKeyValidation.valid) {
      invalidVars.push(`NEXT_PUBLIC_SUPABASE_ANON_KEY (${anonKeyValidation.error})`);
    }
  }

  // Report errors
  if (missingVars.length > 0 || invalidVars.length > 0) {
    const errors = [
      ...missingVars.map(v => `Missing: ${v}`),
      ...invalidVars.map(v => `Invalid: ${v}`)
    ];
    
    const errorMessage = `Environment validation failed:\n${errors.join('\n')}`;
    
    // In production, throw an error to prevent app from starting
    if (process.env.NODE_ENV === 'production') {
      throw new Error(errorMessage);
    }
    
    // In development, log error but allow app to continue
    console.error(errorMessage);
    console.error('Please check your .env.local file and ensure all required variables are set.');
  }

  return requiredEnvVars as EnvConfig;
}

/**
 * Get validated environment configuration
 * This should be called once at application startup
 */
export const env = validateEnvironment();

/**
 * Runtime security check in browser
 * Warns if service_role key is accidentally exposed to client
 */
if (typeof window !== 'undefined') {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  // Check if service_role key is exposed
  if (anonKey.includes('service_role') || anonKey.includes('service-role')) {
    console.error('🚨🚨🚨 CRITICAL SECURITY ERROR 🚨🚨🚨');
    console.error('Service role key is exposed to the browser!');
    console.error('This gives FULL DATABASE ACCESS to anyone!');
    console.error('IMMEDIATELY replace NEXT_PUBLIC_SUPABASE_ANON_KEY with the anon key!');
    console.error('🚨🚨🚨 CRITICAL SECURITY ERROR 🚨🚨🚨');
    
    // Show alert to developer
    if (process.env.NODE_ENV === 'development') {
      setTimeout(() => {
        alert(
          '🚨 CRITICAL SECURITY ERROR!\n\n' +
          'Service role key detected in NEXT_PUBLIC_SUPABASE_ANON_KEY!\n' +
          'Check your .env.local file immediately!\n\n' +
          'This must be fixed before deploying to production.'
        );
      }, 1000);
    }
  }
}

/**
 * Check if we're running in production
 */
export const isProduction = process.env.NODE_ENV === 'production';

/**
 * Check if we're running in development
 */
export const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Get the current environment name
 */
export const getEnvironment = (): string => {
  return process.env.NODE_ENV || 'development';
};

