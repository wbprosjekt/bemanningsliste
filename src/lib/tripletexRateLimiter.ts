/**
 * Centralized Tripletex rate limit state manager
 * Tracks cooldown periods per org/endpoint to prevent premature retries
 * and improve compliance with Tripletex API rate limiting guidelines
 */
export class TripletexRateLimiter {
  private static limits: Map<string, number> = new Map();
  
  /**
   * Set rate limit cooldown for a key
   * @param key - Unique identifier (e.g., 'tripletex_send_org123')
   * @param retryAfterSeconds - How long to wait before next attempt
   */
  static setLimit(key: string, retryAfterSeconds: number): void {
    const until = Date.now() + (retryAfterSeconds * 1000);
    this.limits.set(key, until);
    
    console.info('Tripletex rate limit set', {
      key,
      retryAfterSeconds,
      until: new Date(until).toISOString(),
      currentTime: new Date().toISOString()
    });
  }
  
  /**
   * Check if key is currently rate limited
   * @param key - Unique identifier
   * @returns true if still in cooldown
   */
  static isLimited(key: string): boolean {
    const until = this.limits.get(key);
    if (!until) return false;
    
    const now = Date.now();
    if (now >= until) {
      this.limits.delete(key); // Cleanup expired
      return false;
    }
    
    return true;
  }
  
  /**
   * Get remaining cooldown in seconds
   * @param key - Unique identifier
   * @returns Seconds remaining, or 0 if not limited
   */
  static getCountdown(key: string): number {
    const until = this.limits.get(key);
    if (!until) return 0;
    
    const remaining = until - Date.now();
    return Math.max(0, Math.ceil(remaining / 1000));
  }
  
  /**
   * Clear all rate limits (useful for testing)
   */
  static clearAll(): void {
    this.limits.clear();
  }
  
  /**
   * Get all active limits (for debugging)
   */
  static getAll(): Array<{ key: string; until: string; countdown: number }> {
    const now = Date.now();
    const result: Array<{ key: string; until: string; countdown: number }> = [];
    
    for (const [key, until] of this.limits.entries()) {
      if (until > now) {
        result.push({
          key,
          until: new Date(until).toISOString(),
          countdown: Math.ceil((until - now) / 1000)
        });
      }
    }
    
    return result;
  }
}

