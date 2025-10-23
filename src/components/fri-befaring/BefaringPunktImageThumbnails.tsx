'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Plus, 
  Eye, 
  ChevronRight,
  Image as ImageIcon
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import BefaringPunktImages from './BefaringPunktImages';

interface BefaringPunktImage {
  id: string;
  image_url: string;
  image_type: 'standard' | 'før' | 'etter' | null;
  uploaded_by: string | null;
  uploaded_by_email: string | null;
  created_at: string | null;
}

interface BefaringPunktImageThumbnailsProps {
  befaringPunktId: string | null;
  orgId: string;
  maxThumbnails?: number;
  showUploadButton?: boolean;
  canUpload?: boolean;
  onImageCountChange?: (count: number) => void;
  compact?: boolean;
  onImagesChange?: (images: File[]) => void;
}

export default function BefaringPunktImageThumbnails({ 
  befaringPunktId, 
  orgId,
  maxThumbnails = 4,
  showUploadButton = true,
  canUpload = true,
  onImageCountChange,
  compact = false,
  onImagesChange
}: BefaringPunktImageThumbnailsProps) {
  const [images, setImages] = useState<BefaringPunktImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImage, setSelectedImage] = useState<BefaringPunktImage | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showFullGallery, setShowFullGallery] = useState(false);
  const { toast } = useToast();

  const loadImages = useCallback(async () => {
    // Skip loading if befaringPunktId is null (new point in dialog)
    if (!befaringPunktId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('oppgave_bilder')
        .select(`
          id,
          image_url,
          image_type,
          uploaded_by,
          uploaded_by_email,
          created_at
        `)
        .eq('befaring_punkt_id', befaringPunktId)
        .eq('image_source', 'punkt')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const typedData = (data || []).map(item => ({
        id: item.id,
        image_url: item.image_url,
        image_type: item.image_type as 'standard' | 'før' | 'etter' | null,
        uploaded_by: item.uploaded_by,
        uploaded_by_email: item.uploaded_by_email,
        created_at: item.created_at
      }));
      
      setImages(typedData);
      onImageCountChange?.(typedData.length);
    } catch (error) {
      console.error('Error loading images:', error);
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, [befaringPunktId, onImageCountChange]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const handleImageClick = (image: BefaringPunktImage) => {
    const imageIndex = images.findIndex(img => img.id === image.id);
    setSelectedImage(image);
    setSelectedImageIndex(imageIndex);
    setShowImageViewer(true);
  };

  const goToPreviousImage = () => {
    if (selectedImageIndex > 0) {
      const newIndex = selectedImageIndex - 1;
      setSelectedImageIndex(newIndex);
      setSelectedImage(images[newIndex]);
    }
  };

  const goToNextImage = () => {
    if (selectedImageIndex < images.length - 1) {
      const newIndex = selectedImageIndex + 1;
      setSelectedImageIndex(newIndex);
      setSelectedImage(images[newIndex]);
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!showImageViewer) return;
    
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        goToPreviousImage();
        break;
      case 'ArrowRight':
        e.preventDefault();
        goToNextImage();
        break;
      case 'Escape':
        setShowImageViewer(false);
        setSelectedImage(null);
        setSelectedImageIndex(0);
        break;
    }
  }, [showImageViewer, selectedImageIndex, images.length]);

  // Add keyboard navigation
  useEffect(() => {
    if (showImageViewer) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showImageViewer, handleKeyDown]);

  const getImageTypeColor = (type: string | null) => {
    switch (type) {
      case 'før': return 'bg-blue-100 text-blue-800';
      case 'etter': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getImageTypeLabel = (type: string | null) => {
    switch (type) {
      case 'før': return 'Før';
      case 'etter': return 'Etter';
      default: return 'Standard';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-1">
        <div className="w-6 h-6 bg-gray-200 rounded animate-pulse"></div>
        <div className="w-6 h-6 bg-gray-200 rounded animate-pulse"></div>
        <div className="w-6 h-6 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  if (images.length === 0) {
    if (!showUploadButton) return null;
    
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-6 px-2 text-xs bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
        onClick={(e) => {
          e.stopPropagation();
          setShowUploadDialog(true);
        }}
      >
        <Plus className="h-3 w-3 mr-1" />
        Legg til bilde
      </Button>
    );
  }

  const visibleImages = images.slice(0, maxThumbnails);
  const remainingCount = images.length - maxThumbnails;

  return (
    <>
      <div className="flex items-center gap-1">
        {/* Thumbnails */}
        {visibleImages.map((image, index) => (
          <div
            key={image.id}
            className="relative w-6 h-6 rounded border border-gray-200 overflow-hidden cursor-pointer hover:border-blue-300 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              handleImageClick(image);
            }}
          >
            <img
              src={image.image_url}
              alt={`Thumbnail ${index + 1}`}
              className="w-full h-full object-cover"
            />
            
            {/* Image type indicator */}
            <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full border border-white"
                 style={{ backgroundColor: getImageTypeColor(image.image_type).split(' ')[0].replace('bg-', '') }}>
            </div>
          </div>
        ))}

        {/* "See all" button if there are more images */}
        {remainingCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            onClick={(e) => {
              e.stopPropagation();
              setShowFullGallery(true);
            }}
          >
            <ChevronRight className="h-3 w-3 mr-1" />
            Se alle ({images.length})
          </Button>
        )}

        {/* Upload button */}
        {showUploadButton && canUpload && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-gray-600 hover:text-gray-700 hover:bg-gray-50"
            onClick={(e) => {
              e.stopPropagation();
              setShowUploadDialog(true);
            }}
          >
            <Plus className="h-3 w-3 mr-1" />
            Legg til
          </Button>
        )}
      </div>

      {/* Full Gallery Modal */}
      <Dialog open={showFullGallery} onOpenChange={setShowFullGallery}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Bilder ({images.length})
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto">
            {images.map((image, index) => (
              <div
                key={image.id}
                className="relative group cursor-pointer"
                onClick={() => {
                  setSelectedImage(image);
                  setSelectedImageIndex(index);
                  setShowImageViewer(true);
                  setShowFullGallery(false);
                }}
              >
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={image.image_url}
                    alt={`Bilde ${index + 1}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform"
                  />
                </div>
                
                {/* Image type badge */}
                <div className="absolute top-2 left-2">
                  <Badge className={`text-xs ${getImageTypeColor(image.image_type)}`}>
                    {getImageTypeLabel(image.image_type)}
                  </Badge>
                </div>
                
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Eye className="h-6 w-6 text-white" />
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Viewer */}
      <Dialog open={showImageViewer} onOpenChange={setShowImageViewer}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>
                {selectedImage && getImageTypeLabel(selectedImage.image_type)} bilde
                {images.length > 1 && (
                  <span className="text-sm text-gray-500 ml-2">
                    ({selectedImageIndex + 1} av {images.length})
                  </span>
                )}
              </span>
              <div className="flex gap-2">
                {images.length > 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToPreviousImage}
                      disabled={selectedImageIndex === 0}
                    >
                      ← Forrige
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToNextImage}
                      disabled={selectedImageIndex === images.length - 1}
                    >
                      Neste →
                    </Button>
                  </>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedImage && (
            <div className="flex justify-center">
              <img
                src={selectedImage.image_url}
                alt={`Bilde ${selectedImageIndex + 1}`}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Last opp bilde</DialogTitle>
          </DialogHeader>
          
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">
              Upload funksjonalitet kommer snart...
            </p>
            <Button 
              variant="outline" 
              onClick={() => setShowUploadDialog(false)}
            >
              Lukk
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
