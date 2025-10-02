/**
 * CSRF (Cross-Site Request Forgery) protection utilities
 * Provides protection against CSRF attacks
 */

import { validateUUID } from './validation';

// CSRF token storage
const csrfTokens = new Map<string, { token: string; expires: number; userId?: string }>();

// Token configuration
const TOKEN_LENGTH = 32;
const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

/**
 * Generate a cryptographically secure random token
 */
function generateToken(): string {
  const array = new Uint8Array(TOKEN_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a CSRF token for a session
 */
export function generateCSRFToken(sessionId: string, userId?: string): string {
  const token = generateToken();
  const expires = Date.now() + TOKEN_EXPIRY_MS;
  
  csrfTokens.set(sessionId, {
    token,
    expires,
    userId,
  });
  
  // Clean up expired tokens periodically
  if (Math.random() < 0.01) { // 1% chance
    cleanupExpiredTokens();
  }
  
  return token;
}

/**
 * Verify a CSRF token
 */
export function verifyCSRFToken(sessionId: string, token: string, userId?: string): boolean {
  const stored = csrfTokens.get(sessionId);
  
  if (!stored) {
    return false;
  }
  
  // Check if token has expired
  if (Date.now() > stored.expires) {
    csrfTokens.delete(sessionId);
    return false;
  }
  
  // Verify token matches
  if (stored.token !== token) {
    return false;
  }
  
  // If userId is provided, verify it matches
  if (userId && stored.userId && stored.userId !== userId) {
    return false;
  }
  
  return true;
}

/**
 * Invalidate a CSRF token
 */
export function invalidateCSRFToken(sessionId: string): void {
  csrfTokens.delete(sessionId);
}

/**
 * Clean up expired tokens
 */
function cleanupExpiredTokens(): void {
  const now = Date.now();
  for (const [sessionId, data] of csrfTokens.entries()) {
    if (now > data.expires) {
      csrfTokens.delete(sessionId);
    }
  }
}

/**
 * Get or create a CSRF token for a session
 */
export function getOrCreateCSRFToken(sessionId: string, userId?: string): string {
  const stored = csrfTokens.get(sessionId);
  
  if (stored && Date.now() < stored.expires) {
    return stored.token;
  }
  
  return generateCSRFToken(sessionId, userId);
}

/**
 * CSRF protection middleware for API routes
 */
export function withCSRFProtection(
  handler: Function,
  options: { 
    requireToken?: boolean;
    userIdParam?: string;
  } = {}
) {
  return async (request: Request, context?: any) => {
    const { requireToken = true, userIdParam = 'userId' } = options;
    
    if (!requireToken) {
      return await handler(request, context);
    }
    
    try {
      // Get session ID from request (could be from cookie, header, or context)
      const sessionId = getSessionId(request, context);
      if (!sessionId) {
        return new Response(
          JSON.stringify({ error: 'Session required' }),
          { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
      // Get CSRF token from request
      const csrfToken = getCSRFToken(request);
      if (!csrfToken) {
        return new Response(
          JSON.stringify({ error: 'CSRF token required' }),
          { 
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
      // Get user ID if available
      const userId = context?.user?.id || getUserId(request, userIdParam);
      
      // Verify CSRF token
      if (!verifyCSRFToken(sessionId, csrfToken, userId)) {
        return new Response(
          JSON.stringify({ error: 'Invalid CSRF token' }),
          { 
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
      // Token is valid, proceed with handler
      return await handler(request, context);
      
    } catch (error) {
      console.error('CSRF protection error:', error);
      return new Response(
        JSON.stringify({ error: 'CSRF verification failed' }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  };
}

/**
 * Extract session ID from request
 */
function getSessionId(request: Request, context?: any): string | null {
  // Try to get from context first (if provided by auth middleware)
  if (context?.sessionId) {
    return context.sessionId;
  }
  
  // Try to get from cookie
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const sessionCookie = cookieHeader
      .split(';')
      .find(cookie => cookie.trim().startsWith('sessionId='));
    
    if (sessionCookie) {
      return sessionCookie.split('=')[1];
    }
  }
  
  // Try to get from header
  const sessionHeader = request.headers.get('x-session-id');
  if (sessionHeader) {
    return sessionHeader;
  }
  
  return null;
}

/**
 * Extract CSRF token from request
 */
function getCSRFToken(request: Request): string | null {
  // Try to get from header first (recommended)
  const csrfHeader = request.headers.get('x-csrf-token');
  if (csrfHeader) {
    return csrfHeader;
  }
  
  // Try to get from form data if it's a POST request
  if (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') {
    // This would need to be handled in the actual request body parsing
    // For now, we'll rely on headers
  }
  
  return null;
}

/**
 * Extract user ID from request
 */
function getUserId(request: Request, userIdParam: string): string | null {
  // Try to get from URL parameters
  const url = new URL(request.url);
  const userId = url.searchParams.get(userIdParam);
  
  if (userId) {
    try {
      return validateUUID(userId);
    } catch {
      return null;
    }
  }
  
  return null;
}

/**
 * Client-side CSRF token management
 */
export class CSRFTokenManager {
  private static instance: CSRFTokenManager;
  private token: string | null = null;
  private sessionId: string | null = null;

  private constructor() {
    this.sessionId = this.getOrCreateSessionId();
  }

  public static getInstance(): CSRFTokenManager {
    if (!CSRFTokenManager.instance) {
      CSRFTokenManager.instance = new CSRFTokenManager();
    }
    return CSRFTokenManager.instance;
  }

  /**
   * Get or create a session ID
   */
  private getOrCreateSessionId(): string {
    let sessionId = localStorage.getItem('sessionId');
    
    if (!sessionId) {
      sessionId = generateToken();
      localStorage.setItem('sessionId', sessionId);
    }
    
    return sessionId;
  }

  /**
   * Get current CSRF token, fetching if necessary
   */
  public async getToken(): Promise<string> {
    if (this.token) {
      return this.token;
    }
    
    try {
      const response = await fetch('/api/csrf-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId: this.sessionId }),
      });
      
      if (response.ok) {
        const data = await response.json();
        this.token = data.token;
        return this.token || '';
      }
    } catch (error) {
      console.error('Failed to get CSRF token:', error);
    }
    
    // Fallback: generate a client-side token (less secure but better than nothing)
    this.token = generateToken();
    return this.token;
  }

  /**
   * Include CSRF token in request headers
   */
  public async addCSRFHeader(headers: Record<string, string> = {}): Promise<Record<string, string>> {
    const token = await this.getToken();
    return {
      ...headers,
      'X-CSRF-Token': token,
      'X-Session-ID': this.sessionId!,
    };
  }

  /**
   * Invalidate current token
   */
  public invalidateToken(): void {
    this.token = null;
  }

  /**
   * Reset session (for logout)
   */
  public resetSession(): void {
    this.token = null;
    this.sessionId = null;
    localStorage.removeItem('sessionId');
  }
}

/**
 * Hook for using CSRF tokens in React components
 */
export function useCSRFToken(): {
  getToken: () => Promise<string>;
  addCSRFHeader: (headers?: Record<string, string>) => Promise<Record<string, string>>;
  invalidateToken: () => void;
} {
  const manager = CSRFTokenManager.getInstance();
  
  return {
    getToken: () => manager.getToken(),
    addCSRFHeader: (headers) => manager.addCSRFHeader(headers),
    invalidateToken: () => manager.invalidateToken(),
  };
}

