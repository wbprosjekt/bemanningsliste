'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Image as ImageIcon, 
  Plus,
  Eye,
  Trash2,
  Download,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface OppgaveImage {
  id: string;
  image_url: string;
  image_type: 'standard' | 'før' | 'etter';
  uploaded_by: string | null;
  uploaded_by_email: string | null;
  created_at: string;
}

interface OppgaveImageThumbnailsProps {
  oppgaveId: string;
  maxThumbnails?: number;
  showUploadButton?: boolean;
  onImageClick?: (image: OppgaveImage) => void;
  refreshTrigger?: number; // External trigger to refresh images
  onViewerStateChange?: (isOpen: boolean) => void; // Notify parent of viewer state
}

export default function OppgaveImageThumbnails({ 
  oppgaveId, 
  maxThumbnails = 4,
  showUploadButton = true,
  onImageClick,
  refreshTrigger,
  onViewerStateChange
}: OppgaveImageThumbnailsProps) {
  const [images, setImages] = useState<OppgaveImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImage, setSelectedImage] = useState<OppgaveImage | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [lastCloseTime, setLastCloseTime] = useState<number>(0);
  const { toast } = useToast();

  const loadImages = useCallback(async () => {
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
        .eq('oppgave_id', oppgaveId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setImages(data || []);
    } catch (error) {
      console.error('Error loading images:', error);
      setImages([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  }, [oppgaveId]);

  useEffect(() => {
    loadImages();
  }, [loadImages, refreshTrigger]);

  const handleImageClick = (image: OppgaveImage) => {
    // Prevent rapid dialog openings
    const now = Date.now();
    if (now - lastCloseTime < 300) {
      return; // Ignore clicks within 300ms of closing
    }

    if (onImageClick) {
      onImageClick(image);
    } else {
      const imageIndex = images.findIndex(img => img.id === image.id);
      setSelectedImage(image);
      setSelectedImageIndex(imageIndex);
      setShowImageViewer(true);
      onViewerStateChange?.(true);
    }
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
        setLastCloseTime(Date.now());
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

  const handleUploadSuccess = () => {
    loadImages();
    setShowUploadDialog(false);
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
          e.stopPropagation(); // Prevent parent Card click
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
            className="relative group cursor-pointer"
            onClick={(e) => {
              e.stopPropagation(); // Prevent parent Card click
              handleImageClick(image);
            }}
          >
            <img
              src={image.image_url}
              alt={`Bilde ${index + 1}`}
              className="w-6 h-6 rounded object-cover border border-gray-200 hover:border-blue-300 transition-colors"
              loading="lazy"
              onError={(e) => {
                // Fallback to icon if image fails to load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent && !parent.querySelector('.fallback-icon')) {
                  const fallback = document.createElement('div');
                  fallback.className = 'fallback-icon w-6 h-6 rounded bg-gray-100 border border-gray-200 flex items-center justify-center';
                  fallback.innerHTML = '<svg class="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>';
                  parent.appendChild(fallback);
                }
              }}
            />
            
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded transition-all duration-200 flex items-center justify-center">
              <Eye className="h-3 w-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            
            {/* Image type badge */}
            {image.image_type !== 'standard' && (
              <div className="absolute -top-1 -right-1">
                <Badge 
                  variant="secondary" 
                  className="h-3 px-1 text-xs bg-amber-100 text-amber-800 border-amber-300"
                >
                  {image.image_type === 'før' ? 'F' : 'E'}
                </Badge>
              </div>
            )}
          </div>
        ))}
        
        {/* More images indicator */}
        {remainingCount > 0 && (
          <div
            className="w-6 h-6 rounded bg-gray-100 border border-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors"
            onClick={(e) => {
              e.stopPropagation(); // Prevent parent Card click
              handleImageClick(images[0]); // Click first image to show all
            }}
          >
            <span className="text-xs font-medium text-gray-600">+{remainingCount}</span>
          </div>
        )}
        
        {/* Upload button */}
        {showUploadButton && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-xs bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
            onClick={(e) => {
              e.stopPropagation(); // Prevent parent Card click
              setShowUploadDialog(true);
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Image Viewer Dialog */}
      <Dialog open={showImageViewer} onOpenChange={(open) => {
        if (!open) {
          // Ensure we close cleanly and reset state
          setLastCloseTime(Date.now());
          setShowImageViewer(false);
          setSelectedImage(null);
          setSelectedImageIndex(0);
          onViewerStateChange?.(false);
        } else {
          onViewerStateChange?.(true);
        }
      }}>
        <DialogContent 
          className="max-w-4xl max-h-[90vh] p-0 z-[60]"
          style={{ zIndex: 60 }}
          onPointerDownOutside={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onInteractOutside={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center justify-between">
              <span>Bildevisning</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setLastCloseTime(Date.now());
                  setShowImageViewer(false);
                  setSelectedImage(null);
                  setSelectedImageIndex(0);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          {selectedImage && (
            <div 
              className="p-6"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="relative">
                {/* Navigation arrows */}
                {images.length > 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        goToPreviousImage();
                      }}
                      disabled={selectedImageIndex === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        goToNextImage();
                      }}
                      disabled={selectedImageIndex === images.length - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                )}

                {/* Image counter */}
                {images.length > 1 && (
                  <div className="absolute top-4 right-4 z-10 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                    {selectedImageIndex + 1} / {images.length}
                  </div>
                )}

                <img
                  src={selectedImage.image_url}
                  alt="Bilde"
                  className="w-full h-auto max-h-[60vh] object-contain rounded"
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    const touch = e.touches[0];
                    e.currentTarget.setAttribute('data-touch-start', touch.clientX.toString());
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    const touch = e.changedTouches[0];
                    const startX = parseFloat(e.currentTarget.getAttribute('data-touch-start') || '0');
                    const deltaX = touch.clientX - startX;
                    
                    // Swipe threshold: 50px
                    if (Math.abs(deltaX) > 50) {
                      if (deltaX > 0) {
                        // Swipe right - previous image
                        goToPreviousImage();
                      } else {
                        // Swipe left - next image
                        goToNextImage();
                      }
                    }
                  }}
                />
                
                {/* Image info */}
                <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                  <div className="flex items-center gap-4">
                    <Badge variant="outline">
                      {selectedImage.image_type}
                    </Badge>
                    {selectedImage.uploaded_by_email && (
                      <span>Lastet opp av: {selectedImage.uploaded_by_email}</span>
                    )}
                    <span>
                      {new Date(selectedImage.created_at).toLocaleDateString('no-NO')}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.open(selectedImage.image_url, '_blank');
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Åpne
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const link = document.createElement('a');
                        link.href = selectedImage.image_url;
                        link.download = `bilde-${selectedImage.id}`;
                        link.click();
                      }}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Last ned
                    </Button>
                  </div>
                </div>

                {/* Navigation instructions */}
                {images.length > 1 && (
                  <div className="mt-2 text-center text-xs text-gray-500">
                    Bruk piler eller swipe for å navigere mellom bildene
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload Dialog - Import OppgaveImageUpload */}
      {showUploadDialog && (
        <div className="fixed inset-0 z-50">
          {/* This will be handled by the parent component or we can import OppgaveImageUpload here */}
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Last opp bilde</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowUploadDialog(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                For å laste opp bilder, åpne oppgaven og bruk "Legg til bilde" knappen.
              </p>
              <Button
                onClick={() => setShowUploadDialog(false)}
                className="w-full"
              >
                OK
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
