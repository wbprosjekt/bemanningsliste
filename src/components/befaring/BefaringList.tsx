'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import FriBefaringDialog from '../fri-befaring/FriBefaringDialog';
import { 
  Search, 
  FileText, 
  Calendar,
  MapPin,
  AlertTriangle,
  Archive,
  CheckCircle2,
  X,
  Grid3X3,
  List,
  Trash2,
  Plus
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Befaring {
  id: string;
  title: string | null;
  description: string | null;
  adresse: string | null;
  befaring_date: string | null;
  befaring_type: string | null;
  status: string | null;
  created_at: string | null;
  tripletex_project_id: number | null;
  type: 'plantegning' | 'fri'; // New field to distinguish befaring types
  _oppgaver_count?: {
    total: number;
    apen: number;
    under_arbeid: number;
    lukket: number;
    kritisk_frist: number;
  };
  _plantegninger_count?: number;
  _project_info?: {
    project_number: number | null;
    project_name: string | null;
  } | null;
}

interface BefaringListProps {
  orgId: string;
  userId: string;
}

export default function BefaringList({ orgId, userId }: BefaringListProps) {
  const router = useRouter();
  const [befaringer, setBefaringer] = useState<Befaring[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'alle' | 'aktiv' | 'uten_prosjekt' | 'arkivert'>('aktiv');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [befaringToDelete, setBefaringToDelete] = useState<Befaring | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBefaringDialog, setShowBefaringDialog] = useState(false);
  const { toast } = useToast();

  // Generer søkeforslag basert på befaringer
  const searchSuggestions = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    
    const suggestions = new Set<string>();
    
    befaringer.forEach(befaring => {
      const loweredQuery = searchQuery.toLowerCase();

      // Tittel
      if (befaring.title && befaring.title.toLowerCase().includes(loweredQuery)) {
        suggestions.add(befaring.title);
      }
      
      // Prosjektnummer
      if (befaring._project_info?.project_number?.toString().includes(searchQuery)) {
        suggestions.add(`#${befaring._project_info.project_number}`);
      }
      
      // Prosjektnavn
      if (befaring._project_info?.project_name?.toLowerCase().includes(searchQuery.toLowerCase())) {
        suggestions.add(befaring._project_info.project_name);
      }
      
      // Adresse
      if (befaring.adresse?.toLowerCase().includes(searchQuery.toLowerCase())) {
        suggestions.add(befaring.adresse);
      }
      
      // Befaringstype
      if (befaring.befaring_type && befaring.befaring_type.toLowerCase().includes(loweredQuery)) {
        suggestions.add(befaring.befaring_type);
      }
      
      // Befaring type (plantegning/fri)
      if (befaring.type && befaring.type.toLowerCase().includes(loweredQuery)) {
        suggestions.add(befaring.type === 'fri' ? 'Fri befaring' : 'Plantegning');
      }
      
      // Beskrivelse
      if (befaring.description?.toLowerCase().includes(searchQuery.toLowerCase())) {
        // Ta første del av beskrivelsen
        const words = befaring.description.split(' ').slice(0, 3).join(' ');
        if (words.length > 0) suggestions.add(words + '...');
      }
    });
    
    return Array.from(suggestions).slice(0, 5);
  }, [befaringer, searchQuery]);

  useEffect(() => {
    loadBefaringer();
  }, [orgId, filter]);

  const loadBefaringer = async () => {
    setLoading(true);
    try {
      const allBefaringer: Befaring[] = [];

      // Load befaringer with plantegning (existing functionality)
      if (filter === 'alle' || filter === 'aktiv' || filter === 'arkivert') {
        let query = supabase
          .from('befaringer')
          .select(`
            id,
            title,
            description,
            adresse,
            befaring_date,
            befaring_type,
            status,
            created_at,
            tripletex_project_id
          `)
          .eq('org_id', orgId)
          .order('befaring_date', { ascending: false });

        // Filter på status
        if (filter !== 'alle') {
          query = query.eq('status', filter);
        }

        const { data: befaringerData, error: befaringerError } = await query;
        if (befaringerError) throw befaringerError;

        // Process befaringer with plantegning
        const befaringerMedStats = await Promise.all((befaringerData || []).map(async (befaring) => {
          // Hent oppgavestatistikk
          const { data: oppgaverData } = await supabase
            .from('oppgaver')
            .select('status, frist')
            .eq('befaring_id', befaring.id);

          // Hent plantegningstall
          const { count: plantegningerCount } = await supabase
            .from('plantegninger')
            .select('*', { count: 'exact', head: true })
            .eq('befaring_id', befaring.id);

          // Hent prosjektinfo hvis tilgjengelig
          let project_info = null;
          if (befaring.tripletex_project_id) {
            const { data: projectData } = await supabase
              .from('ttx_project_cache')
              .select('project_number, project_name')
              .eq('tripletex_project_id', befaring.tripletex_project_id)
              .eq('org_id', orgId)
              .single();
            
            if (projectData) {
              project_info = {
                project_number: projectData.project_number,
                project_name: projectData.project_name
              };
            }
          }

          // Beregn oppgavestatistikk
          const oppgaver = (oppgaverData || []) as any[];
          const oppgaver_count = {
            total: oppgaver.length,
            apen: oppgaver.filter(o => o.status === 'åpen').length,
            under_arbeid: oppgaver.filter(o => o.status === 'under_arbeid').length,
            lukket: oppgaver.filter(o => o.status === 'lukket').length,
            kritisk_frist: oppgaver.filter(o => {
              if (!o.frist) return false;
              const frist = new Date(o.frist);
              const today = new Date();
              const diffDays = Math.ceil((frist.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              return diffDays <= 7 && diffDays >= 0;
            }).length,
          };

          return {
            ...befaring,
            type: 'plantegning' as const,
            _oppgaver_count: oppgaver_count,
            _plantegninger_count: plantegningerCount || 0,
            _project_info: project_info,
          };
        }));

        allBefaringer.push(...befaringerMedStats);
      }

      // Load fri befaringer
      if (filter === 'alle' || filter === 'uten_prosjekt' || filter === 'arkivert' || filter === 'aktiv') {
        let friQuery = supabase
          .from('fri_befaringer' as any)
          .select(`
            id,
            title,
            description,
            befaring_date,
            status,
            created_at,
            tripletex_project_id
          `)
          .eq('org_id', orgId)
          .order('created_at', { ascending: false });

        // Filter logic for fri befaringer
        if (filter === 'uten_prosjekt') {
          friQuery = friQuery.is('tripletex_project_id', null).eq('status', 'aktiv');
        } else if (filter === 'arkivert') {
          friQuery = friQuery.eq('status', 'arkivert');
        } else if (filter === 'aktiv') {
          friQuery = friQuery.eq('status', 'aktiv').not('tripletex_project_id', 'is', null);
        }
        // For 'alle' filter, don't add any additional filters

        const { data: friBefaringerData, error: friError } = await friQuery;
        if (friError) throw friError;

        // Process fri befaringer
        const friBefaringerMedStats = await Promise.all((friBefaringerData || []).map(async (friBefaring: any) => {
          // Hent oppgavestatistikk for fri befaringer (from befaring_oppgaver)
          const { data: oppgaverData } = await supabase
            .from('befaring_oppgaver' as any)
            .select('status, frist')
            .eq('fri_befaring_id', friBefaring.id);

          // Hent prosjektinfo hvis tilgjengelig
          let project_info = null;
          if (friBefaring.tripletex_project_id) {
            const { data: projectData } = await supabase
              .from('ttx_project_cache')
              .select('project_number, project_name')
              .eq('tripletex_project_id', friBefaring.tripletex_project_id)
              .eq('org_id', orgId)
              .single();
            
            if (projectData) {
              project_info = {
                project_number: projectData.project_number,
                project_name: projectData.project_name
              };
            }
          }

          // Beregn oppgavestatistikk
          const oppgaver = (oppgaverData || []) as any[];
          const oppgaver_count = {
            total: oppgaver.length,
            apen: oppgaver.filter(o => o.status === 'åpen').length,
            under_arbeid: oppgaver.filter(o => o.status === 'under_arbeid').length,
            lukket: oppgaver.filter(o => o.status === 'lukket').length,
            kritisk_frist: oppgaver.filter(o => {
              if (!o.frist) return false;
              const frist = new Date(o.frist);
              const today = new Date();
              const diffDays = Math.ceil((frist.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              return diffDays <= 7 && diffDays >= 0;
            }).length,
          };

          return {
            id: friBefaring.id,
            title: friBefaring.title,
            description: friBefaring.description,
            adresse: null, // Fri befaringer har ikke adresse
            befaring_date: friBefaring.befaring_date,
            befaring_type: 'fri_befaring',
            status: friBefaring.status,
            created_at: friBefaring.created_at,
            tripletex_project_id: friBefaring.tripletex_project_id,
            type: 'fri' as const,
            _oppgaver_count: oppgaver_count,
            _plantegninger_count: 0, // Fri befaringer har ingen plantegninger
            _project_info: project_info,
          };
        }));

        allBefaringer.push(...friBefaringerMedStats);
      }

      // Sort combined results by date
      allBefaringer.sort((a, b) => {
        const dateA = a.befaring_date ? new Date(a.befaring_date).getTime() : new Date(a.created_at || 0).getTime();
        const dateB = b.befaring_date ? new Date(b.befaring_date).getTime() : new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });

      setBefaringer(allBefaringer);
    } catch (error) {
      console.error('Error loading befaringer:', error);
      toast({
        title: 'Feil ved lasting',
        description: 'Kunne ikke laste befaringer. Prøv igjen.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBefaring = async () => {
    if (!befaringToDelete) return;

    setIsDeleting(true);
    try {
      if (befaringToDelete.type === 'fri') {
        // Handle fri befaring deletion
        // 1. Slett alle bilder fra storage bucket
        const { data: punkter } = await supabase
          .from('befaring_punkter' as any)
          .select('id')
          .eq('fri_befaring_id', befaringToDelete.id);

        if (punkter && punkter.length > 0) {
          const punktIds = punkter.map(p => p.id);
          
          // Hent alle bilder for disse punktene
          const { data: bilder } = await supabase
            .from('oppgave_bilder')
            .select('image_url')
            .in('befaring_punkt_id', punktIds)
            .eq('image_source', 'punkt');

          if (bilder && bilder.length > 0) {
            const filePaths = bilder
              .map(b => b.image_url)
              .filter((url): url is string => Boolean(url))
              .map(url => {
                // Extract file path from URL
                const parts = url.split('/storage/v1/object/');
                return parts[1] ? parts[1].split('?')[0] : null;
              })
              .filter((path): path is string => Boolean(path));

            if (filePaths.length > 0) {
              const { error: storageError } = await supabase.storage
                .from('befaring-assets')
                .remove(filePaths);

              if (storageError) {
                console.warn('Error deleting storage files:', storageError);
                // Continue with database deletion even if storage fails
              }
            }
          }
        }

        // 2. Slett fra database (cascade should handle most of this)
        const { error } = await supabase
          .from('fri_befaringer' as any)
          .delete()
          .eq('id', befaringToDelete.id);

        if (error) throw error;

      } else {
        // Handle plantegning befaring deletion (existing logic)
        // 1. Hent alle plantegninger for denne befaringen
        const { data: plantegninger } = await supabase
          .from('plantegninger')
          .select('id, image_url')
          .eq('befaring_id', befaringToDelete.id);

        // 2. Slett alle filer fra storage bucket
        if (plantegninger && plantegninger.length > 0) {
          const filePaths = plantegninger
            .map(p => p.image_url)
            .filter((url): url is string => Boolean(url))
            .map(url => {
              // Extract file path from URL
              const parts = url.split('/storage/v1/object/');
              return parts[1] ? parts[1].split('?')[0] : null;
            })
            .filter((path): path is string => Boolean(path));

          if (filePaths.length > 0) {
            const { error: storageError } = await supabase.storage
              .from('befaring-assets')
              .remove(filePaths);

            if (storageError) {
              console.warn('Error deleting storage files:', storageError);
              // Continue with database deletion even if storage fails
            }
          }
        }

        // 3. Slett alle oppgaver (cascade should handle this, but being explicit)
        // First get all plantegning IDs for this befaring
        const { data: plantegningIds } = await supabase
          .from('plantegninger')
          .select('id')
          .eq('befaring_id', befaringToDelete.id);

        if (plantegningIds && plantegningIds.length > 0) {
          const { error: oppgaverError } = await supabase
            .from('oppgaver')
            .delete()
            .in('plantegning_id', plantegningIds.map(p => p.id));

          if (oppgaverError) {
            console.warn('Error deleting oppgaver:', oppgaverError);
          }
        }

        // 4. Slett alle plantegninger
        const { error: plantegningerError } = await supabase
          .from('plantegninger')
          .delete()
          .eq('befaring_id', befaringToDelete.id);

        if (plantegningerError) {
          console.warn('Error deleting plantegninger:', plantegningerError);
        }

        // 5. Slett befaringen
        const { error: befaringError } = await supabase
          .from('befaringer')
          .delete()
          .eq('id', befaringToDelete.id);

        if (befaringError) throw befaringError;
      }

      toast({
        title: 'Befaring slettet',
        description: `"${befaringToDelete.title ?? 'Befaring'}" og all tilhørende data ble slettet.`,
      });

      // Reload the list
      loadBefaringer();
      
      // Close dialog
      setShowDeleteDialog(false);
      setBefaringToDelete(null);
    } catch (error: any) {
      console.error('Error deleting befaring:', error);
      toast({
        title: 'Feil',
        description: `Kunne ikke slette befaring: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Utvidet søkefunksjonalitet
  const filteredBefaringer = befaringer.filter(b => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      (b.title && b.title.toLowerCase().includes(query)) ||
      b._project_info?.project_number?.toString().includes(searchQuery) ||
      b._project_info?.project_name?.toLowerCase().includes(query) ||
      b.adresse?.toLowerCase().includes(query) ||
      b.description?.toLowerCase().includes(query) ||
      (b.befaring_type && b.befaring_type.toLowerCase().includes(query)) ||
      (b.type === 'fri' && 'fri befaring'.includes(query)) ||
      (b.type === 'plantegning' && 'plantegning'.includes(query))
    );
  });

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-3">
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-10 bg-gray-200 rounded mt-4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Mine Befaringer
          </h1>
          <p className="text-gray-600">
            Oversikt over alle befaringer i din organisasjon
          </p>
        </div>
        <Button 
          size="lg"
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 
                     shadow-lg hover:shadow-xl transition-all whitespace-nowrap"
          onClick={() => setShowBefaringDialog(true)}
        >
          <Plus className="h-5 w-5 mr-2" />
          Ny befaring
        </Button>
      </div>

      {/* Søk og Filter */}
      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="Søk etter prosjektnummer, befaring, adresse, type (plantegning/fri) eller beskrivelse..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(e.target.value.length >= 2);
            }}
            onFocus={() => searchQuery.length >= 2 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="pl-10"
          />
          
          {/* Autocomplete suggestions */}
          {showSuggestions && searchSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {searchSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  onClick={() => {
                    setSearchQuery(suggestion);
                    setShowSuggestions(false);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{suggestion}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {/* Clear search button */}
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setShowSuggestions(false);
              }}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2 items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant={filter === 'aktiv' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('aktiv')}
            >
              Aktive
            </Button>
            <Button
              variant={filter === 'uten_prosjekt' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('uten_prosjekt')}
              className="bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100"
            >
              Uten prosjekt
            </Button>
            <Button
              variant={filter === 'arkivert' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('arkivert')}
            >
              Arkiverte
            </Button>
            <Button
              variant={filter === 'alle' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('alle')}
            >
              Alle
            </Button>
          </div>
          
          {/* View mode toggle */}
          <div className="flex gap-1 border border-gray-200 rounded-lg p-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="h-8 w-8 p-0"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="h-8 w-8 p-0"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Befaringskort */}
      {filteredBefaringer.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Ingen befaringer funnet
            </h3>
            <p className="text-gray-600 mb-6">
              {searchQuery
                ? 'Ingen befaringer matcher søket ditt.'
                : 'Kom i gang ved å opprette din første befaring.'}
            </p>
            {!searchQuery && (
              <Button 
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                onClick={() => setShowBefaringDialog(true)}
              >
                <Plus className="h-5 w-5 mr-2" />
                Opprett din første befaring
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredBefaringer.map((befaring) => {
            const safeTitle = befaring.title ?? 'Uten tittel';
            const plantegningCount = befaring._plantegninger_count ?? 0;
            const projectNumber = befaring._project_info?.project_number;
            const projectName = befaring._project_info?.project_name ?? '';
            const hasProjectInfo = (projectNumber !== null && projectNumber !== undefined) || projectName.length > 0;
            const dateText = befaring.befaring_date
              ? new Date(befaring.befaring_date).toLocaleDateString('no-NO', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })
              : 'Dato ikke satt';
            const adresse = befaring.adresse ?? '';
            const totalOppgaver = befaring._oppgaver_count?.total ?? 0;
            const apenOppgaver = befaring._oppgaver_count?.apen ?? 0;
            const underArbeidOppgaver = befaring._oppgaver_count?.under_arbeid ?? 0;
            const lukketOppgaver = befaring._oppgaver_count?.lukket ?? 0;
            const kritiskFrister = befaring._oppgaver_count?.kritisk_frist ?? 0;
            const status = befaring.status ?? '';

            return (
              <Card
                key={befaring.id}
                className="hover:shadow-xl transition-all duration-200 hover:scale-105 cursor-pointer"
                onClick={() => router.push(befaring.type === 'fri' ? `/fri-befaring/${befaring.id}` : `/befaring/${befaring.id}`)}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <FileText className="h-6 w-6 text-blue-600" />
                    <div className="flex gap-2">
                      <Badge variant="outline" className={befaring.type === 'fri' ? 'bg-orange-50 text-orange-700 border-orange-300' : 'bg-blue-50 text-blue-700 border-blue-300'}>
                        {befaring.type === 'fri' ? 'Fri befaring' : 'Plantegning'}
                      </Badge>
                      {plantegningCount > 0 && (
                        <Badge variant="outline">
                          {plantegningCount} plantegn.
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {/* Prosjektnummer og navn */}
                    {hasProjectInfo && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {projectNumber !== null && projectNumber !== undefined && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-300">
                              #{projectNumber}
                            </Badge>
                          )}
                          {projectName && (
                            <span className="text-sm font-medium text-gray-700 truncate">
                              {projectName}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Befaring tittel */}
                    <CardTitle className="text-lg font-semibold line-clamp-2 text-gray-900">
                      {safeTitle}
                    </CardTitle>
                  </div>

                  <div className="space-y-1 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {dateText}
                    </div>

                    {adresse && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span className="line-clamp-1">{adresse}</span>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Oppgavestatus */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {totalOppgaver} oppgaver
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span className="text-gray-600">
                          {apenOppgaver} åpne
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        <span className="text-gray-600">
                          {underArbeidOppgaver} under arbeid
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span className="text-gray-600">
                          {lukketOppgaver} lukket
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Kritiske frister */}
                  {kritiskFrister > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-900">
                          <span className="font-semibold">
                            {kritiskFrister} frist
                            {kritiskFrister > 1 ? 'er' : ''}
                          </span>
                          {' '}innen 7 dager
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Status badge */}
                  <div className="pt-2 space-y-1">
                    {status === 'aktiv' && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Aktiv
                      </Badge>
                    )}
                    {status === 'arkivert' && (
                      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">
                        <Archive className="mr-1 h-3 w-3" />
                        Arkivert
                      </Badge>
                    )}
                    {status === 'avsluttet' && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Avsluttet
                      </Badge>
                    )}
                    {status && !['aktiv', 'arkivert', 'avsluttet'].includes(status) && (
                      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">
                        Ukjent status
                      </Badge>
                    )}
                    {!status && (
                      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">
                        Status ikke satt
                      </Badge>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="mt-2 space-y-2">
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(befaring.type === 'fri' ? `/fri-befaring/${befaring.id}` : `/befaring/${befaring.id}`);
                      }}
                    >
                      Åpne befaring →
                    </Button>
                    <Button
                      className="w-full"
                      variant="destructive"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBefaringToDelete(befaring);
                        setShowDeleteDialog(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Slett befaring
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        // List view
        <div className="space-y-4">
          {filteredBefaringer.map((befaring) => (
            <Card
              key={befaring.id}
              className="hover:shadow-lg transition-all duration-200 cursor-pointer"
              onClick={() => router.push(befaring.type === 'fri' ? `/fri-befaring/${befaring.id}` : `/befaring/${befaring.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {befaring._project_info?.project_number !== null &&
                           befaring._project_info?.project_number !== undefined && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-300">
                              #{befaring._project_info.project_number}
                            </Badge>
                          )}
                          <h3 className="text-lg font-semibold text-gray-900 truncate">
                            {befaring.title ?? 'Uten tittel'}
                          </h3>
                        </div>
                        {befaring._project_info?.project_name && (
                          <p className="text-sm text-gray-600 truncate">
                            {befaring._project_info.project_name}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Badge variant="outline" className={befaring.type === 'fri' ? 'bg-orange-50 text-orange-700 border-orange-300' : 'bg-blue-50 text-blue-700 border-blue-300'}>
                          {befaring.type === 'fri' ? 'Fri befaring' : 'Plantegning'}
                        </Badge>
                        {befaring._plantegninger_count && befaring._plantegninger_count > 0 && (
                          <Badge variant="outline">
                            {befaring._plantegninger_count} plantegn.
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {befaring.befaring_date
                          ? new Date(befaring.befaring_date).toLocaleDateString('no-NO', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })
                          : 'Dato ikke satt'}
                      </div>
                      
                      {befaring.adresse && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span className="truncate">{befaring.adresse}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">
                          {befaring._oppgaver_count?.total || 0} oppgaver
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span className="text-gray-600">
                          {befaring._oppgaver_count?.apen || 0} åpne
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        <span className="text-gray-600">
                          {befaring._oppgaver_count?.under_arbeid || 0} under arbeid
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span className="text-gray-600">
                          {befaring._oppgaver_count?.lukket || 0} lukket
                        </span>
                      </div>
                      
                      {befaring._oppgaver_count && befaring._oppgaver_count.kritisk_frist > 0 && (
                        <div className="flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="h-3 w-3" />
                          <span className="font-medium">
                            {befaring._oppgaver_count.kritisk_frist} frist
                            {befaring._oppgaver_count.kritisk_frist > 1 ? 'er' : ''} innen 7 dager
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 ml-4">
                    {/* Status badge */}
                    {befaring.status === 'aktiv' && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Aktiv
                      </Badge>
                    )}
                    {befaring.status === 'arkivert' && (
                      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">
                        <Archive className="mr-1 h-3 w-3" />
                        Arkivert
                      </Badge>
                    )}
                    {befaring.status === 'avsluttet' && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Avsluttet
                      </Badge>
                    )}
                    {befaring.status && !['aktiv', 'arkivert', 'avsluttet'].includes(befaring.status) && (
                      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">
                        Ukjent status
                      </Badge>
                    )}
                    {!befaring.status && (
                      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">
                        Status ikke satt
                      </Badge>
                    )}
                    
                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(befaring.type === 'fri' ? `/fri-befaring/${befaring.id}` : `/befaring/${befaring.id}`);
                        }}
                      >
                        Åpne →
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setBefaringToDelete(befaring);
                          setShowDeleteDialog(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil permanent slette befaringen "{befaringToDelete?.title ?? 'Befaring'}" og all tilhørende data:
              <br />• Alle plantegninger og filer
              <br />• Alle oppgaver og kommentarer
              <br />• Alle filer fra storage
              <br />
              <br />
              <strong>Denne handlingen kan ikke angres.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBefaring}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? 'Sletter...' : 'Slett befaring'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fri Befaring Dialog */}
      <FriBefaringDialog
        isOpen={showBefaringDialog}
        onClose={() => setShowBefaringDialog(false)}
        orgId={orgId}
        userId={userId}
        onSuccess={() => {
          loadBefaringer(); // Reload befaringer when new one is created
        }}
      />
    </div>
  );
}
