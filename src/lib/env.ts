/**
 * Environment variables validation and configuration
 * This ensures all required environment variables are present and valid
 */

interface EnvConfig {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
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

  // Validate Supabase key format (should be a JWT-like string)
  if (requiredEnvVars.NEXT_PUBLIC_SUPABASE_ANON_KEY && 
      (!requiredEnvVars.NEXT_PUBLIC_SUPABASE_ANON_KEY.startsWith('eyJ') || 
       requiredEnvVars.NEXT_PUBLIC_SUPABASE_ANON_KEY.length < 50)) {
    invalidVars.push('NEXT_PUBLIC_SUPABASE_ANON_KEY (invalid format)');
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

