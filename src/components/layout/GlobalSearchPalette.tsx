import { useCallback, useEffect, useRef, useState } from "react";
import useProjectSearch from "@/components/layout/useProjectSearch";
import { useRouter } from "next/navigation";

export default function GlobalSearchPalette({ open, onClose }: { open: boolean, onClose: () => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { projects, loading, error } = useProjectSearch(query);
  const router = useRouter();

  // Lukking på ESC
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Fokuser input når åpen
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Andre grupper: placeholder
  const GROUPS = [
    { group: "Befaringer", items: ["Skarnes / Bad", "Skarnes / Kjøkken"] },
    { group: "Bilder", items: ["skarnes_bad_001.jpg", "skarnes_kjøkken_002.png"] }
  ];

  const handleProjectOpen = (id: string) => {
    router.push(`/prosjekt/${id}`);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/30" onMouseDown={onClose}>
      <div className="bg-white rounded-xl w-full max-w-xl shadow-2xl border flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="w-full px-5 py-4 text-lg border-b focus:outline-none rounded-t-xl"
          placeholder="Søk etter prosjekt, befaring, bilder..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div className="p-3 space-y-3 overflow-y-auto max-h-96 min-h-[120px]">
          {/* Prosjektgruppe */}
          <div>
            <div className="text-xs font-semibold text-gray-500 pb-1 px-1">Prosjekter</div>
            <div className="rounded-md border bg-gray-50 min-h-[38px]">
              {loading && (
                <div className="flex items-center gap-2 px-4 py-3 text-gray-500 text-sm">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                  Laster prosjekter…
                </div>
              )}
              {!loading && !error && projects.length > 0 && projects.map(project => (
                <button
                  key={project.id}
                  className="w-full text-left p-2 px-4 text-gray-800 hover:bg-blue-50 rounded flex items-center gap-2 focus:bg-blue-50 focus:outline-none"
                  onClick={() => handleProjectOpen(project.id)}
                >
                  <span className="font-medium">{project.project_name}</span>
                  {project.project_number && <span className="ml-2 text-xs text-gray-400">#{project.project_number}</span>}
                  {project.customer_name && <span className="ml-2 text-xs text-gray-500">({project.customer_name})</span>}
                </button>
              ))}
              {!loading && !error && query.length > 0 && projects.length === 0 && (
                <div className="p-2 px-4 text-gray-500 text-sm">Ingen prosjekter funnet</div>
              )}
              {error && (
                <div className="p-2 px-4 text-red-500 text-sm">{error}</div>
              )}
              {!loading && !error && query.length === 0 && (
                <div className="p-2 px-4 text-gray-400 text-xs">Skriv minst 1 tegn for å søke på prosjekt</div>
              )}
            </div>
          </div>

          {/* Andre grupper dummy inntil videre */}
          {GROUPS.map(({ group, items }) => (
            <div key={group}>
              <div className="text-xs font-semibold text-gray-500 pb-1 px-1">{group}</div>
              <div className="rounded-md border bg-gray-50">
                {items.map(item => (
                  <div key={item} className="p-2 px-4 text-gray-800 cursor-pointer hover:bg-blue-50 rounded flex items-center gap-2">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-2 text-xs text-gray-400 border-t bg-gray-50 rounded-b-xl flex justify-between items-center">
          <span>ESC for å lukke • Pil opp/ned • Enter</span>
          <span className="text-[10px]">Global søk v1 (prosjektsøk ekte data)</span>
        </div>
      </div>
    </div>
  );
}
