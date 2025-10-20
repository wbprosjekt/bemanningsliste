'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Image as ImageIcon, Eye, Tag, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useRouter } from 'next/navigation';

interface PhotoInboxMiniProps {
  orgId: string;
  projectId?: string | null; // If null, shows all projects
  maxPhotos?: number; // Max photos per project (default: 6)
  onViewAll?: () => void;
}

interface ProjectPhotos {
  project_id: string;
  project_name: string;
  project_number: string;
  total_count: number;
  photos: Array<{
    id: string;
    image_url: string;
    inbox_date: string;
  }>;
}

export default function PhotoInboxMini({ 
  orgId, 
  projectId = null, 
  maxPhotos = 6,
  onViewAll 
}: PhotoInboxMiniProps) {
  const [projects, setProjects] = useState<ProjectPhotos[]>([]);
  const [loading, setLoading] = useState(true);
  const [untaggedCount, setUntaggedCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    loadPhotos();
  }, [orgId, projectId]);

  const loadPhotos = async () => {
    setLoading(true);
    try {
      // Use CTE + ROW_NUMBER() for top N per project
      const { data, error } = await supabase.rpc('get_photo_inbox_mini', {
        p_org_id: orgId,
        p_project_id: projectId,
        p_max_photos: maxPhotos
      });

      if (error) {
        console.error('Error loading photos:', error);
        // Fallback to direct query if RPC doesn't exist
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('oppgave_bilder')
          .select(`
            id,
            image_url,
            prosjekt_id,
            inbox_date,
            ttx_project_cache:prosjekt_id(project_name, project_number)
          `)
          .eq('org_id', orgId)
          .eq('is_tagged', false)
          .order('inbox_date', { ascending: false })
          .limit(50);

        if (fallbackError) throw fallbackError;

        // Group by project
        const grouped = (fallbackData || []).reduce((acc: any, photo: any) => {
          const pid = photo.prosjekt_id || 'untagged';
          if (!acc[pid]) {
            acc[pid] = {
              project_id: pid,
              project_name: photo.ttx_project_cache?.project_name || 'Uten prosjekt',
              project_number: photo.ttx_project_cache?.project_number || '',
              total_count: 0,
              photos: []
            };
          }
          if (acc[pid].photos.length < maxPhotos) {
            acc[pid].photos.push({
              id: photo.id,
              image_url: photo.image_url,
              inbox_date: photo.inbox_date
            });
          }
          acc[pid].total_count++;
          return acc;
        }, {});

        const projectsList = Object.values(grouped);
        setProjects(projectsList as ProjectPhotos[]);
        setUntaggedCount(projectsList.reduce((sum: number, p: any) => sum + p.total_count, 0));
      } else {
        setProjects(data || []);
        setUntaggedCount(data?.reduce((sum, p) => sum + p.total_count, 0) || 0);
      }
    } catch (error) {
      console.error('Error loading photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewAll = () => {
    if (onViewAll) {
      onViewAll();
    } else {
      router.push('/photo-inbox');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (projects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Foto-innboks
          </CardTitle>
          <CardDescription>
            Ingen utaggede bilder
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <ImageIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">Alle bilder er tagget</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Foto-innboks
            </CardTitle>
            <CardDescription>
              {untaggedCount} utaggede bilder
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleViewAll}>
            <Eye className="h-4 w-4 mr-2" />
            Se alle
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {projects.map((project) => (
            <div key={project.project_id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">
                    {project.project_name}
                    {project.project_number && ` #${project.project_number}`}
                  </h3>
                  <Badge variant="secondary">
                    {project.total_count} bilder
                  </Badge>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => router.push(`/photo-inbox?project=${project.project_id}`)}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Se alle
                </Button>
              </div>
              
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {project.photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => router.push(`/photo-inbox?project=${project.project_id}`)}
                  >
                    <img
                      src={photo.image_url}
                      alt="Photo"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
                {project.total_count > maxPhotos && (
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity">
                    <div className="text-center">
                      <p className="text-xs font-semibold">+{project.total_count - maxPhotos}</p>
                      <p className="text-xs text-gray-500">flere</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

