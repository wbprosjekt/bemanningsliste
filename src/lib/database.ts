/**
 * Database utilities and security helpers
 * Provides secure database operations with built-in protection against SQL injection
 */

import { supabase } from '@/integrations/supabase/client';
import { validateUUID, validateDate, validateHours, ValidationError } from './validation';

/**
 * Secure database query builder with automatic validation
 */
export class SecureQueryBuilder {
  private table: string;
  private query: any;

  constructor(table: string) {
    this.table = table;
    this.query = supabase.from(table);
  }

  /**
   * Add a select clause with validation
   */
  select(columns: string = '*'): this {
    // Validate column names to prevent injection
    if (columns !== '*') {
      const columnList = columns.split(',').map(col => col.trim());
      const sanitizedColumns = columnList
        .filter(col => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col))
        .join(', ');
      
      if (sanitizedColumns !== columns) {
        throw new ValidationError('Invalid column names detected');
      }
    }
    
    this.query = this.query.select(columns);
    return this;
  }

  /**
   * Add an equality filter with UUID validation
   */
  eq(column: string, value: string | number): this {
    // Validate column name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
      throw new ValidationError('Invalid column name');
    }

    // Validate UUID values
    if (typeof value === 'string' && (column.includes('id') || column.includes('_id'))) {
      validateUUID(value);
    }

    this.query = this.query.eq(column, value);
    return this;
  }

  /**
   * Add an inequality filter with validation
   */
  neq(column: string, value: string | number): this {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
      throw new ValidationError('Invalid column name');
    }

    this.query = this.query.neq(column, value);
    return this;
  }

  /**
   * Add a greater than filter
   */
  gt(column: string, value: string | number): this {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
      throw new ValidationError('Invalid column name');
    }

    this.query = this.query.gt(column, value);
    return this;
  }

  /**
   * Add a less than filter
   */
  lt(column: string, value: string | number): this {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
      throw new ValidationError('Invalid column name');
    }

    this.query = this.query.lt(column, value);
    return this;
  }

  /**
   * Add a greater than or equal filter
   */
  gte(column: string, value: string | number): this {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
      throw new ValidationError('Invalid column name');
    }

    this.query = this.query.gte(column, value);
    return this;
  }

  /**
   * Add a less than or equal filter
   */
  lte(column: string, value: string | number): this {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
      throw new ValidationError('Invalid column name');
    }

    this.query = this.query.lte(column, value);
    return this;
  }

  /**
   * Add an 'in' filter with validation
   */
  in(column: string, values: string[] | number[]): this {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
      throw new ValidationError('Invalid column name');
    }

    // Validate UUIDs if column contains 'id'
    if (column.includes('id') && typeof values[0] === 'string') {
      values.forEach(val => validateUUID(val as string));
    }

    this.query = this.query.in(column, values);
    return this;
  }

  /**
   * Add an 'is' filter for null checks
   */
  is(column: string, value: 'null' | 'not.null'): this {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
      throw new ValidationError('Invalid column name');
    }

    this.query = this.query.is(column, value);
    return this;
  }

  /**
   * Add a like filter with validation
   */
  like(column: string, pattern: string): this {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
      throw new ValidationError('Invalid column name');
    }

    // Basic pattern validation to prevent injection
    if (pattern.includes(';') || pattern.includes('--') || pattern.includes('/*')) {
      throw new ValidationError('Invalid pattern detected');
    }

    this.query = this.query.like(column, pattern);
    return this;
  }

  /**
   * Add an ilike filter (case-insensitive like)
   */
  ilike(column: string, pattern: string): this {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
      throw new ValidationError('Invalid column name');
    }

    if (pattern.includes(';') || pattern.includes('--') || pattern.includes('/*')) {
      throw new ValidationError('Invalid pattern detected');
    }

    this.query = this.query.ilike(column, pattern);
    return this;
  }

  /**
   * Add ordering
   */
  order(column: string, options?: { ascending?: boolean }): this {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
      throw new ValidationError('Invalid column name');
    }

    this.query = this.query.order(column, options);
    return this;
  }

  /**
   * Add limit
   */
  limit(count: number): this {
    if (count < 0 || count > 1000) {
      throw new ValidationError('Invalid limit value');
    }

    this.query = this.query.limit(count);
    return this;
  }

  /**
   * Add range (offset and limit)
   */
  range(from: number, to: number): this {
    if (from < 0 || to < from || (to - from) > 1000) {
      throw new ValidationError('Invalid range values');
    }

    this.query = this.query.range(from, to);
    return this;
  }

  /**
   * Execute the query
   */
  async execute() {
    return await this.query;
  }

  /**
   * Get single result
   */
  async single() {
    return await this.query.single();
  }

  /**
   * Get maybe single result (returns null if not found)
   */
  async maybeSingle() {
    return await this.query.maybeSingle();
  }
}

