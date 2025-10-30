"use client";
import { useMemo } from "react";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import useProjectSearch from "@/components/layout/useProjectSearch";
import useBefaringSearch from "@/components/layout/useBefaringSearch";

export type CoreMode = 'cached' | 'live';

export interface CoreItem {
  id: string;
  title: string;
  description?: string;
  type: 'project' | 'befaring';
  url: string;
}

export interface CoreResults {
  projects: CoreItem[];
  inspections: CoreItem[];
  total: number;
  loading: boolean;
}

export default function useGlobalSearchCore(query: string, mode: CoreMode): CoreResults {
  // Cached path via existing useGlobalSearch
  const { search, loading: cachedLoading } = useGlobalSearch();
  const cached = useMemo(() => (query.trim() ? search(query) : undefined), [search, query]);

  // Live path via hooks
  const { projects, loading: lp } = useProjectSearch(query);
  const { inspections: liveInspections, loading: li } = useBefaringSearch(query);

  if (mode === 'cached') {
    const projectsItems = (cached?.projects || []).map(p => ({
      id: p.id,
      title: p.title,
      description: p.description,
      type: 'project' as const,
      url: p.url,
    }));
    const inspectionItems = (cached?.befaringer || []).map(b => ({
      id: b.id,
      title: b.title,
      description: b.description,
      type: 'befaring' as const,
      url: b.url,
    }));
    const total = projectsItems.length + inspectionItems.length;
    return { projects: projectsItems, inspections: inspectionItems, total, loading: cachedLoading };
  }

  // live
  const projectsItems = projects.map(p => ({
    id: p.id,
    title: p.project_name,
    description: p.project_number ? `Prosjekt #${p.project_number}` : undefined,
    type: 'project' as const,
    url: `/prosjekt/${p.id}`,
  }));
  const inspectionItems = liveInspections.map(b => ({
    id: b.id,
    title: b.title || 'Befaring',
    type: 'befaring' as const,
    url: `/befaring/${b.id}`,
  }));
  const total = projectsItems.length + inspectionItems.length;
  return { projects: projectsItems, inspections: inspectionItems, total, loading: lp || li };
}
