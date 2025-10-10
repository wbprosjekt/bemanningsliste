import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface CallerProfile {
  id: string;
  user_id: string;
  org_id: string;
  role: 'admin' | 'manager' | 'user';
  display_name: string;
}

export interface AuthorizationError {
  error: string;
  message: string;
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND';
  httpStatus: 401 | 403 | 404;
}

/**
 * Get the caller's profile from the auth header
 * @param authHeader - Authorization header from request
 * @returns CallerProfile or AuthorizationError
 */
export async function getCallerProfile(authHeader: string): Promise<CallerProfile | AuthorizationError> {
  if (!authHeader) {
    return {
      error: 'Unauthorized',
      message: 'Missing authorization header',
      code: 'UNAUTHORIZED',
      httpStatus: 401
    };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // Create client with user's auth header to validate JWT
  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  // Verify the user is authenticated
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  
  if (authError || !user) {
    console.error('Authentication failed:', authError?.message);
    return {
      error: 'Unauthorized',
      message: 'Invalid or expired token',
      code: 'UNAUTHORIZED',
      httpStatus: 401
    };
  }

  // Use service role to fetch profile (bypasses RLS for this check)
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, user_id, org_id, role, display_name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Error fetching profile:', profileError);
    return {
      error: 'Internal Server Error',
      message: 'Could not fetch user profile',
      code: 'UNAUTHORIZED',
      httpStatus: 401
    };
  }

  if (!profile) {
    return {
      error: 'Forbidden',
      message: 'User has no profile. Please complete onboarding.',
      code: 'FORBIDDEN',
      httpStatus: 403
    };
  }

  return profile as CallerProfile;
}

/**
 * Require that the caller has access to the specified organization with at least the minimum role
 * @param authHeader - Authorization header from request
 * @param orgId - Organization ID to check access for
 * @param minRole - Minimum required role (default: 'user')
 * @returns CallerProfile if authorized, AuthorizationError otherwise
 */
export async function requireOrgAccess(
  authHeader: string,
  orgId: string,
  minRole: 'admin' | 'manager' | 'user' = 'user'
): Promise<CallerProfile | AuthorizationError> {
  const profileOrError = await getCallerProfile(authHeader);
  
  // If it's an error, return it
  if ('error' in profileOrError) {
    return profileOrError;
  }

  const profile = profileOrError;

  // Check org membership
  if (profile.org_id !== orgId) {
    console.warn(`Access denied: User ${profile.user_id} attempted to access org ${orgId}, but belongs to ${profile.org_id}`);
    return {
      error: 'Forbidden',
      message: 'You do not have access to this organization',
      code: 'FORBIDDEN',
      httpStatus: 403
    };
  }

  // Check role
  const roleHierarchy = { user: 1, manager: 2, admin: 3 };
  const userRoleLevel = roleHierarchy[profile.role] || 0;
  const requiredRoleLevel = roleHierarchy[minRole] || 0;

  if (userRoleLevel < requiredRoleLevel) {
    console.warn(`Access denied: User ${profile.user_id} has role ${profile.role}, but ${minRole} required`);
    return {
      error: 'Forbidden',
      message: `This action requires ${minRole} role or higher`,
      code: 'FORBIDDEN',
      httpStatus: 403
    };
  }

  return profile;
}

/**
 * Require that the caller is an admin or manager in the specified organization
 * @param authHeader - Authorization header from request
 * @param orgId - Organization ID to check access for
 * @returns CallerProfile if authorized, AuthorizationError otherwise
 */
export async function requireAdminOrManager(
  authHeader: string,
  orgId: string
): Promise<CallerProfile | AuthorizationError> {
  return requireOrgAccess(authHeader, orgId, 'manager');
}

/**
 * Check if the request is coming from a service role (for cron jobs and internal functions)
 * @param req - Request object
 * @returns true if service role, false otherwise
 */
export function isServiceRoleRequest(req: Request): boolean {
  const authHeader = req.headers.get('Authorization') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  
  // Check if the Bearer token matches the service role key
  const token = authHeader.replace('Bearer ', '');
  return token === serviceRoleKey;
}

/**
 * Validate a trigger secret for internal-only functions (like nightly-sync)
 * @param req - Request object
 * @param expectedSecretEnvVar - Name of the environment variable containing the expected secret
 * @returns true if valid, false otherwise
 */
export function validateTriggerSecret(req: Request, expectedSecretEnvVar: string): boolean {
  const triggerSecret = req.headers.get('X-Trigger-Secret');
  const expectedSecret = Deno.env.get(expectedSecretEnvVar);
  
  if (!expectedSecret) {
    console.error(`Expected secret not configured: ${expectedSecretEnvVar}`);
    return false;
  }
  
  return triggerSecret === expectedSecret;
}

/**
 * Helper to create an error response
 * @param error - AuthorizationError object
 * @param corsHeaders - CORS headers to include
 * @returns Response object
 */
export function createErrorResponse(error: AuthorizationError, corsHeaders: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({ 
      error: error.error,
      message: error.message,
      code: error.code
    }),
    {
      status: error.httpStatus,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}

