/**
 * Secure CORS configuration for Supabase Edge Functions
 * This utility provides secure CORS headers based on environment
 */

interface CorsConfig {
  origin: string | string[];
  methods: string[];
  allowedHeaders: string[];
  credentials?: boolean;
}

/**
 * Get secure CORS configuration based on environment
 */
function getCorsConfig(): CorsConfig {
  const isDevelopment = Deno.env.get('ENVIRONMENT') === 'development';
  
  // In production, restrict to specific origins
  const productionOrigins = [
    'https://bemanningsliste.vercel.app',
    'https://bemanningsliste-next.vercel.app',
    // Add your production domains here
  ];
  
  // In development, allow localhost but still restrict ports
  const developmentOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ];
  
  return {
    origin: isDevelopment ? developmentOrigins : productionOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'authorization',
      'x-client-info',
      'apikey',
      'content-type',
      'x-requested-with',
    ],
    credentials: true,
  };
}

/**
 * Generate CORS headers for response
 */
export function getCorsHeaders(requestOrigin?: string): Record<string, string> {
  const config = getCorsConfig();
  
  // Handle preflight requests
  const origin = requestOrigin || '';
  const allowedOrigins = Array.isArray(config.origin) ? config.origin : [config.origin];
  
  // Check if origin is allowed
  const isAllowedOrigin = allowedOrigins.includes(origin) || 
                         (config.origin === '*' && origin); // Fallback for development
  
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Methods': config.methods.join(', '),
    'Access-Control-Allow-Headers': config.allowedHeaders.join(', '),
  };
  
  // Only set origin if it's allowed or if we're in development with wildcard
  if (isAllowedOrigin) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
  } else if (config.origin === '*' && Deno.env.get('ENVIRONMENT') === 'development') {
    // Fallback for development - but log a warning
    console.warn(`⚠️ CORS: Origin ${origin} not explicitly allowed in development`);
    corsHeaders['Access-Control-Allow-Origin'] = origin;
  } else {
    // In production, don't set the header if origin is not allowed
    corsHeaders['Access-Control-Allow-Origin'] = 'null';
  }
  
  if (config.credentials) {
    corsHeaders['Access-Control-Allow-Credentials'] = 'true';
  }
  
  return corsHeaders;
}

/**
 * Handle CORS preflight request
 */
export function handleCorsPreflight(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    const corsHeaders = getCorsHeaders(request.headers.get('origin') || undefined);
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }
  return null;
}

/**
 * Add CORS headers to any response
 */
export function addCorsHeaders(response: Response, requestOrigin?: string): Response {
  const corsHeaders = getCorsHeaders(requestOrigin);
  
  // Add CORS headers to the response
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

