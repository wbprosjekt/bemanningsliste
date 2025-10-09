/**
 * Optimized database queries to prevent N+1 problems and improve performance
 * Provides efficient batch operations and optimized data fetching
 */

import { supabase } from '@/integrations/supabase/client';
import { validateUUID, validateDate, ValidationError } from './validation';

interface OptimizedStaffingEntry {
  id: string;
  date: string;
  person: {
    id: string;
    fornavn: string;
    etternavn: string;
    forventet_dagstimer: number | null;
    tripletex_employee_id?: number | null;
  };
  project: {
    id: string;
    tripletex_project_id: number;
    project_number: number;
    color?: string;
  } | null;
  activities: Array<{
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
  }>;
  totalHours: number;
  status: 'missing' | 'draft' | 'ready' | 'approved' | 'sent';
}

/**
 * Optimized query to load all staffing data for multiple weeks in a single request
 * This prevents N+1 problems by fetching all related data at once
 */
export async function loadStaffingDataOptimized(
  orgId: string,
  dateRange: { start: string; end: string },
  personIds?: string[]
): Promise<OptimizedStaffingEntry[]> {
  try {
    validateUUID(orgId);
    validateDate(dateRange.start);
    validateDate(dateRange.end);

    // Single optimized query with all necessary joins
    const { data, error } = await supabase
      .from('vakt')
      .select(`
        id,
        dato,
        person:person_id (
          id,
          fornavn,
          etternavn,
          forventet_dagstimer,
          tripletex_employee_id
        ),
        project:ttx_project_cache (
          id,
          tripletex_project_id,
          project_number,
          project_name
        ),
        vakt_timer (
          id,
          timer,
          status,
          lonnstype,
          notat,
          is_overtime,
          approved_at,
          approved_by,
          tripletex_synced_at,
          tripletex_entry_id,
          sync_error,
          aktivitet_id,
          ttx_activity_cache!vakt_timer_aktivitet_id_fkey (
            ttx_id,
            navn
          )
        )
      `)
      .eq('org_id', orgId)
      .gte('dato', dateRange.start)
      .lte('dato', dateRange.end)
      .order('dato', { ascending: true })
      .order('person_id', { ascending: true });

    if (error) throw error;

    // Transform the data to match the expected interface
    const entries: OptimizedStaffingEntry[] = (data || []).map(entry => {
      const activities = entry.vakt_timer?.map(timer => ({
        id: timer.id,
        timer: timer.timer,
        status: timer.status || 'utkast',
        activity_name: timer.ttx_activity_cache?.navn || 'Unknown',
        lonnstype: timer.lonnstype || 'normal',
        notat: timer.notat || undefined,
        is_overtime: timer.is_overtime || undefined,
        approved_at: timer.approved_at || undefined,
        approved_by: timer.approved_by || undefined,
        tripletex_synced_at: timer.tripletex_synced_at || undefined,
        tripletex_entry_id: timer.tripletex_entry_id || undefined,
        sync_error: timer.sync_error || undefined,
        aktivitet_id: timer.aktivitet_id || undefined,
        ttx_activity_id: timer.ttx_activity_cache?.ttx_id || undefined,
      })) || [];

      const totalHours = activities.reduce((sum, activity) => sum + activity.timer, 0);

      // Determine status based on activities
      let status: OptimizedStaffingEntry['status'] = 'missing';
      if (activities.length > 0) {
        const allApproved = activities.every(a => a.status === 'godkjent');
        const allSent = activities.every(a => a.tripletex_synced_at);
        
        if (allSent) status = 'sent';
        else if (allApproved) status = 'approved';
        else if (activities.some(a => a.status === 'klar')) status = 'ready';
        else status = 'draft';
      }

      return {
        id: entry.id,
        date: entry.dato,
        person: entry.person,
        project: entry.project ? {
          id: entry.project.id,
          tripletex_project_id: entry.project.tripletex_project_id || 0,
          project_number: entry.project.project_number || 0,
          project_name: entry.project.project_name || '',
          color: undefined, // Color will be fetched separately if needed
        } : null,
        activities,
        totalHours,
        status,
      };
    });

    // Filter by person IDs if specified
    if (personIds && personIds.length > 0) {
      return entries.filter(entry => personIds.includes(entry.person.id));
    }

    return entries;
  } catch (error) {
    console.error('Error loading optimized staffing data:', error);
    throw error;
  }
}

/**
 * Optimized query to load all employees for an organization
 */
