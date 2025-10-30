"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BefaringSearchResult {
  id: string;
  title: string | null;
  befaring_date?: string | null;
  status?: string | null;
  tripletex_project_id?: number | null;
}

export default function useBefaringSearch(query: string, orgId?: string) {
  const [inspections, setInspections] = useState<BefaringSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query || query.length < 1) {
      setInspections([]);
      setLoading(false);
      setError(null);
      return;
    }
    const handler = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        let supa = supabase
          .from('befaringer')
          .select('id, title, befaring_date, status, tripletex_project_id')
          .ilike('title', `%${query}%`);
        if (orgId) {
          supa = supa.eq('org_id', orgId as any);
        }
        const { data, error } = await supa.limit(18);
        if (error) throw error;
        setInspections((data || []) as BefaringSearchResult[]);
      } catch (err: any) {
        setError(err.message || 'Feil under søk i befaringer');
        setInspections([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [query, orgId]);

  return { inspections, loading, error };
}
