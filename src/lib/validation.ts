/**
 * Input validation and sanitization utilities
 * Provides secure validation for all user inputs
 */

// Simple sanitization without DOMPurify (Turbopack compatibility)
const sanitizeHTML = (str: string): string => {
  if (typeof window === 'undefined') {
    // Server-side: simple escaping
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  // Client-side: create a temporary div
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

// Validation error types
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Sanitization options
interface SanitizeOptions {
  allowHTML?: boolean;
  maxLength?: number;
  trimWhitespace?: boolean;
}

/**
 * Sanitize string input to prevent XSS and other attacks
 */
export function sanitizeString(
  input: unknown,
  options: SanitizeOptions = {}
): string {
  const {
    allowHTML = false,
    maxLength = 1000,
    trimWhitespace = true
  } = options;

  // Handle null/undefined
  if (input === null || input === undefined) {
    return '';
  }

  // Convert to string
  let str = String(input);

  // Trim whitespace if requested
  if (trimWhitespace) {
    str = str.trim();
  }

  // Limit length
  if (str.length > maxLength) {
    str = str.substring(0, maxLength);
  }

  // Sanitize HTML if not allowed
  if (!allowHTML) {
    str = sanitizeHTML(str);
  }

  return str;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): string {
  const sanitized = sanitizeString(email, { maxLength: 254 });
  
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(sanitized)) {
    throw new ValidationError('Invalid email format', 'email');
  }
  
  return sanitized.toLowerCase();
}

/**
 * Validate and sanitize project name
 */
export function validateProjectName(name: string): string {
  const sanitized = sanitizeString(name, { maxLength: 200 });
  
  if (sanitized.length < 1) {
    throw new ValidationError('Project name cannot be empty', 'projectName');
  }
  
  if (sanitized.length > 200) {
    throw new ValidationError('Project name too long', 'projectName');
  }
  
  return sanitized;
}

/**
 * Validate and sanitize person name
 */
export function validatePersonName(name: string): string {
  const sanitized = sanitizeString(name, { maxLength: 100 });
  
  if (sanitized.length < 1) {
    throw new ValidationError('Name cannot be empty', 'personName');
  }
  
  // Allow letters, spaces, hyphens, and common name characters
  const nameRegex = /^[a-zA-ZæøåÆØÅ\s\-.]+$/;
  if (!nameRegex.test(sanitized)) {
    throw new ValidationError('Name contains invalid characters', 'personName');
  }
  
  return sanitized;
}

/**
 * Validate hours input (decimal number)
 */
export function validateHours(hours: unknown): number {
  const num = Number(hours);
  
  if (isNaN(num)) {
    throw new ValidationError('Hours must be a valid number', 'hours');
  }
  
  if (num < 0) {
    throw new ValidationError('Hours cannot be negative', 'hours');
  }
  
  if (num > 24) {
    throw new ValidationError('Hours cannot exceed 24 per day', 'hours');
  }
  
  // Round to 2 decimal places
  return Math.round(num * 100) / 100;
}

/**
 * Validate UUID format
 */
export function validateUUID(uuid: string): string {
  const sanitized = sanitizeString(uuid, { maxLength: 36 });
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(sanitized)) {
    throw new ValidationError('Invalid UUID format', 'uuid');
  }
  
  return sanitized.toLowerCase();
}

/**
 * Validate date string (YYYY-MM-DD format)
 */
export function validateDate(dateString: string): string {
  const sanitized = sanitizeString(dateString, { maxLength: 10 });
  
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(sanitized)) {
    throw new ValidationError('Date must be in YYYY-MM-DD format', 'date');
  }
  
  const date = new Date(sanitized);
  if (isNaN(date.getTime())) {
    throw new ValidationError('Invalid date', 'date');
  }
  
  return sanitized;
}

/**
 * Validate week number (1-53)
 */
export function validateWeekNumber(week: unknown): number {
  const num = Number(week);
  
  if (isNaN(num) || !Number.isInteger(num)) {
    throw new ValidationError('Week must be a valid integer', 'week');
  }
  
  if (num < 1 || num > 53) {
    throw new ValidationError('Week must be between 1 and 53', 'week');
  }
  
  return num;
}

/**
 * Validate year (reasonable range)
 */
export function validateYear(year: unknown): number {
  const num = Number(year);
  
  if (isNaN(num) || !Number.isInteger(num)) {
    throw new ValidationError('Year must be a valid integer', 'year');
  }
  
  const currentYear = new Date().getFullYear();
  if (num < 2020 || num > currentYear + 5) {
    throw new ValidationError(`Year must be between 2020 and ${currentYear + 5}`, 'year');
  }
  
  return num;
}

/**
 * Validate organization ID
 */
export function validateOrgId(orgId: string): string {
  return validateUUID(orgId);
}

/**
 * Validate person ID
 */
export function validatePersonId(personId: string): string {
  return validateUUID(personId);
}

/**
 * Validate project ID
 */
export function validateProjectId(projectId: string): string {
  return validateUUID(projectId);
}

/**
 * Validate status values
 */
export function validateStatus(status: string): string {
  const sanitized = sanitizeString(status, { maxLength: 20 });
  
  const allowedStatuses = ['utkast', 'klar', 'godkjent', 'sendt'];
  
  if (!allowedStatuses.includes(sanitized)) {
    throw new ValidationError(`Invalid status: ${sanitized}`, 'status');
  }
  
  return sanitized;
}

/**
 * Validate overtime type
 */
export function validateOvertimeType(type: string): string {
  const sanitized = sanitizeString(type, { maxLength: 20 });
  
  const allowedTypes = ['normal', 'overtid_50', 'overtid_100'];
  
  if (!allowedTypes.includes(sanitized)) {
    throw new ValidationError(`Invalid overtime type: ${sanitized}`, 'overtimeType');
  }
  
  return sanitized;
}

/**
 * Validate and sanitize text input for free lines
 */
export function validateFreeLineText(text: string): string {
  const sanitized = sanitizeString(text, { maxLength: 500 });
  
  // Allow basic punctuation and line breaks
  const textRegex = /^[a-zA-ZæøåÆØÅ0-9\s\-.,!?:;()\n\r]*$/;
  if (!textRegex.test(sanitized)) {
    throw new ValidationError('Text contains invalid characters', 'freeLineText');
  }
  
  return sanitized;
}

/**
 * Batch validation helper
 */
export function validateBatch<T extends Record<string, unknown>>(
  data: T,
  validators: { [K in keyof T]: (value: unknown) => T[K] }
): T {
  const result = {} as T;
  const errors: string[] = [];
  
  for (const [key, validator] of Object.entries(validators)) {
    try {
      result[key as keyof T] = validator(data[key as keyof T]);
    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push(`${key}: ${error.message}`);
      } else {
        errors.push(`${key}: Validation failed`);
      }
    }
  }
  
  if (errors.length > 0) {
    throw new ValidationError(`Validation failed: ${errors.join(', ')}`);
  }
  
  return result;
}