export async function loadEmployeesOptimized(orgId: string): Promise<any[]> {
  try {
    validateUUID(orgId);

    const { data, error } = await supabase
      .from('person')
      .select('*')
      .eq('org_id', orgId)
      .eq('aktiv', true)
      .order('fornavn', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error loading employees:', error);
    throw error;
  }
}

/**
 * Optimized query to load all projects for an organization
 */
export async function loadProjectsOptimized(orgId: string): Promise<any[]> {
  try {
    validateUUID(orgId);

    const { data, error } = await supabase
      .from('ttx_project_cache')
      .select(`
        id,
        tripletex_project_id,
        project_number,
        project_name
      `)
      .eq('org_id', orgId)
      .order('project_number', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error loading projects:', error);
    throw error;
  }
}

/**
 * Optimized query to load project colors
 */
export async function loadProjectColorsOptimized(orgId: string): Promise<Record<number, string>> {
  try {
    validateUUID(orgId);

    const { data, error } = await supabase
      .from('project_color')
      .select('tripletex_project_id, hex')
      .eq('org_id', orgId);

    if (error) throw error;
    
    const colorMap: Record<number, string> = {};
    data?.forEach((color) => {
      colorMap[color.tripletex_project_id] = color.hex;
    });
    
    return colorMap;
  } catch (error) {
    console.error('Error loading project colors:', error);
    throw error;
  }
}

/**
 * Optimized query to load free lines and bubbles for multiple weeks
 */
export async function loadFreeLinesOptimized(
  orgId: string,
  weekNumbers: number[],
  year: number
): Promise<any[]> {
  try {
    validateUUID(orgId);

    const { data, error } = await supabase
      .from('frie_linjer')
      .select(`
        *,
        frie_bobler (
          id,
          date,
          text,
          color,
          created_at
        )
      `)
      .eq('org_id', orgId)
      .eq('year', year)
      .in('week_number', weekNumbers)
      .order('week_number', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error loading free lines:', error);
    throw error;
  }
}

/**
 * Optimized query to load calendar days for a date range
 */
export async function loadCalendarDaysOptimized(
  dateStrings: string[]
): Promise<any[]> {
  try {
    // Validate all dates
    dateStrings.forEach(date => validateDate(date));

    const { data, error } = await supabase
      .from('kalender_dag')
      .select('*')
      .in('dato', dateStrings);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error loading calendar days:', error);
    throw error;
  }
}

/**
 * Batch update multiple time entries efficiently
 */
export async function batchUpdateTimeEntries(
  updates: Array<{
    id: string;
    status?: string;
    approved_at?: string;
    approved_by?: string;
    tripletex_synced_at?: string;
    tripletex_entry_id?: number;
    sync_error?: string;
  }>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate all IDs
    updates.forEach(update => validateUUID(update.id));

    // Group updates by field to minimize database calls
    const statusUpdates = updates.filter(u => u.status);
    const syncUpdates = updates.filter(u => u.tripletex_synced_at);
    const approvalUpdates = updates.filter(u => u.approved_at);

    const promises: Promise<any>[] = [];

    // Batch status updates
    if (statusUpdates.length > 0) {
      const statusPromise = supabase
        .from('vakt_timer')
        .update({ 
          status: 'godkjent',
          approved_at: new Date().toISOString(),
        })
        .in('id', statusUpdates.map(u => u.id))
        .then();
      promises.push(Promise.resolve(statusPromise));
    }

    // Batch sync updates
    if (syncUpdates.length > 0) {
      const syncPromise = supabase
        .from('vakt_timer')
        .update({ 
          tripletex_synced_at: new Date().toISOString(),
        })
        .in('id', syncUpdates.map(u => u.id))
        .then();
      promises.push(Promise.resolve(syncPromise));
    }

    // Batch approval updates
    if (approvalUpdates.length > 0) {
      const approvalPromise = supabase
        .from('vakt_timer')
        .update({ 
          approved_at: new Date().toISOString(),
        })
        .in('id', approvalUpdates.map(u => u.id))
        .then();
      promises.push(Promise.resolve(approvalPromise));
    }

    // Execute all updates in parallel
    const results = await Promise.all(promises);
    
    // Check for errors
    const errors = results.filter(result => result.error);
    if (errors.length > 0) {
      console.error('Batch update errors:', errors);
      return { success: false, error: 'Some updates failed' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in batch update:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Optimized query to check if projects exist for specific dates/persons
 */
export async function checkExistingProjectsOptimized(
  orgId: string,
  personId: string,
  dates: string[]
): Promise<Set<string>> {
  try {
    validateUUID(orgId);
    validateUUID(personId);
    dates.forEach(date => validateDate(date));

    const { data, error } = await supabase
      .from('vakt')
      .select('project_id')
      .eq('org_id', orgId)
      .eq('person_id', personId)
      .in('dato', dates);

    if (error) throw error;

    const existingProjectIds = new Set<string>();
    (data || []).forEach(entry => {
      if (entry.project_id) {
        existingProjectIds.add(entry.project_id);
      }
    });

    return existingProjectIds;
  } catch (error) {
    console.error('Error checking existing projects:', error);
    return new Set();
  }
}

/**
 * Optimized query to load user profile with organization data
 */
export async function loadUserProfileOptimized(userId: string): Promise<any> {
  try {
    validateUUID(userId);

    const { data, error } = await supabase
      .from('profiles')
      .select('*, org:org_id (id, name)')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  } catch (error) {
    console.error('Error loading user profile:', error);
    throw error;
  }
}

/**
 * NOTE: Custom caching removed - React Query handles all caching now!
 * - React Query provides better cache management
 * - Automatic invalidation on mutations
 * - Better developer experience
 * - Prevents cache inconsistency issues
 */

