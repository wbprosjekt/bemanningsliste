'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Image as ImageIcon, Tag, Calendar, User, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface PhotoInboxProps {
  orgId: string;
  projectId?: string | null; // If null, shows all untagged photos
}

interface Photo {
  id: string;
  image_url: string;
  prosjekt_id: string | null;
  comment: string | null;
  inbox_date: string;
  uploaded_by: string;
  uploaded_by_email: string | null;
  project_name?: string | null;
  project_number?: string | null;
}

export default function PhotoInbox({ orgId, projectId }: PhotoInboxProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    loadPhotos();
  }, [orgId, projectId]);

  const loadPhotos = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('oppgave_bilder')
        .select(`
          id,
          image_url,
          prosjekt_id,
          comment,
          inbox_date,
          uploaded_by,
          uploaded_by_email,
          ttx_project_cache:prosjekt_id(project_name, project_number)
        `)
        .eq('is_tagged', false)
        .order('inbox_date', { ascending: false });

      // If projectId is provided, filter by project
      if (projectId) {
        query = query.eq('prosjekt_id', projectId);
      } else {
        // Show all untagged photos
        query = query.is('prosjekt_id', null);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform data to include project info
      const transformedPhotos = (data || []).map((photo: any) => ({
        ...photo,
        project_name: photo.ttx_project_cache?.project_name || null,
        project_number: photo.ttx_project_cache?.project_number || null,
      }));

      setPhotos(transformedPhotos as Photo[]);
    } catch (error: any) {
      console.error('Error loading photos:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke laste bilder',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTagPhoto = (photo: Photo) => {
    // TODO: Open tag dialog
    toast({
      title: 'Funksjon under utvikling',
      description: 'Tag-funksjonen kommer snart'
    });
  };

  const handleDeletePhoto = async (photo: Photo) => {
    if (!confirm('Er du sikker på at du vil slette dette bildet?')) return;

    try {
      // Delete from storage
      if (photo.image_url) {
        const fileName = photo.image_url.split('/').pop();
        if (fileName) {
          await supabase.storage
            .from('befaring-assets')
            .remove([`project-photos/${orgId}/${photo.prosjekt_id || 'untagged'}/${fileName}`]);
        }
      }

      // Delete from database
      const { error } = await supabase
        .from('oppgave_bilder')
        .delete()
        .eq('id', photo.id);

      if (error) throw error;

      toast({
        title: 'Suksess',
        description: 'Bilde slettet'
      });

      loadPhotos();
    } catch (error: any) {
      console.error('Error deleting photo:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke slette bilde',
        variant: 'destructive'
      });
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

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg sm:text-xl">
                Foto-innboks
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {projectId ? 'Utaggede bilder for dette prosjektet' : 'Alle utaggede bilder'}
              </CardDescription>
            </div>
            <Badge variant="outline">
              {photos.length} bilder
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {photos.length === 0 ? (
            <div className="text-center py-8">
              <ImageIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600">Ingen bilder i innboks</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative aspect-square group cursor-pointer"
                  onClick={() => {
                    setSelectedPhoto(photo);
                    setShowImageViewer(true);
                  }}
                >
                  <div className="relative w-full h-full rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={photo.image_url}
                      alt="Photo"
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTagPhoto(photo);
                        }}
                      >
                        <Tag className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        Tag
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePhoto(photo);
                        }}
                      >
                        <X className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                    </div>

                    {/* Project badge */}
                    {photo.project_name && (
                      <div className="absolute top-1 left-1">
                        <Badge variant="secondary" className="text-xs">
                          {photo.project_number || photo.project_name}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Info below image */}
                  <div className="mt-1 text-xs text-gray-600 truncate">
                    {photo.comment || 'Ingen kommentar'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image viewer modal */}
      {showImageViewer && selectedPhoto && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-2 sm:p-4">
          <div className="relative w-full max-w-4xl">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowImageViewer(false)}
              className="absolute top-2 right-2 z-10"
            >
              <X className="h-4 w-4" />
            </Button>
            
            <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
              <img
                src={selectedPhoto.image_url}
                alt="Photo"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-lg p-3 sm:p-4 text-white">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {selectedPhoto.project_name && (
                  <div>
                    <span className="font-medium">Prosjekt:</span> {selectedPhoto.project_number} - {selectedPhoto.project_name}
                  </div>
                )}
                {selectedPhoto.comment && (
                  <div>
                    <span className="font-medium">Kommentar:</span> {selectedPhoto.comment}
                  </div>
                )}
                <div>
                  <span className="font-medium">Lastet opp:</span> {new Date(selectedPhoto.inbox_date).toLocaleDateString('no-NO')}
                </div>
                {selectedPhoto.uploaded_by_email && (
                  <div>
                    <span className="font-medium">Av:</span> {selectedPhoto.uploaded_by_email}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

