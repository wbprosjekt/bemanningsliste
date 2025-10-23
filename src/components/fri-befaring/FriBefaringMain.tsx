'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowLeft, 
  Calendar, 
  Building2, 
  Plus,
  Edit,
  Trash2,
  Signature,
  FileText,
  Image as ImageIcon,
  CheckSquare,
  AlertCircle,
  Clock,
  User
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import BefaringPunktList from './BefaringPunktList';
import MoveToProjectDialog from './MoveToProjectDialog';

interface FriBefaring {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  befaring_date: string | null;
  status: 'aktiv' | 'signert' | 'arkivert';
  version: string;
  tripletex_project_id: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface Project {
  project_name: string | null;
  project_number: number | null;
  customer_name: string | null;
}

interface BefaringStats {
  total_punkter: number;
  total_oppgaver: number;
  total_bilder: number;
}

interface FriBefaringMainProps {
  befaringId: string;
  orgId: string;
  userId: string;
}

export default function FriBefaringMain({ befaringId, orgId, userId }: FriBefaringMainProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [befaring, setBefaring] = useState<FriBefaring | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [stats, setStats] = useState<BefaringStats>({ total_punkter: 0, total_oppgaver: 0, total_bilder: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    title: '',
    description: '',
    befaring_date: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (befaringId && user) {
      loadBefaringData();
    }
  }, [befaringId, user]);

  const loadBefaringData = async () => {
    try {
      setLoading(true);

      // Load befaring data
      const { data: befaringData, error: befaringError } = await supabase
        .from('fri_befaringer' as any)
        .select('*')
        .eq('id', befaringId)
        .eq('org_id', orgId)
        .single();

      if (befaringError) throw befaringError;

      const typedBefaringData = befaringData as unknown as FriBefaring;
      setBefaring(typedBefaringData);
      setEditData({
        title: typedBefaringData.title,
        description: typedBefaringData.description || '',
        befaring_date: typedBefaringData.befaring_date || ''
      });

      // Load project data if connected
      if (typedBefaringData.tripletex_project_id) {
        console.log('=== LOADING PROJECT DATA ===');
        console.log('Tripletex Project ID:', typedBefaringData.tripletex_project_id);
        
        const { data: projectData, error: projectError } = await supabase
          .from('ttx_project_cache')
          .select('project_name, project_number, customer_name')
          .eq('tripletex_project_id', typedBefaringData.tripletex_project_id)
          .eq('org_id', orgId)
          .single();

        if (!projectError) {
          console.log('Project data loaded:', projectData);
          setProject(projectData);
        } else {
          console.error('Error loading project data:', projectError);
        }
      } else {
        console.log('No tripletex_project_id - untagged befaring');
      }

      // Load stats
      await loadStats(typedBefaringData.id);

    } catch (error) {
      console.error('Error loading befaring data:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke laste befaring data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async (befaringId: string) => {
    try {
      // Count punkter
      const { count: punkterCount } = await supabase
        .from('befaring_punkter' as any)
        .select('*', { count: 'exact', head: true })
        .eq('fri_befaring_id', befaringId);

      // Count oppgaver
      const { count: oppgaverCount } = await supabase
        .from('befaring_oppgaver' as any)
        .select('*', { count: 'exact', head: true })
        .in('befaring_punkt_id', 
          await supabase
            .from('befaring_punkter' as any)
            .select('id')
            .eq('fri_befaring_id', befaringId)
            .then(({ data }) => (data as any[])?.map(p => p.id) || [])
        );

      // Count bilder
      const { count: bilderCount } = await supabase
        .from('oppgave_bilder')
        .select('*', { count: 'exact', head: true })
        .in('befaring_punkt_id',
          await supabase
            .from('befaring_punkter' as any)
            .select('id')
            .eq('fri_befaring_id', befaringId)
            .then(({ data }) => (data as any[])?.map(p => p.id) || [])
        )
        .eq('image_source', 'punkt');

      setStats({
        total_punkter: punkterCount || 0,
        total_oppgaver: oppgaverCount || 0,
        total_bilder: bilderCount || 0
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSave = async () => {
    if (!befaring) return;

    try {
      console.log('=== SAVE BEFARING DEBUG ===');
      console.log('Befaring ID:', befaring.id);
      console.log('Org ID:', orgId);
      console.log('Edit data:', editData);
      
      const { error } = await supabase
        .from('fri_befaringer' as any)
        .update({
          title: editData.title,
          description: editData.description || null,
          befaring_date: editData.befaring_date || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', befaring.id)
        .eq('org_id', orgId);

      if (error) throw error;

      setBefaring(prev => prev ? {
        ...prev,
        title: editData.title,
        description: editData.description || null,
        befaring_date: editData.befaring_date || null
      } : null);

      setIsEditing(false);
      toast({
        title: 'Lagret',
        description: 'Befaring oppdatert',
      });
    } catch (error) {
      console.error('Error saving befaring:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke lagre endringer',
        variant: 'destructive',
      });
    }
  };

  const handleCancel = () => {
    if (befaring) {
      setEditData({
        title: befaring.title,
        description: befaring.description || '',
        befaring_date: befaring.befaring_date || ''
      });
    }
    setIsEditing(false);
  };

  const handleMoveToProjectSuccess = () => {
    console.log('=== MOVE TO PROJECT SUCCESS CALLBACK ===');
    console.log('Reloading befaring data...');
    // Reload befaring data to get updated project info
    loadBefaringData();
    
    // Also refresh project stats if we have a project detail dialog open
    // This will be handled by the parent component that manages the dialog
    console.log('Move to project completed successfully');
  };

  const handleDeleteBefaring = async () => {
    if (!befaring) return;

    const confirmed = confirm(
      `Er du sikker på at du vil slette befaringen "${befaring.title}"?\n\n` +
      `Dette vil slette:\n` +
      `- ${stats.total_punkter} befaringspunkter\n` +
      `- ${stats.total_oppgaver} oppgaver\n` +
      `- ${stats.total_bilder} bilder\n\n` +
      `Denne handlingen kan ikke angres.`
    );

    if (!confirmed) return;

    try {
      setLoading(true);

      // 1. Slett alle bilder fra storage bucket
      const { data: punkter } = await supabase
        .from('befaring_punkter' as any)
        .select('id')
        .eq('fri_befaring_id', befaring.id);

      if (Array.isArray(punkter) && punkter.length > 0) {
        const punktArray = punkter as unknown as Array<{ id: string }>;
        const punktIds = punktArray.map(p => p.id);
        
        // Hent alle bilder for disse punktene
        const { data: bilder } = await supabase
          .from('oppgave_bilder')
          .select('image_url')
          .in('befaring_punkt_id', punktIds)
          .eq('image_source', 'punkt');

        if (Array.isArray(bilder) && bilder.length > 0) {
          const bildeArray = bilder as unknown as Array<{ image_url: string | null }>;
          const filePaths = bildeArray
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
        .eq('id', befaring.id);

      if (error) throw error;

      toast({
        title: 'Slettet',
        description: 'Befaringen er slettet',
      });

      // Navigate back to befaring list
      router.push('/befaring');

    } catch (error) {
      console.error('Error deleting befaring:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke slette befaringen',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aktiv': return 'bg-green-100 text-green-800';
      case 'signert': return 'bg-blue-100 text-blue-800';
      case 'arkivert': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'aktiv': return <CheckSquare className="h-4 w-4" />;
      case 'signert': return <Signature className="h-4 w-4" />;
      case 'arkivert': return <FileText className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!befaring) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Befaring ikke funnet</h2>
            <p className="text-gray-600 mb-4">Befaringen du leter etter finnes ikke eller du har ikke tilgang til den.</p>
            <Button onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Tilbake
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="space-y-4">
        {/* Top row: Back button and title */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2 md:space-x-4 min-w-0 flex-1">
            <Button variant="outline" onClick={() => router.back()} size="sm" className="shrink-0">
              <ArrowLeft className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Tilbake</span>
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg md:text-2xl font-bold truncate">
                {isEditing ? (
                  <Input
                    value={editData.title}
                    onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
                    className="text-lg md:text-2xl font-bold border-none p-0 h-auto"
                  />
                ) : (
                  befaring.title
                )}
              </h1>
            </div>
          </div>
          
          {/* Status badges - only show on larger screens */}
          <div className="hidden md:flex items-center space-x-2 shrink-0">
            <Badge className={getStatusColor(befaring.status)}>
              <div className="flex items-center space-x-1">
                {getStatusIcon(befaring.status)}
                <span className="capitalize">{befaring.status}</span>
              </div>
            </Badge>
            <Badge variant="outline">v{befaring.version}</Badge>
          </div>
        </div>

        {/* Info row - responsive layout */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs md:text-sm text-gray-600">
          <div className="flex items-center space-x-1">
            <Calendar className="h-3 w-3 md:h-4 md:w-4" />
            <span>{befaring.befaring_date || 'Ikke satt'}</span>
          </div>
          {project ? (
            <div className="flex items-center space-x-1">
              <Building2 className="h-3 w-3 md:h-4 md:w-4" />
              <span className="truncate">{project.project_name} (#{project.project_number})</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1 text-orange-600">
              <Building2 className="h-3 w-3 md:h-4 md:w-4" />
              <span>Uten prosjekt (untagged)</span>
            </div>
          )}
          <div className="flex items-center space-x-1">
            <User className="h-3 w-3 md:h-4 md:w-4" />
            <span>Opprettet: {new Date(befaring.created_at).toLocaleDateString('no-NO')}</span>
          </div>
        </div>

        {/* Action buttons - responsive layout */}
        {befaring.status === 'aktiv' && (
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            {/* Status badges for mobile */}
            <div className="flex md:hidden items-center space-x-2">
              <Badge className={getStatusColor(befaring.status)}>
                <div className="flex items-center space-x-1">
                  {getStatusIcon(befaring.status)}
                  <span className="capitalize">{befaring.status}</span>
                </div>
              </Badge>
              <Badge variant="outline">v{befaring.version}</Badge>
            </div>
            
            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  console.log('Toggle editing mode:', !isEditing);
                  setIsEditing(!isEditing);
                }}
                size="sm"
                className="flex-1 sm:flex-none"
              >
                <Edit className="h-4 w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">{isEditing ? 'Avbryt' : 'Rediger'}</span>
                <span className="sm:hidden">{isEditing ? 'Avbryt' : 'Rediger'}</span>
              </Button>
              
                    <MoveToProjectDialog
                      befaringId={befaring.id}
                      befaringTitle={befaring.title}
                      currentProjectId={befaring.tripletex_project_id}
                      onSuccess={handleMoveToProjectSuccess}
                    >
                      <Button 
                        variant={befaring.tripletex_project_id ? "outline" : "default"} 
                        className={befaring.tripletex_project_id ? "flex-1 sm:flex-none" : "bg-orange-600 hover:bg-orange-700 flex-1 sm:flex-none"} 
                        size="sm"
                      >
                        <Building2 className="h-4 w-4 mr-1 md:mr-2" />
                        <span className="hidden sm:inline">
                          {befaring.tripletex_project_id ? 'Endre prosjekt' : 'Flytt til prosjekt'}
                        </span>
                        <span className="sm:hidden">
                          {befaring.tripletex_project_id ? 'Endre' : 'Flytt'}
                        </span>
                      </Button>
                    </MoveToProjectDialog>
              
              <Button
                variant="destructive"
                onClick={handleDeleteBefaring}
                disabled={loading}
                size="sm"
                className="flex-1 sm:flex-none"
              >
                <Trash2 className="h-4 w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Slett befaring</span>
                <span className="sm:hidden">Slett</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Description */}
      {isEditing ? (
        <Card>
          <CardHeader>
            <CardTitle>Beskrivelse</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={editData.description}
              onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Beskrivelse av befaringsrapporten..."
              rows={3}
            />
          </CardContent>
        </Card>
      ) : (
        befaring.description && (
          <Card>
            <CardContent className="p-4">
              <p className="text-gray-700">{befaring.description}</p>
            </CardContent>
          </Card>
        )
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 md:grid-cols-3 md:gap-4">
        <Card>
          <CardContent className="p-3 md:p-6">
            <div className="flex items-center space-x-2 md:space-x-4">
              <div className="p-2 md:p-3 bg-blue-100 rounded-lg">
                <CheckSquare className="h-4 w-4 md:h-6 md:w-6 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs md:text-sm font-medium text-gray-600 leading-tight">
                  <span className="md:hidden">Punkter</span>
                  <span className="hidden md:inline">Befaringspunkter</span>
                </p>
                <p className="text-lg md:text-2xl font-bold">{stats.total_punkter}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 md:p-6">
            <div className="flex items-center space-x-2 md:space-x-4">
              <div className="p-2 md:p-3 bg-green-100 rounded-lg">
                <FileText className="h-4 w-4 md:h-6 md:w-6 text-green-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs md:text-sm font-medium text-gray-600 leading-tight">Oppgaver</p>
                <p className="text-lg md:text-2xl font-bold">{stats.total_oppgaver}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 md:p-6">
            <div className="flex items-center space-x-2 md:space-x-4">
              <div className="p-2 md:p-3 bg-purple-100 rounded-lg">
                <ImageIcon className="h-4 w-4 md:h-6 md:w-6 text-purple-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs md:text-sm font-medium text-gray-600 leading-tight">Bilder</p>
                <p className="text-lg md:text-2xl font-bold">{stats.total_bilder}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save/Cancel buttons for editing */}
      {isEditing && (
        <div className="flex justify-end space-x-2 mb-6">
          <Button variant="outline" onClick={handleCancel}>
            Avbryt
          </Button>
          <Button onClick={() => {
            console.log('Save button clicked, isEditing:', isEditing);
            handleSave();
          }}>
            Lagre endringer
          </Button>
        </div>
      )}

      {/* Befaringspunkter */}
      <BefaringPunktList 
        befaringId={befaring.id}
        onStatsUpdate={() => loadStats(befaring.id)}
        canEdit={befaring.status === 'aktiv'}
        orgId={orgId}
        userId={userId}
      />
    </div>
  );
}
