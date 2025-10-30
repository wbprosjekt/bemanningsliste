import { useCallback, useEffect, useRef, useState } from "react";
import useProjectSearch from "@/components/layout/useProjectSearch";
import useBefaringSearch from "@/components/layout/useBefaringSearch";
import { useRouter } from "next/navigation";
import { useRecentSearches } from "@/components/providers/RecentSearchProvider";
import useListNavigator from "@/hooks/useListNavigator";

export default function GlobalSearchPalette({ open, onClose }: { open: boolean, onClose: () => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { projects, loading: loadingProjects, error: errorProjects } = useProjectSearch(query);
  const { inspections, loading: loadingInspections, error: errorInspections } = useBefaringSearch(query);
  const { recent, save, clear, enabled } = useRecentSearches();
  const router = useRouter();

  const { activeGroup, activeIndex, setActiveGroup, setActiveIndex, reset, onKeyDown } = useListNavigator({
    counts: { projects: projects.length, inspections: inspections.length },
    onEnter: (group, index) => {
      if (group === 'projects') handleProjectOpen(projects[index].id);
      else handleInspectionOpen(inspections[index].id);
    },
  });

  useEffect(() => { setActiveGroup('projects'); setActiveIndex(-1); }, [query, setActiveGroup, setActiveIndex]);

  useEffect(() => {
    if (open) {
      setQuery("");
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (!query) return;
      onKeyDown(e);
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true } as any);
  }, [open, onClose, query, onKeyDown]);

  const handleProjectOpen = (id: string) => { if (query) save(query); router.push(`/prosjekt/${id}`); onClose(); };
  const handleInspectionOpen = (id: string) => { if (query) save(query); router.push(`/befaring/${id}`); onClose(); };

  if (!open) return null;

  const showRecents = !query && enabled && recent.length > 0;

  return (
    <div className="fixed inset-0 z-[500] bg-black/30" onMouseDown={onClose}>
      <div className="w-full flex justify-center items-start pt-6 sm:pt-10" onMouseDown={(e) => e.stopPropagation()}>
        <div className="bg-white rounded-xl w-[92%] max-w-3xl shadow-2xl border flex flex-col max-h-[80vh]">
          <input
            ref={inputRef}
            className="w-full px-5 py-5 text-lg border-b focus:outline-none rounded-t-xl sticky top-0 bg-white"
            placeholder="Søk etter prosjekt, befaring, bilder..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <div className="p-3 space-y-3 overflow-y-auto">
            {showRecents ? (
              <div>
                <div className="text-xs font-semibold text-gray-500 pb-1 px-1">Nylige søk</div>
                <div className="rounded-md border bg-gray-50">
                  {recent.map((q) => (
                    <button key={q} className="w-full text-left p-2 px-4 text-gray-800 hover:bg-blue-50 rounded" onClick={() => { setQuery(q); setTimeout(()=>inputRef.current?.focus(),0); }}>
                      {q}
                    </button>
                  ))}
                </div>
                <div className="flex justify-end p-2">
                  <button className="text-xs text-gray-500 hover:text-gray-700" onClick={clear}>Slett alle</button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <div className="text-xs font-semibold text-gray-500 pb-1 px-1">Prosjekter</div>
                  <div className="rounded-md border bg-gray-50 min-h-[38px]">
                    {!loadingProjects && !errorProjects && projects.length > 0 && projects.map((project, idx) => (
                      <button
                        key={project.id}
                        className={`w-full text-left p-2 px-4 rounded flex items-center gap-2 focus:outline-none ${activeGroup==='projects' && activeIndex===idx ? 'bg-blue-100 text-blue-900' : 'text-gray-800 hover:bg-blue-50'}`}
                        onClick={() => handleProjectOpen(project.id)}
                      >
                        <span className="font-medium">{project.project_name}</span>
                        {project.project_number && <span className="ml-2 text-xs text-gray-500">#{project.project_number}</span>}
                        {project.customer_name && <span className="ml-2 text-xs text-gray-500">({project.customer_name})</span>}
                      </button>
                    ))}
                    {loadingProjects && (
                      <div className="p-3 text-gray-500 text-sm">Laster prosjekter…</div>
                    )}
                    {!loadingProjects && !errorProjects && query.length > 0 && projects.length === 0 && (
                      <div className="p-2 px-4 text-gray-500 text-sm">Ingen prosjekter funnet</div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-500 pb-1 px-1">Befaringer</div>
                  <div className="rounded-md border bg-gray-50 min-h-[38px]">
                    {!loadingInspections && !errorInspections && inspections.length > 0 && inspections.map((b, idx) => (
                      <button
                        key={b.id}
                        className={`w-full text-left p-2 px-4 rounded flex flex-col gap-1 focus:outline-none ${activeGroup==='inspections' && activeIndex===idx ? 'bg-blue-100 text-blue-900' : 'text-gray-800 hover:bg-blue-50'}`}
                        onClick={() => handleInspectionOpen(b.id)}
                      >
                        <span className="font-medium">{b.title || 'Befaring'}</span>
                        <span className="text-xs text-gray-500">{b.tripletex_project_id ? `Prosjekt #${b.tripletex_project_id}` : ''}{b.tripletex_project_id ? ' • ' : ''}{b.befaring_date || ''}{b.status ? ` • ${b.status}` : ''}</span>
                      </button>
                    ))}
                    {loadingInspections && (
                      <div className="p-3 text-gray-500 text-sm">Laster befaringer…</div>
                    )}
                    {!loadingInspections && !errorInspections && query.length > 0 && inspections.length === 0 && (
                      <div className="p-2 px-4 text-gray-500 text-sm">Ingen befaringer funnet</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="px-4 py-2 text-xs text-gray-400 border-t bg-gray-50 rounded-b-xl flex justify-between items-center">
            <span>ESC for å lukke • Pil opp/ned • Enter</span>
            <span className="text-[10px]">Globalt søk</span>
          </div>
        </div>
      </div>
    </div>
  );
}
