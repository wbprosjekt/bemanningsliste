import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export interface SearchResult {
  id: string;
  title: string;
  description?: string;
  type: 'project' | 'befaring' | 'fri_befaring' | 'photo' | 'user';
  url: string;
  metadata: {
    project_number?: number;
    project_name?: string;
    status?: string;
    date?: string;
    user_name?: string;
    user_role?: string;
  };
}

export interface SearchResults {
  projects: SearchResult[];
  befaringer: SearchResult[];
  fri_befaringer: SearchResult[];
  photos: SearchResult[];
  users: SearchResult[];
  total: number;
}

interface CachedData {
  projects: any[];
  befaringer: any[];
  fri_befaringer: any[];
  users: any[];
}

const RECENT_SEARCHES_KEY = 'fieldnote_recent_searches';
const MAX_RECENT_SEARCHES = 10;

export function useGlobalSearch() {
  const { user } = useAuth();
  const [cachedData, setCachedData] = useState<CachedData>({
    projects: [],
    befaringer: [],
    fri_befaringer: [],
    users: []
  });
  const [loading, setLoading] = useState(true);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load cached data on mount
  useEffect(() => {
    if (user) {
      loadCachedData();
      loadRecentSearches();
    }
  }, [user]);

  const loadCachedData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get user's org_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      // Load all data in parallel
      const [projectsResult, befaringerResult, friBefaringerResult, usersResult] = await Promise.all([
        // Projects
        supabase
          .from('ttx_project_cache')
          .select('id, tripletex_project_id, project_name, project_number, org_id')
          .eq('org_id', profile.org_id)
          .order('project_name', { ascending: true }),

        // Befaringer
        supabase
          .from('befaringer')
          .select('id, title, description, adresse, befaring_date, status, tripletex_project_id, created_at')
          .eq('org_id', profile.org_id)
          .order('befaring_date', { ascending: false }),

        // Fri befaringer
        supabase
          .from('fri_befaringer' as any)
          .select('id, title, description, befaring_date, status, tripletex_project_id, created_at')
          .eq('org_id', profile.org_id)
          .order('created_at', { ascending: false }),

        // Users
        supabase
          .from('profiles')
          .select('id, user_id, full_name, role, org_id')
          .eq('org_id', profile.org_id)
          .order('full_name', { ascending: true })
      ]);

      setCachedData({
        projects: projectsResult.data || [],
        befaringer: befaringerResult.data || [],
        fri_befaringer: friBefaringerResult.data || [],
        users: usersResult.data || []
      });
    } catch (error) {
      console.error('Error loading cached data for global search:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentSearches = () => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  };

  const saveRecentSearch = useCallback((query: string) => {
    if (!query.trim()) return;

    const trimmedQuery = query.trim().toLowerCase();
    const newRecentSearches = [
      trimmedQuery,
      ...recentSearches.filter(search => search !== trimmedQuery)
    ].slice(0, MAX_RECENT_SEARCHES);

    setRecentSearches(newRecentSearches);
    
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(newRecentSearches));
    } catch (error) {
      console.error('Error saving recent search:', error);
    }
  }, [recentSearches]);

  const search = useCallback((query: string): SearchResults => {
    if (!query.trim() || loading) {
      return {
        projects: [],
        befaringer: [],
        fri_befaringer: [],
        photos: [],
        users: [],
        total: 0
      };
    }

    const searchTerm = query.toLowerCase().trim();
    const results: SearchResults = {
      projects: [],
      befaringer: [],
      fri_befaringer: [],
      photos: [],
      users: [],
      total: 0
    };

    // Search projects
    results.projects = cachedData.projects
      .filter(project => {
        const name = project.project_name?.toLowerCase() || '';
        const number = project.project_number?.toString() || '';
        return name.includes(searchTerm) || number.includes(searchTerm);
      })
      .slice(0, 5)
      .map(project => ({
        id: project.id,
        title: project.project_name || 'Uten navn',
        description: `Prosjekt #${project.project_number}`,
        type: 'project' as const,
        url: `/prosjekt/${project.id}`,
        metadata: {
          project_number: project.project_number,
          project_name: project.project_name
        }
      }));

    // Search befaringer
    results.befaringer = cachedData.befaringer
      .filter(befaring => {
        const title = befaring.title?.toLowerCase() || '';
        const description = befaring.description?.toLowerCase() || '';
        const adresse = befaring.adresse?.toLowerCase() || '';
        return title.includes(searchTerm) || 
               description.includes(searchTerm) || 
               adresse.includes(searchTerm);
      })
      .slice(0, 5)
      .map(befaring => ({
        id: befaring.id,
        title: befaring.title || 'Uten tittel',
        description: befaring.description || befaring.adresse || 'Befaring med plantegning',
        type: 'befaring' as const,
        url: `/befaring/${befaring.id}`,
        metadata: {
          project_number: befaring.tripletex_project_id,
          status: befaring.status,
          date: befaring.befaring_date
        }
      }));

    // Search fri befaringer
    results.fri_befaringer = cachedData.fri_befaringer
      .filter(friBefaring => {
        const title = friBefaring.title?.toLowerCase() || '';
        const description = friBefaring.description?.toLowerCase() || '';
        return title.includes(searchTerm) || description.includes(searchTerm);
      })
      .slice(0, 5)
      .map(friBefaring => ({
        id: friBefaring.id,
        title: friBefaring.title || 'Uten tittel',
        description: friBefaring.description || 'Fri befaring',
        type: 'fri_befaring' as const,
        url: `/fri-befaring/${friBefaring.id}`,
        metadata: {
          project_number: friBefaring.tripletex_project_id,
          status: friBefaring.status,
          date: friBefaring.befaring_date
        }
      }));

    // Search users
    results.users = cachedData.users
      .filter(user => {
        const name = user.full_name?.toLowerCase() || '';
        const role = user.role?.toLowerCase() || '';
        return name.includes(searchTerm) || role.includes(searchTerm);
      })
      .slice(0, 3)
      .map(user => ({
        id: user.id,
        title: user.full_name || 'Uten navn',
        description: user.role || 'Bruker',
        type: 'user' as const,
        url: `/admin/brukere`,
        metadata: {
          user_name: user.full_name,
          user_role: user.role
        }
      }));

    // Calculate total
    results.total = results.projects.length + 
                   results.befaringer.length + 
                   results.fri_befaringer.length + 
                   results.photos.length + 
                   results.users.length;

    return results;
  }, [cachedData, loading]);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch (error) {
      console.error('Error clearing recent searches:', error);
    }
  }, []);

  return {
    search,
    recentSearches,
    saveRecentSearch,
    clearRecentSearches,
    loading,
    refreshData: loadCachedData
  };
}
