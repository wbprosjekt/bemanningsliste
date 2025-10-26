/**
 * Rate limiting utilities for API endpoints
 * Provides protection against abuse and DoS attacks
 */

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (in production, use Redis or similar)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Default configurations for different endpoint types
const defaultConfigs = {
  // General API endpoints
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
  },
  // Authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
  },
  // Tripletex API calls (expensive operations)
  tripletex: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
  },
  // Time entry operations
  timeEntry: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
  },
  // Project operations
  project: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
  },
} as const;

/**
 * Generate a unique key for rate limiting based on IP and endpoint
 */
function generateRateLimitKey(identifier: string, endpoint?: string): string {
  const endpointKey = endpoint ? `:${endpoint}` : '';
  return `ratelimit:${identifier}${endpointKey}`;
}

/**
 * Check if a request should be rate limited
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = defaultConfigs.api,
  endpoint?: string
): { allowed: boolean; remaining: number; resetTime: number } {
  const key = generateRateLimitKey(identifier, endpoint);
  const now = Date.now();
  
  // Clean up expired entries periodically
  if (Math.random() < 0.01) { // 1% chance to clean up
    cleanupExpiredEntries();
  }
  
  let entry = rateLimitStore.get(key);
  
  // If no entry exists or it's expired, create a new one
  if (!entry || now >= entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(key, entry);
  }
  
  // Increment the counter
  entry.count++;
  
  const remaining = Math.max(0, config.maxRequests - entry.count);
  const allowed = entry.count <= config.maxRequests;
  
  return {
    allowed,
    remaining,
    resetTime: entry.resetTime,
  };
}

/**
 * Clean up expired entries from the rate limit store
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Get client identifier from request (IP address or user ID)
 */
export function getClientIdentifier(request: Request, userId?: string): string {
  // In production, prefer user ID for authenticated requests
  if (userId) {
    return `user:${userId}`;
  }
  
  // Fallback to IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || 'unknown';
  
  return `ip:${ip}`;
}

/**
 * Rate limiting middleware for Next.js API routes
 */
export function withRateLimit(
  handler: Function,
  config?: RateLimitConfig,
  endpoint?: string
) {
  return async (request: Request, context?: any) => {
    try {
      const identifier = getClientIdentifier(request, context?.user?.id);
      const rateLimitResult = checkRateLimit(identifier, config, endpoint);
      
      if (!rateLimitResult.allowed) {
        return new Response(
          JSON.stringify({
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please try again later.',
            resetTime: rateLimitResult.resetTime,
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'X-RateLimit-Limit': config?.maxRequests?.toString() || '100',
              'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
              'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
              'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
            },
          }
        );
      }
      
      // Add rate limit headers to successful responses
      const response = await handler(request, context);
      
      if (response instanceof Response) {
        response.headers.set('X-RateLimit-Limit', (config?.maxRequests || 100).toString());
        response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
        response.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString());
      }
      
      return response;
    } catch (error) {
      console.error('Rate limiting error:', error);
      // If rate limiting fails, allow the request but log the error
      return await handler(request, context);
    }
  };
}

/**
 * Rate limiting for Edge Functions
 */
export function withEdgeRateLimit(
  handler: (request: Request) => Promise<Response>,
  config?: RateLimitConfig,
  endpoint?: string
) {
  return async (request: Request): Promise<Response> => {
    try {
      const identifier = getClientIdentifier(request);
      const rateLimitResult = checkRateLimit(identifier, config, endpoint);
      
      if (!rateLimitResult.allowed) {
        return new Response(
          JSON.stringify({
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please try again later.',
            resetTime: rateLimitResult.resetTime,
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
              'X-RateLimit-Limit': (config?.maxRequests || 100).toString(),
              'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
              'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
              'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
            },
          }
        );
      }
      
      // Execute the handler
      const response = await handler(request);
      
      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', (config?.maxRequests || 100).toString());
      response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
      response.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString());
      
      return response;
    } catch (error) {
      console.error('Rate limiting error:', error);
      // If rate limiting fails, allow the request but log the error
      return await handler(request);
    }
  };
}

/**
 * Client-side rate limiting check (for user feedback)
 */
export function checkClientRateLimit(
  endpoint: string,
  config: RateLimitConfig = defaultConfigs.api
): boolean {
  if (!canUseFunctionalStorage()) {
    return true;
  }
  const key = `client:${endpoint}`;
  const now = Date.now();
  
  const stored = localStorage.getItem(key);
  if (stored) {
    const data = JSON.parse(stored) as RateLimitEntry;
    if (now < data.resetTime) {
      return data.count < config.maxRequests;
    }
  }
  
  return true;
}

/**
 * Update client-side rate limiting
 */
export function updateClientRateLimit(
  endpoint: string,
  config: RateLimitConfig = defaultConfigs.api
): void {
  if (!canUseFunctionalStorage()) {
    return;
  }
  const key = `client:${endpoint}`;
  const now = Date.now();
  
  const stored = localStorage.getItem(key);
  let data: RateLimitEntry;
  
  if (stored) {
    data = JSON.parse(stored);
    if (now >= data.resetTime) {
      data = { count: 0, resetTime: now + config.windowMs };
    }
  } else {
    data = { count: 0, resetTime: now + config.windowMs };
  }
  
  data.count++;
  localStorage.setItem(key, JSON.stringify(data));
}

/**
 * Get rate limit status for client display
 */
export function getRateLimitStatus(endpoint: string): {
  remaining: number;
  resetTime: number;
} | null {
  if (!canUseFunctionalStorage()) {
    return null;
  }
  const key = `client:${endpoint}`;
  const stored = localStorage.getItem(key);
  
  if (stored) {
    const data = JSON.parse(stored) as RateLimitEntry;
    const now = Date.now();
    
    if (now < data.resetTime) {
      return {
        remaining: Math.max(0, 100 - data.count), // Assuming max 100 for display
        resetTime: data.resetTime,
      };
    }
  }
  
  return null;
}

// Export default configurations
export { defaultConfigs };
function canUseFunctionalStorage() {
  return typeof window !== 'undefined' && window.__cookieConsent?.functional;
}