/**
 * Create a secure query builder
 */
export function createSecureQuery(table: string): SecureQueryBuilder {
  // Validate table name
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    throw new ValidationError('Invalid table name');
  }

  return new SecureQueryBuilder(table);
}

/**
 * Secure insert operation with validation
 */
export async function secureInsert(
  table: string,
  data: Record<string, any>
): Promise<{ data: any; error: any }> {
  // Validate table name
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    throw new ValidationError('Invalid table name');
  }

  // Validate and sanitize data based on field names
  const sanitizedData = { ...data };
  
  for (const [key, value] of Object.entries(data)) {
    if (key.includes('id') && typeof value === 'string') {
      sanitizedData[key] = validateUUID(value);
    } else if (key.includes('dato') && typeof value === 'string') {
      sanitizedData[key] = validateDate(value);
    } else if (key.includes('timer') && typeof value === 'number') {
      sanitizedData[key] = validateHours(value);
    }
  }

  return await supabase.from(table).insert(sanitizedData);
}

/**
 * Secure update operation with validation
 */
export async function secureUpdate(
  table: string,
  data: Record<string, any>,
  filter: Record<string, any>
): Promise<{ data: any; error: any }> {
  // Validate table name
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    throw new ValidationError('Invalid table name');
  }

  // Validate and sanitize data
  const sanitizedData = { ...data };
  for (const [key, value] of Object.entries(data)) {
    if (key.includes('id') && typeof value === 'string') {
      sanitizedData[key] = validateUUID(value);
    } else if (key.includes('dato') && typeof value === 'string') {
      sanitizedData[key] = validateDate(value);
    } else if (key.includes('timer') && typeof value === 'number') {
      sanitizedData[key] = validateHours(value);
    }
  }

  // Validate filter conditions
  const sanitizedFilter = { ...filter };
  for (const [key, value] of Object.entries(filter)) {
    if (key.includes('id') && typeof value === 'string') {
      sanitizedFilter[key] = validateUUID(value);
    }
  }

  let query = supabase.from(table).update(sanitizedData);
  
  // Apply filters
  for (const [key, value] of Object.entries(sanitizedFilter)) {
    query = query.eq(key, value);
  }

  return await query;
}

/**
 * Secure delete operation with validation
 */
export async function secureDelete(
  table: string,
  filter: Record<string, any>
): Promise<{ data: any; error: any }> {
  // Validate table name
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    throw new ValidationError('Invalid table name');
  }

  // Validate filter conditions
  const sanitizedFilter = { ...filter };
  for (const [key, value] of Object.entries(filter)) {
    if (key.includes('id') && typeof value === 'string') {
      sanitizedFilter[key] = validateUUID(value);
    }
  }

  let query = supabase.from(table).delete();
  
  // Apply filters
  for (const [key, value] of Object.entries(sanitizedFilter)) {
    query = query.eq(key, value);
  }

  return await query;
}

/**
 * Log database operations for security monitoring
 */
export function logDatabaseOperation(
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
  table: string,
  userId?: string,
  details?: string
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    operation,
    table,
    userId,
    details,
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
  };

  // In production, send to logging service
  if (process.env.NODE_ENV === 'production') {
    console.log('DB_OPERATION:', JSON.stringify(logEntry));
  } else {
    console.log('DB_OPERATION:', logEntry);
  }
}

