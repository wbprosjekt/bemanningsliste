'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, X, Clock, Trash2, Command } from 'lucide-react';
import useGlobalSearchCore from '@/hooks/useGlobalSearchCore';
import { useRecentSearches } from '@/components/providers/RecentSearchProvider';
import useListNavigator from '@/hooks/useListNavigator';
import { TYPE_ICONS, TYPE_LABELS, TYPE_COLORS } from '@/search/searchModel';
import { cn } from '@/lib/utils';

interface GlobalSearchBarProps {
  className?: string;
  placeholder?: string;
}

export default function GlobalSearchBar({ 
  className, 
  placeholder = "Søk i alle prosjekter, befaringer og brukere..." 
}: GlobalSearchBarProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { recent, save, clear, enabled } = useRecentSearches();
  const { projects, inspections, loading } = useGlobalSearchCore(query, 'cached');
  
  const { activeGroup, activeIndex, onKeyDown, reset } = useListNavigator({
    counts: { projects: projects.length, inspections: inspections.length },
    onEnter: (group, index) => {
      if (group === 'projects') {
        const p = projects[index];
        if (p) { save(query); router.push(p.url); setIsOpen(false); setQuery(''); reset(); }
      } else {
        const i = inspections[index];
        if (i) { save(query); router.push(i.url); setIsOpen(false); setQuery(''); reset(); }
      }
    },
  });

  useEffect(() => {
    reset();
  }, [query, reset]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }

      // Escape to close
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
        reset();
      }

      // Handle navigation when dropdown is open and has query
      if (isOpen && query) {
        onKeyDown(e);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, query, onKeyDown, reset]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleResultClick = (url: string) => {
    save(query);
    router.push(url);
    setIsOpen(false);
    setQuery('');
    reset();
  };

  const handleRecentSearchClick = (recentQuery: string) => {
    setQuery(recentQuery);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const showRecents = !query && enabled && recent.length > 0;

  return (
    <div className={cn("relative", className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-10 pr-10"
        />
        
        {query && (
          <button
            onClick={() => { setQuery(''); reset(); inputRef.current?.focus(); }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {!isOpen && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1 text-xs text-gray-400">
            <Command className="h-3 w-3" />
            <span>K</span>
          </div>
        )}
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto"
        >
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent"></div>
              <span className="ml-2">Laster...</span>
            </div>
          ) : showRecents ? (
            <div className="p-2">
              <div className="flex items-center justify-between px-2 py-1">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Nylige søk
                </div>
                <button
                  onClick={clear}
                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Slett alle
                </button>
              </div>
              {recent.map((recentQuery, index) => (
                <button
                  key={index}
                  onClick={() => handleRecentSearchClick(recentQuery)}
                  className="w-full flex items-center gap-3 p-2 rounded-md text-left hover:bg-gray-50 transition-colors"
                >
                  <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div className="text-sm text-gray-700">{recentQuery}</div>
                </button>
              ))}
            </div>
          ) : query.trim() ? (
            <div className="p-2">
              {projects.length === 0 && inspections.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <Search className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                  <p>Ingen resultater funnet for "{query}"</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {projects.length > 0 && (
                    <div>
                      <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Prosjekter ({projects.length})
                      </div>
                      {projects.map((result, index) => {
                        const Icon = TYPE_ICONS.project;
                        const isActive = activeGroup === 'projects' && activeIndex === index;
                        return (
                          <button
                            key={result.id}
                            onClick={() => handleResultClick(result.url)}
                            className={cn(
                              "w-full flex items-center gap-3 p-2 rounded-md text-left hover:bg-gray-50 transition-colors",
                              isActive && "bg-blue-50"
                            )}
                          >
                            <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{result.title}</div>
                              {result.description && <div className="text-xs text-gray-500 truncate">{result.description}</div>}
                            </div>
                            <Badge variant="outline" className={cn("text-xs", TYPE_COLORS.project)}>
                              {TYPE_LABELS.project}
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {inspections.length > 0 && (
                    <div>
                      <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Befaringer ({inspections.length})
                      </div>
                      {inspections.map((result, index) => {
                        const Icon = TYPE_ICONS.befaring;
                        const isActive = activeGroup === 'inspections' && activeIndex === index;
                        return (
                          <button
                            key={result.id}
                            onClick={() => handleResultClick(result.url)}
                            className={cn(
                              "w-full flex items-center gap-3 p-2 rounded-md text-left hover:bg-gray-50 transition-colors",
                              isActive && "bg-blue-50"
                            )}
                          >
                            <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{result.title}</div>
                              {result.description && <div className="text-xs text-gray-500 truncate">{result.description}</div>}
                            </div>
                            <Badge variant="outline" className={cn("text-xs", TYPE_COLORS.befaring)}>
                              {TYPE_LABELS.befaring}
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500">
              <Search className="mx-auto h-8 w-8 text-gray-300 mb-2" />
              <p>Start å skrive for å søke...</p>
              <p className="text-xs mt-1">Trykk Cmd+K for å åpne søket</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}









