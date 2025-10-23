'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  X, 
  Building2, 
  FileText, 
  MapPin, 
  Users,
  Clock,
  Trash2,
  Command
} from 'lucide-react';
import { useGlobalSearch, SearchResult } from '@/hooks/useGlobalSearch';
import { cn } from '@/lib/utils';

interface GlobalSearchBarProps {
  className?: string;
  placeholder?: string;
}

const TYPE_ICONS = {
  project: Building2,
  befaring: FileText,
  fri_befaring: MapPin,
  photo: FileText,
  user: Users
};

const TYPE_LABELS = {
  project: 'Prosjekt',
  befaring: 'Befaring',
  fri_befaring: 'Fri befaring',
  photo: 'Bilde',
  user: 'Bruker'
};

const TYPE_COLORS = {
  project: 'bg-blue-50 text-blue-700 border-blue-300',
  befaring: 'bg-green-50 text-green-700 border-green-300',
  fri_befaring: 'bg-orange-50 text-orange-700 border-orange-300',
  photo: 'bg-purple-50 text-purple-700 border-purple-300',
  user: 'bg-gray-50 text-gray-700 border-gray-300'
};

export default function GlobalSearchBar({ 
  className, 
  placeholder = "Søk i alle prosjekter, befaringer og brukere..." 
}: GlobalSearchBarProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { 
    search, 
    recentSearches, 
    saveRecentSearch, 
    clearRecentSearches, 
    loading 
  } = useGlobalSearch();

  const searchResults = search(query);
  const allResults = [
    ...searchResults.projects,
    ...searchResults.befaringer,
    ...searchResults.fri_befaringer,
    ...searchResults.photos,
    ...searchResults.users
  ];

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
        setSelectedIndex(0);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle dropdown navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, allResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (allResults[selectedIndex]) {
          handleResultClick(allResults[selectedIndex]);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, allResults, selectedIndex]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

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

  const handleResultClick = (result: SearchResult) => {
    saveRecentSearch(query);
    router.push(result.url);
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(0);
  };

  const handleRecentSearchClick = (recentQuery: string) => {
    setQuery(recentQuery);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleClearQuery = () => {
    setQuery('');
    setSelectedIndex(0);
    inputRef.current?.focus();
  };

  const handleClearRecentSearches = () => {
    clearRecentSearches();
  };

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
        
        {/* Clear button */}
        {query && (
          <button
            onClick={handleClearQuery}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Keyboard shortcut hint */}
        {!isOpen && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1 text-xs text-gray-400">
            <Command className="h-3 w-3" />
            <span>K</span>
          </div>
        )}
      </div>

      {/* Dropdown */}
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
          ) : query.trim() ? (
            // Search Results
            <div className="p-2">
              {allResults.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <Search className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                  <p>Ingen resultater funnet for "{query}"</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {/* Results by category */}
                  {searchResults.projects.length > 0 && (
                    <div>
                      <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Prosjekter ({searchResults.projects.length})
                      </div>
                      {searchResults.projects.map((result, index) => {
                        const Icon = TYPE_ICONS[result.type];
                        return (
                          <button
                            key={result.id}
                            onClick={() => handleResultClick(result)}
                            className={cn(
                              "w-full flex items-center gap-3 p-2 rounded-md text-left hover:bg-gray-50 transition-colors",
                              selectedIndex === index && "bg-blue-50"
                            )}
                          >
                            <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{result.title}</div>
                              <div className="text-xs text-gray-500 truncate">{result.description}</div>
                            </div>
                            <Badge variant="outline" className={cn("text-xs", TYPE_COLORS[result.type])}>
                              {TYPE_LABELS[result.type]}
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {searchResults.befaringer.length > 0 && (
                    <div>
                      <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Befaringer ({searchResults.befaringer.length})
                      </div>
                      {searchResults.befaringer.map((result, index) => {
                        const Icon = TYPE_ICONS[result.type];
                        const globalIndex = searchResults.projects.length + index;
                        return (
                          <button
                            key={result.id}
                            onClick={() => handleResultClick(result)}
                            className={cn(
                              "w-full flex items-center gap-3 p-2 rounded-md text-left hover:bg-gray-50 transition-colors",
                              selectedIndex === globalIndex && "bg-blue-50"
                            )}
                          >
                            <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{result.title}</div>
                              <div className="text-xs text-gray-500 truncate">{result.description}</div>
                            </div>
                            <Badge variant="outline" className={cn("text-xs", TYPE_COLORS[result.type])}>
                              {TYPE_LABELS[result.type]}
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {searchResults.fri_befaringer.length > 0 && (
                    <div>
                      <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Fri befaringer ({searchResults.fri_befaringer.length})
                      </div>
                      {searchResults.fri_befaringer.map((result, index) => {
                        const Icon = TYPE_ICONS[result.type];
                        const globalIndex = searchResults.projects.length + searchResults.befaringer.length + index;
                        return (
                          <button
                            key={result.id}
                            onClick={() => handleResultClick(result)}
                            className={cn(
                              "w-full flex items-center gap-3 p-2 rounded-md text-left hover:bg-gray-50 transition-colors",
                              selectedIndex === globalIndex && "bg-blue-50"
                            )}
                          >
                            <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{result.title}</div>
                              <div className="text-xs text-gray-500 truncate">{result.description}</div>
                            </div>
                            <Badge variant="outline" className={cn("text-xs", TYPE_COLORS[result.type])}>
                              {TYPE_LABELS[result.type]}
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {searchResults.users.length > 0 && (
                    <div>
                      <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Brukere ({searchResults.users.length})
                      </div>
                      {searchResults.users.map((result, index) => {
                        const Icon = TYPE_ICONS[result.type];
                        const globalIndex = searchResults.projects.length + searchResults.befaringer.length + searchResults.fri_befaringer.length + index;
                        return (
                          <button
                            key={result.id}
                            onClick={() => handleResultClick(result)}
                            className={cn(
                              "w-full flex items-center gap-3 p-2 rounded-md text-left hover:bg-gray-50 transition-colors",
                              selectedIndex === globalIndex && "bg-blue-50"
                            )}
                          >
                            <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{result.title}</div>
                              <div className="text-xs text-gray-500 truncate">{result.description}</div>
                            </div>
                            <Badge variant="outline" className={cn("text-xs", TYPE_COLORS[result.type])}>
                              {TYPE_LABELS[result.type]}
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
            // Recent Searches
            <div className="p-2">
              {recentSearches.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between px-2 py-1">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Nylige søk
                    </div>
                    <button
                      onClick={handleClearRecentSearches}
                      className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      Slett alle
                    </button>
                  </div>
                  {recentSearches.map((recentQuery, index) => (
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
      )}
    </div>
  );
}

