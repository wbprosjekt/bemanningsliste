/**
 * React Query hooks for staffing data
 * Provides optimized data fetching with automatic caching and invalidation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  loadStaffingDataOptimized, 
  loadEmployeesOptimized, 
  loadProjectsOptimized,
  loadProjectColorsOptimized,
  loadFreeLinesOptimized,
  loadCalendarDaysOptimized,
} from '@/lib/databaseOptimized';
import { validateUUID } from '@/lib/validation';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook for loading staffing data with React Query
 */
export function useStaffingData(
  orgId: string,
  dateRange: { start: string; end: string },
  personIds?: string[]
) {
  return useQuery({
    queryKey: ['staffing', orgId, dateRange.start, dateRange.end, personIds],
    queryFn: () => loadStaffingDataOptimized(orgId, dateRange, personIds),
    enabled: !!orgId && !!dateRange.start && !!dateRange.end,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook for loading employees
 */
export function useEmployees(orgId: string) {
  return useQuery({
    queryKey: ['employees', orgId],
    queryFn: () => loadEmployeesOptimized(orgId),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes - employees don't change often
  });
}

/**
 * Hook for loading projects
 */
export function useProjects(orgId: string) {
  return useQuery({
    queryKey: ['projects', orgId],
    queryFn: () => loadProjectsOptimized(orgId),
    enabled: !!orgId,
    staleTime: 10 * 60 * 1000, // 10 minutes - projects change rarely
  });
}

/**
 * Hook for loading project colors
 */
export function useProjectColors(orgId: string) {
  return useQuery({
    queryKey: ['projectColors', orgId],
    queryFn: () => loadProjectColorsOptimized(orgId),
    enabled: !!orgId,
    staleTime: 30 * 60 * 1000, // 30 minutes - colors change very rarely
  });
}

/**
 * Hook for loading free lines
 */
export function useFreeLines(orgId: string, weekNumbers: number[], year: number) {
  return useQuery({
    queryKey: ['freeLines', orgId, year, weekNumbers],
    queryFn: () => loadFreeLinesOptimized(orgId, weekNumbers, year),
    enabled: !!orgId && weekNumbers.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook for loading calendar days
 */
export function useCalendarDays(dateStrings: string[]) {
  return useQuery({
    queryKey: ['calendarDays', dateStrings],
    queryFn: () => loadCalendarDaysOptimized(dateStrings),
    enabled: dateStrings.length > 0,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - calendar days don't change
  });
}

/**
 * Hook for saving/updating time entries
 */
export function useTimeEntryMutation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      vaktId: string;
      orgId: string;
      entries: Array<{
        timer: number;
        aktivitetId: string;
        notat: string;
        status: string;
        isOvertime: boolean;
        lonnstype: string;
        overtimeAktivitetId?: string;
      }>;
    }) => {
      // Validate inputs
      validateUUID(data.vaktId);
      validateUUID(data.orgId);

      // Delete all existing timer entries for this vakt
      await supabase
        .from('vakt_timer')
        .delete()
        .eq('vakt_id', data.vaktId);

      // Insert new entries
      const insertData = data.entries.map(entry => ({
        vakt_id: data.vaktId,
        org_id: data.orgId,
        timer: entry.timer,
        aktivitet_id: entry.aktivitetId || null,
        overtime_aktivitet_id: entry.overtimeAktivitetId || null,
        notat: entry.notat || null,
        status: entry.status,
        is_overtime: entry.isOvertime,
        lonnstype: entry.lonnstype,
      }));

      const { error } = await supabase
        .from('vakt_timer')
        .insert(insertData);

      if (error) throw error;

      return { success: true };
    },
    onSuccess: (_, variables) => {
      // Invalidate all staffing queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['staffing'] });
      
      toast({
        title: "Lagret",
        description: "Timeføring ble lagret.",
      });
    },
    onError: (error) => {
      toast({
        title: "Lagring feilet",
        description: error instanceof Error ? error.message : 'En ukjent feil oppstod',
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook for deleting time entries
 */
export function useDeleteTimeEntry() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (vaktId: string) => {
      validateUUID(vaktId);

      const { error } = await supabase
        .from('vakt_timer')
        .delete()
        .eq('vakt_id', vaktId);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staffing'] });
      toast({
        title: "Slettet",
        description: "Timeføring ble slettet.",
      });
    },
    onError: (error) => {
      toast({
        title: "Sletting feilet",
        description: error instanceof Error ? error.message : 'En ukjent feil oppstod',
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook for assigning project to shift (vakt)
 */
export function useAssignProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      vaktId: string;
      projectId: string | null;
    }) => {
      validateUUID(data.vaktId);
      if (data.projectId) {
        validateUUID(data.projectId);
      }

      const { error } = await supabase
        .from('vakt')
        .update({ project_id: data.projectId })
        .eq('id', data.vaktId);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      // Invalidate staffing queries
      queryClient.invalidateQueries({ queryKey: ['staffing'] });
    },
    onError: (error) => {
      toast({
        title: "Feil",
        description: error instanceof Error ? error.message : 'Kunne ikke tildele prosjekt',
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook for loading user profile
 */
export function useUserProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      validateUUID(userId);

      const { data, error } = await supabase
        .from('profiles')
        .select('*, org:org_id (id, name)')
        .eq('user_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

