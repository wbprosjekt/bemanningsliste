/**
 * Utility functions for checking refusjon module access
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Check if user has access to refusjon_hjemmelading module
 */
export async function hasRefusjonAccess(userId: string): Promise<boolean> {
  try {
    // Get profile_id from profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!profile) return false;

    // Check if module access is enabled
    const { data: moduleAccess } = await supabase
      .from('profile_modules')
      .select('enabled')
      .eq('profile_id', profile.id)
      .eq('module_name', 'refusjon_hjemmelading')
      .single();

    return moduleAccess?.enabled ?? false;
  } catch (error) {
    console.error('Error checking refusjon access:', error);
    return false;
  }
}

/**
 * Check if user is admin or økonomi
 */
export async function isRefusjonAdmin(userId: string): Promise<boolean> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', userId)
      .single();

    return profile?.role === 'admin' || profile?.role === 'økonomi';
  } catch (error) {
    console.error('Error checking admin role:', error);
    return false;
  }
}

