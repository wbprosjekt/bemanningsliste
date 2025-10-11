'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Search, 
  FileText, 
  Calendar,
  MapPin,
  AlertTriangle,
  Archive,
  CheckCircle2
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface Befaring {
  id: string;
  title: string;
  description: string | null;
  adresse: string | null;
  befaring_date: string;
  befaring_type: string;
  status: string;
  created_at: string;
  _oppgaver_count?: {
    total: number;
    apen: number;
    under_arbeid: number;
    lukket: number;
    kritisk_frist: number;
  };
  _plantegninger_count?: number;
}

interface BefaringListProps {
  orgId: string;
  userId: string;
}

export default function BefaringList({ orgId, userId }: BefaringListProps) {
  const [befaringer, setBefaringer] = useState<Befaring[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'alle' | 'aktiv' | 'arkivert'>('aktiv');
  const { toast } = useToast();

  useEffect(() => {
    loadBefaringer();
  }, [orgId, filter]);

  const loadBefaringer = async () => {
    setLoading(true);
    try {
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
          created_at
        `)
        .eq('org_id', orgId)
        .order('befaring_date', { ascending: false });

      // Filter på status
      if (filter !== 'alle') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // TODO: Hent oppgave- og plantegningstall
      // For nå: mock data
      const befaringerMedStats = (data || []).map(b => ({
        ...b,
        _oppgaver_count: {
          total: Math.floor(Math.random() * 20) + 5,
          apen: Math.floor(Math.random() * 10),
          under_arbeid: Math.floor(Math.random() * 5),
          lukket: Math.floor(Math.random() * 8),
          kritisk_frist: Math.floor(Math.random() * 3),
        },
        _plantegninger_count: Math.floor(Math.random() * 5) + 1,
      }));

      setBefaringer(befaringerMedStats);
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

  const handleCreateBefaring = () => {
    // TODO: Åpne dialog for å opprette ny befaring
    toast({
      title: 'Kommer snart',
      description: 'Funksjon for å opprette ny befaring kommer i neste versjon.',
    });
  };

  const filteredBefaringer = befaringer.filter(b =>
    b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.adresse?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Mine Befaringer
        </h1>
        <p className="text-gray-600">
          Oversikt over alle befaringer i din organisasjon
        </p>
      </div>

      {/* Søk og Filter */}
      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="Søk etter befaring eller adresse..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant={filter === 'aktiv' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('aktiv')}
          >
            Aktive
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
            <Button onClick={handleCreateBefaring}>
              <Plus className="mr-2 h-4 w-4" />
              Opprett befaring
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredBefaringer.map((befaring) => (
            <Card
              key={befaring.id}
              className="hover:shadow-xl transition-all duration-200 hover:scale-105 cursor-pointer"
              onClick={() => {
                // TODO: Navigate to befaring detail
                toast({
                  title: 'Kommer snart',
                  description: 'Detaljvisning for befaring kommer i neste versjon.',
                });
              }}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-3">
                  <FileText className="h-6 w-6 text-blue-600" />
                  <Badge variant="outline">
                    {befaring._plantegninger_count} plantegn.
                  </Badge>
                </div>

                <CardTitle className="text-xl font-semibold line-clamp-2">
                  {befaring.title}
                </CardTitle>

                <div className="space-y-1 text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {new Date(befaring.befaring_date).toLocaleDateString('no-NO', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </div>

                  {befaring.adresse && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span className="line-clamp-1">{befaring.adresse}</span>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Oppgavestatus */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {befaring._oppgaver_count?.total || 0} oppgaver
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <span className="text-gray-600">
                        {befaring._oppgaver_count?.apen || 0} åpne
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      <span className="text-gray-600">
                        {befaring._oppgaver_count?.under_arbeid || 0} under arbeid
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      <span className="text-gray-600">
                        {befaring._oppgaver_count?.lukket || 0} lukket
                      </span>
                    </div>
                  </div>
                </div>

                {/* Kritiske frister */}
                {befaring._oppgaver_count && befaring._oppgaver_count.kritisk_frist > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-900">
                        <span className="font-semibold">
                          {befaring._oppgaver_count.kritisk_frist} frist
                          {befaring._oppgaver_count.kritisk_frist > 1 ? 'er' : ''}
                        </span>
                        {' '}innen 7 dager
                      </div>
                    </div>
                  </div>
                )}

                {/* Status badge */}
                <div className="pt-2">
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
                </div>

                {/* Åpne-knapp */}
                <Button
                  className="w-full mt-2"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    toast({
                      title: 'Kommer snart',
                      description: 'Detaljvisning kommer i neste versjon.',
                    });
                  }}
                >
                  Åpne befaring →
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* FAB for ny befaring */}
      <Button
        onClick={handleCreateBefaring}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-xl 
                   bg-gradient-to-r from-blue-600 to-blue-700 
                   hover:scale-110 active:scale-95 transition-transform duration-200"
        size="icon"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
}

