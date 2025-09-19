// Core application types
export interface StaffingEntry {
  id: string;
  date: string;
  person: Person;
  project: Project | null;
  activities: Activity[];
  totalHours: number;
  status: 'missing' | 'draft' | 'ready' | 'approved' | 'sent';
}

export interface Person {
  id: string;
  fornavn: string;
  etternavn: string;
  forventet_dagstimer: number;
  tripletex_employee_id?: number;
}

export interface Project {
  id: string;
  tripletex_project_id: number;
  project_name: string;
  project_number: number;
  color?: string;
}

export interface Activity {
  id: string;
  timer: number;
  status: string;
  activity_name: string;
  lonnstype: string;
  notat?: string;
  is_overtime?: boolean;
  approved_at?: string;
  approved_by?: string;
  tripletex_synced_at?: string;
  tripletex_entry_id?: number;
  sync_error?: string;
  aktivitet_id?: string;
  ttx_activity_id?: number;
}

export interface WeekData {
  week: number;
  year: number;
  dates: Date[];
}

// Application constants
export const STAFFING_CONSTANTS = {
  DEFAULT_WEEKS_TO_SHOW: 6,
  DEFAULT_DAILY_HOURS: 8,
  TIME_INCREMENT: 0.25,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000
} as const;

export const API_ENDPOINTS = {
  TRIPLETEX_SESSION: '/tripletex-api',
  SYNC_EMPLOYEES: '/nightly-sync',
  CALENDAR_SYNC: '/calendar-sync'
} as const;

// Error handling types
export interface AppError {
  message: string;
  code?: string;
  details?: unknown;
}

export class AppError extends Error {
  public code?: string;
  public details?: unknown;

  constructor(message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }
}
