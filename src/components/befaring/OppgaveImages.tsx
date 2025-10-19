'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Image as ImageIcon, 
  Plus, 
  Trash2, 
  Eye, 
  Download,
  Camera
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import OppgaveImageUpload from './OppgaveImageUpload';

interface OppgaveImage {
  id: string;
  image_url: string;
  image_type: 'standard' | 'før' | 'etter';
  uploaded_by: string | null;
  uploaded_by_email: string | null;
  created_at: string;
}

interface OppgaveImagesProps {
  oppgaveId: string;
  orgId: string;
  canUpload?: boolean; // Whether current user can upload images
}

export default function OppgaveImages({
  oppgaveId,
  orgId,
  canUpload = true,
}: OppgaveImagesProps) {
  const [images, setImages] = useState<OppgaveImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<OppgaveImage | null>(null);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  const loadImages = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('oppgave_bilder')
        .select('*')
        .eq('oppgave_id', oppgaveId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const sanitizedImages: OppgaveImage[] = (data || []).map((img: any) => ({
        id: img.id,
        image_url: img.image_url ?? '',
        image_type: img.image_type === 'før' || img.image_type === 'etter' ? img.image_type : 'standard',
        uploaded_by: img.uploaded_by ?? null,
        uploaded_by_email: img.uploaded_by_email ?? null,
        created_at: img.created_at ?? new Date().toISOString(),
      }));
      setImages(sanitizedImages);
    } catch (error: any) {
      console.error('Error loading images:', error);
      toast({
        title: 'Feil ved lasting av bilder',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [oppgaveId, toast]);

  const handleUploadDialogChange = useCallback((open: boolean) => {
    console.log('🔄 Upload dialog change:', open);
    setShowUploadDialog(open);
    // Refresh images when dialog closes
    if (!open) {
      console.log('🔄 Dialog closed, refreshing images in 100ms');
      setTimeout(() => loadImages(), 100);
    }
  }, [loadImages]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const handleDeleteImage = async (imageId: string) => {
    setDeleting(imageId);
    try {
      // Get image data to extract filename
      const image = images.find(img => img.id === imageId);
      if (!image) return;

      // Delete from Supabase Storage
      const fileName = image.image_url.split('/').pop();
      if (fileName) {
        const { error: storageError } = await supabase.storage
          .from('befaring-assets')
          .remove([`${oppgaveId}/${fileName}`]);
        
        if (storageError) {
          console.warn('Storage delete error:', storageError);
          // Continue with database delete even if storage fails
        }
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('oppgave_bilder')
        .delete()
        .eq('id', imageId);

      if (dbError) throw dbError;

      toast({
        title: 'Bilde slettet',
        description: 'Bildet ble fjernet fra oppgaven.',
      });

      // Refresh images
      loadImages();
    } catch (error: any) {
      console.error('Error deleting image:', error);
      toast({
        title: 'Feil ved sletting',
        description: 'Kunne ikke slette bildet. Prøv igjen.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(null);
    }
  };

  const getImageTypeColor = (type: string) => {
    switch (type) {
      case 'før': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'etter': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getImageTypeLabel = (type: string) => {
    switch (type) {
      case 'før': return 'Før';
      case 'etter': return 'Etter';
      default: return 'Standard';
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm text-gray-700">Bilder</h4>
        </div>
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm text-gray-700">
          Bilder ({images.length})
        </h4>
        {canUpload && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              console.log('🎯 Opening upload dialog from OppgaveImages');
              setShowUploadDialog(true);
            }}
            className="h-8"
          >
            <Plus className="h-4 w-4 mr-1" />
            Legg til
          </Button>
        )}
      </div>

      {images.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
          <Camera className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500 mb-2">Ingen bilder lagt til</p>
          {canUpload && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowUploadDialog(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Legg til første bilde
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {images.map((image) => (
            <Card key={image.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="relative aspect-square">
                  <img
                    src={image.image_url}
                    alt={`Oppgave bilde - ${getImageTypeLabel(image.image_type)}`}
                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => {
                      setSelectedImage(image);
                      setShowImageViewer(true);
                    }}
                  />
                  
                  {/* Image type badge */}
                  <div className="absolute top-2 left-2">
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getImageTypeColor(image.image_type)}`}
                    >
                      {getImageTypeLabel(image.image_type)}
                    </Badge>
                  </div>

                  {/* Action buttons */}
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 bg-white/80 hover:bg-white"
                      onClick={() => {
                        setSelectedImage(image);
                        setShowImageViewer(true);
                      }}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    {canUpload && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 bg-white/80 hover:bg-white text-red-600 hover:text-red-700"
                        onClick={() => handleDeleteImage(image.id)}
                        disabled={deleting === image.id}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Image info */}
                <div className="p-2 space-y-1">
                  <p className="text-xs text-gray-500 truncate">
                    {new Date(image.created_at).toLocaleDateString('no-NO')}
                  </p>
                  {image.uploaded_by_email && (
                    <p className="text-xs text-gray-400 truncate">
                      {image.uploaded_by_email}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <OppgaveImageUpload
        open={showUploadDialog}
        onOpenChange={handleUploadDialogChange}
        oppgaveId={oppgaveId}
      />

      {/* Image Viewer Dialog */}
      <Dialog open={showImageViewer} onOpenChange={setShowImageViewer}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>
                {selectedImage && getImageTypeLabel(selectedImage.image_type)} bilde
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = selectedImage?.image_url || '';
                    link.download = `oppgave-bilde-${selectedImage?.id}.jpg`;
                    link.click();
                  }}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Last ned
                </Button>
                {canUpload && selectedImage && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setShowImageViewer(false);
                      handleDeleteImage(selectedImage.id);
                    }}
                    disabled={deleting === selectedImage.id}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Slett
                  </Button>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedImage && (
            <div className="space-y-4">
              <div className="relative">
                <img
                  src={selectedImage.image_url}
                  alt={`Oppgave bilde - ${getImageTypeLabel(selectedImage.image_type)}`}
                  className="w-full max-h-[60vh] object-contain rounded-lg"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Type:</span>{' '}
                  {getImageTypeLabel(selectedImage.image_type)}
                </div>
                <div>
                  <span className="font-medium">Opplastet:</span>{' '}
                  {new Date(selectedImage.created_at).toLocaleDateString('no-NO', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
                {selectedImage.uploaded_by_email && (
                  <div className="col-span-2">
                    <span className="font-medium">Opplastet av:</span>{' '}
                    {selectedImage.uploaded_by_email}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
