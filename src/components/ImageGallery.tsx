'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Download,
  Calendar,
  User,
  MapPin
} from 'lucide-react';

interface Photo {
  id: string;
  image_url: string;
  uploaded_by?: string | null;
  uploaded_by_email?: string | null;
  created_at?: string | null;
  oppgave_id?: string | null;
  befaring_punkt_id?: string | null;
  prosjekt_id?: string | null;
}

interface ImageGalleryProps {
  photos: Photo[];
  isOpen: boolean;
  onClose: () => void;
  initialIndex?: number;
  oppgaveInfo?: {
    id: string;
    title?: string;
    fag?: string;
    status?: string;
    oppgave_nummer?: number;
  };
}

export default function ImageGallery({ 
  photos, 
  isOpen, 
  onClose, 
  initialIndex = 0,
  oppgaveInfo 
}: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const currentPhoto = photos[currentIndex];

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  };

  const handleDownload = () => {
    if (currentPhoto.image_url) {
      const link = document.createElement('a');
      link.href = currentPhoto.image_url;
      link.download = `image-${currentPhoto.id}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') handlePrevious();
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'Escape') onClose();
  };

  if (!isOpen || !currentPhoto) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-4xl max-h-[90vh] p-0 overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              Bilde {currentIndex + 1} av {photos.length}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Last ned
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col lg:flex-row h-[calc(90vh-80px)]">
          {/* Main Image */}
          <div className="flex-1 relative bg-gray-100 flex items-center justify-center">
            <img
              src={currentPhoto.image_url}
              alt={`Bilde ${currentIndex + 1}`}
              className="max-w-full max-h-full object-contain"
            />
            
            {/* Navigation Arrows */}
            {photos.length > 1 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute left-4 top-1/2 transform -translate-y-1/2"
                  onClick={handlePrevious}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute right-4 top-1/2 transform -translate-y-1/2"
                  onClick={handleNext}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>

          {/* Sidebar with Info */}
          <div className="w-full lg:w-80 border-l bg-white p-4 overflow-y-auto">
            <div className="space-y-4">
              {/* Oppgave Info */}
              {oppgaveInfo && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-gray-900">Oppgave-informasjon</h3>
                  <div className="space-y-1 text-sm">
                    {oppgaveInfo.title && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Tittel:</span>
                        <span>{oppgaveInfo.title}</span>
                      </div>
                    )}
                    {oppgaveInfo.fag && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Fag:</span>
                        <Badge variant="outline" className="text-xs">
                          {oppgaveInfo.fag}
                        </Badge>
                      </div>
                    )}
                    {oppgaveInfo.status && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Status:</span>
                        <Badge 
                          variant={oppgaveInfo.status === 'lukket' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {oppgaveInfo.status}
                        </Badge>
                      </div>
                    )}
                    {oppgaveInfo.oppgave_nummer && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Nummer:</span>
                        <span>#{oppgaveInfo.oppgave_nummer}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Photo Info */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-gray-900">Bilde-informasjon</h3>
                <div className="space-y-1 text-sm">
                  {currentPhoto.created_at && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3 text-gray-400" />
                      <span>{new Date(currentPhoto.created_at).toLocaleString('no-NO')}</span>
                    </div>
                  )}
                  {currentPhoto.uploaded_by_email && (
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-gray-400" />
                      <span>{currentPhoto.uploaded_by_email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Thumbnail Navigation */}
              {photos.length > 1 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-gray-900">Alle bilder</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((photo, index) => (
                      <button
                        key={photo.id}
                        onClick={() => setCurrentIndex(index)}
                        className={`relative aspect-square rounded border-2 overflow-hidden ${
                          index === currentIndex 
                            ? 'border-blue-500' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <img
                          src={photo.image_url}
                          alt={`Thumbnail ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {index === currentIndex && (
                          <div className="absolute inset-0 bg-blue-500 bg-opacity-20" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
