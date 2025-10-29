/**
 * Request logging and security monitoring utilities
 * Provides comprehensive logging for security analysis and debugging
 */

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SECURITY';
  category: string;
  message: string;
  details?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

interface SecurityEvent {
  type: 'AUTH_FAILURE' | 'RATE_LIMIT_EXCEEDED' | 'INVALID_INPUT' | 'SUSPICIOUS_ACTIVITY' | 'CSRF_VIOLATION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  details: Record<string, any>;
  timestamp: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
}

// In-memory log store (in production, use external logging service)
const logStore: LogEntry[] = [];
const securityEvents: SecurityEvent[] = [];

// Configuration
const MAX_LOG_ENTRIES = 1000;
const MAX_SECURITY_EVENTS = 500;

/**
 * Log a message with context
 */
export function log(
  level: LogEntry['level'],
  category: string,
  message: string,
  details?: Record<string, any>,
  context?: {
    userId?: string;
    sessionId?: string;
    ip?: string;
    userAgent?: string;
    requestId?: string;
  }
): void {
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    details,
    ...context,
  };

  // Add to log store
  logStore.push(logEntry);

  // Maintain log store size
  if (logStore.length > MAX_LOG_ENTRIES) {
    logStore.splice(0, logStore.length - MAX_LOG_ENTRIES);
  }

  // Output to console based on level
  const logMessage = `[${logEntry.timestamp}] ${level} [${category}] ${message}`;
  
  switch (level) {
    case 'ERROR':
    case 'SECURITY':
      console.error(logMessage, details);
      break;
    case 'WARN':
      console.warn(logMessage, details);
      break;
    case 'INFO':
    default:
      console.log(logMessage, details);
      break;
  }

  // In production, send to external logging service
  if (process.env.NODE_ENV === 'production') {
    sendToLoggingService(logEntry);
  }
}

/**
 * Log security events
 */
export function logSecurityEvent(
  type: SecurityEvent['type'],
  severity: SecurityEvent['severity'],
  description: string,
  details: Record<string, any> = {},
  context?: {
    userId?: string;
    ip?: string;
    userAgent?: string;
  }
): void {
  const event: SecurityEvent = {
    type,
    severity,
    description,
    details,
    timestamp: new Date().toISOString(),
    ...context,
  };

  // Add to security events store
  securityEvents.push(event);

  // Maintain security events store size
  if (securityEvents.length > MAX_SECURITY_EVENTS) {
    securityEvents.splice(0, securityEvents.length - MAX_SECURITY_EVENTS);
  }

  // Log as security event
  log('SECURITY', 'SECURITY_EVENT', description, {
    eventType: type,
    severity,
    ...details,
  }, context);

  // In production, send to security monitoring service
  if (process.env.NODE_ENV === 'production') {
    sendToSecurityService(event);
  }
}

/**
 * Get request context from various sources
 */
export function getRequestContext(request?: Request, _userId?: string): {
  ip?: string;
  userAgent?: string;
  requestId?: string;
} {
  const context: any = {};

  if (request) {
    // Get IP address
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    context.ip = forwarded?.split(',')[0] || realIp || 'unknown';

    // Get user agent
    context.userAgent = request.headers.get('user-agent') || 'unknown';

    // Get request ID if present
    context.requestId = request.headers.get('x-request-id');
  }

  if (typeof window !== 'undefined') {
    context.userAgent = window.navigator.userAgent;
  }

  return context;
}

/**
 * Generate unique request ID
 */
export function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * Request monitoring middleware
 */
type RequestHandler = (request: Request, context?: RequestContext) => Promise<Response> | Response;
type RequestContext = {
  user?: { id?: string };
} & Record<string, unknown>;

export function withRequestMonitoring(
  handler: RequestHandler,
  options: {
    logLevel?: LogEntry['level'];
    category?: string;
    trackPerformance?: boolean;
    trackErrors?: boolean;
  } = {}
) {
  const {
    logLevel = 'INFO',
    category = 'REQUEST',
    trackPerformance = true,
    trackErrors = true,
  } = options;

  return async (request: Request, context?: RequestContext) => {
    const requestId = generateRequestId();
    const startTime = Date.now();
    const requestContext = getRequestContext(request, context?.user?.id);

    // Log request start
    log(logLevel, category, 'Request started', {
      method: request.method,
      url: request.url,
      requestId,
    }, {
      ...requestContext,
      requestId,
      userId: context?.user?.id,
    });

    try {
      // Execute handler
      const response = await handler(request, context);

      // Log successful response
      const duration = Date.now() - startTime;
      log(logLevel, category, 'Request completed', {
        method: request.method,
        url: request.url,
        status: response?.status || 'unknown',
        duration,
        requestId,
      }, {
        ...requestContext,
        requestId,
        userId: context?.user?.id,
      });

      // Add performance tracking
      if (trackPerformance && duration > 1000) {
        log('WARN', category, 'Slow request detected', {
          method: request.method,
          url: request.url,
          duration,
          requestId,
        }, {
          ...requestContext,
          requestId,
          userId: context?.user?.id,
        });
      }

      return response;

    } catch (error) {
      const duration = Date.now() - startTime;

      // Log error
      if (trackErrors) {
        log('ERROR', category, 'Request failed', {
          method: request.method,
          url: request.url,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration,
          requestId,
        }, {
          ...requestContext,
          requestId,
          userId: context?.user?.id,
        });

        // Log security event if it's a potential security issue
        if (error instanceof Error) {
          if (error.message.includes('CSRF') || error.message.includes('rate limit')) {
            logSecurityEvent(
              error.message.includes('CSRF') ? 'CSRF_VIOLATION' : 'RATE_LIMIT_EXCEEDED',
              'HIGH',
              error.message,
              {
                method: request.method,
                url: request.url,
                requestId,
              },
              requestContext
            );
          }
        }
      }

      throw error;
    }
  };
}

