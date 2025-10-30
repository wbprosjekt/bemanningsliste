"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useCookieConsent } from "@/components/providers/CookieConsentProvider";

const STORAGE_KEY = 'fieldnote_recent_searches';
const MAX_ITEMS = 10;

interface RecentSearchContextValue {
  recent: string[];
  save: (q: string) => void;
  clear: () => void;
  enabled: boolean;
}

const RecentSearchContext = createContext<RecentSearchContextValue | undefined>(undefined);

export function RecentSearchProvider({ children }: { children: React.ReactNode }) {
  const { hasFunctionalConsent } = useCookieConsent();
  const enabled = hasFunctionalConsent();
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled) { setRecent([]); return; }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setRecent(JSON.parse(raw));
    } catch {
      // Ignore localStorage errors
    }
  }, [enabled]);

  const persist = useCallback((items: string[]) => {
    try { 
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); 
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const save = useCallback((q: string) => {
    if (!enabled) return;
    const term = (q || '').trim().toLowerCase();
    if (!term) return;
    const next = [term, ...recent.filter(r => r !== term)].slice(0, MAX_ITEMS);
    setRecent(next);
    persist(next);
  }, [enabled, recent, persist]);

  const clear = useCallback(() => {
    setRecent([]);
    try { 
      localStorage.removeItem(STORAGE_KEY); 
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const value = useMemo(() => ({ recent, save, clear, enabled }), [recent, save, clear, enabled]);
  return <RecentSearchContext.Provider value={value}>{children}</RecentSearchContext.Provider>;
}

export function useRecentSearches() {
  const ctx = useContext(RecentSearchContext);
  if (!ctx) throw new Error('useRecentSearches must be used within RecentSearchProvider');
  return ctx;
}
