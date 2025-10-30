"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProjectSearchResult {
  id: string;
  project_name: string;
  project_number: number;
  customer_name?: string;
}

export default function useProjectSearch(query: string, orgId?: string) {
  const [projects, setProjects] = useState<ProjectSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query || query.length < 1) {
      setProjects([]);
      setLoading(false);
      setError(null);
      return;
    }
    const handler = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        let supa = supabase
          .from('ttx_project_cache')
          .select('id, project_name, project_number, customer_name')
          .ilike('project_name', `%${query}%`);
        if (orgId) {
          supa = supa.eq('org_id', orgId);
        }
        const { data, error } = await supa.limit(18);
        if (error) throw error;
        // Evt filter på project_number også:
        const filtered = (data || []).filter(p =>
          p.project_name?.toLowerCase().includes(query.toLowerCase()) ||
          p.project_number?.toString().includes(query)
        );
        setProjects(filtered as ProjectSearchResult[]);
      } catch (err: any) {
        setError(err.message || 'Feil under prosjektsøk');
        setProjects([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [query, orgId]);

  return { projects, loading, error };
}