/**
 * Database operation monitoring
 */
export function logDatabaseOperation(
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
  table: string,
  details: Record<string, any> = {},
  context?: {
    userId?: string;
    sessionId?: string;
  }
): void {
  log('INFO', 'DATABASE', `${operation} operation on ${table}`, details, context);
}

/**
 * Authentication monitoring
 */
export function logAuthEvent(
  event: 'LOGIN_SUCCESS' | 'LOGIN_FAILURE' | 'LOGOUT' | 'TOKEN_REFRESH',
  details: Record<string, any> = {},
  context?: {
    userId?: string;
    ip?: string;
    userAgent?: string;
  }
): void {
  const level = event === 'LOGIN_FAILURE' ? 'WARN' : 'INFO';
  log(level, 'AUTH', `Authentication event: ${event}`, details, context);

  // Log security event for failures
  if (event === 'LOGIN_FAILURE') {
    logSecurityEvent(
      'AUTH_FAILURE',
      'MEDIUM',
      'Failed login attempt',
      details,
      context
    );
  }
}

/**
 * Input validation monitoring
 */
export function logValidationFailure(
  input: string,
  validationError: string,
  context?: {
    userId?: string;
    sessionId?: string;
    ip?: string;
  }
): void {
  log('WARN', 'VALIDATION', 'Input validation failed', {
    input,
    error: validationError,
  }, context);

  // Log security event for repeated failures
  logSecurityEvent(
    'INVALID_INPUT',
    'LOW',
    'Input validation failure',
    {
      input,
      error: validationError,
    },
    context
  );
}

/**
 * Performance monitoring
 */
export function logPerformanceMetric(
  metric: string,
  value: number,
  unit: 'ms' | 'bytes' | 'count' = 'ms',
  details?: Record<string, any>
): void {
  log('INFO', 'PERFORMANCE', `Performance metric: ${metric}`, {
    metric,
    value,
    unit,
    ...details,
  });
}

/**
 * Get recent logs
 */
export function getRecentLogs(count: number = 100): LogEntry[] {
  return logStore.slice(-count);
}

/**
 * Get recent security events
 */
export function getRecentSecurityEvents(count: number = 50): SecurityEvent[] {
  return securityEvents.slice(-count);
}

/**
 * Clear old logs (for memory management)
 */
export function clearOldLogs(): void {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
  
  // Remove old log entries
  const filteredLogs = logStore.filter(entry => 
    new Date(entry.timestamp) > cutoff
  );
  logStore.splice(0, logStore.length, ...filteredLogs);

  // Remove old security events
  const filteredEvents = securityEvents.filter(event => 
    new Date(event.timestamp) > cutoff
  );
  securityEvents.splice(0, securityEvents.length, ...filteredEvents);
}

/**
 * Send to external logging service (placeholder)
 */
async function sendToLoggingService(_logEntry: LogEntry): Promise<void> {
  // In production, implement actual logging service integration
  // Examples: DataDog, LogRocket, Sentry, etc.
  try {
    // Example: Send to external API
    // await fetch('https://logs.your-service.com/api/logs', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(logEntry),
    // });
  } catch (error) {
    console.error('Failed to send log to external service:', error);
  }
}

/**
 * Send to security monitoring service (placeholder)
 */
async function sendToSecurityService(_event: SecurityEvent): Promise<void> {
  // In production, implement actual security monitoring integration
  // Examples: AWS GuardDuty, Azure Security Center, etc.
  try {
    // Example: Send to security API
    // await fetch('https://security.your-service.com/api/events', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(event),
    // });
  } catch (error) {
    console.error('Failed to send security event to external service:', error);
  }
}

/**
 * Health check for monitoring system
 */
export function getMonitoringHealth(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  logsCount: number;
  securityEventsCount: number;
  oldestLog?: string;
  newestLog?: string;
} {
  const logsCount = logStore.length;
  const securityEventsCount = securityEvents.length;
  
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  if (logsCount > MAX_LOG_ENTRIES * 0.9) {
    status = 'degraded';
  }
  
  if (securityEventsCount > MAX_SECURITY_EVENTS * 0.9) {
    status = 'degraded';
  }
  
  if (logsCount === 0 && securityEventsCount === 0) {
    status = 'unhealthy';
  }

  return {
    status,
    logsCount,
    securityEventsCount,
    oldestLog: logStore[0]?.timestamp,
    newestLog: logStore[logStore.length - 1]?.timestamp,
  };
}
