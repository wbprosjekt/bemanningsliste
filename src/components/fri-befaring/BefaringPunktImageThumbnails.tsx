'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  Eye, 
  ChevronRight,
  Image as ImageIcon,
  Upload,
  Camera,
  X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import imageCompression from 'browser-image-compression';

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

const IMAGE_TYPES = [
  { value: 'standard', label: 'Standard' },
  { value: 'før', label: 'Før' },
  { value: 'etter', label: 'Etter' },
];

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedImageType, setSelectedImageType] = useState<string>('standard');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Ugyldig filtype',
        description: 'Kun bildefiler er tillatt.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Fil for stor',
        description: 'Bildet må være mindre enn 10MB.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Only compress if file is larger than 2MB
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: 'Komprimerer bilde...',
          description: 'Bildet blir optimalisert for raskere opplasting.',
        });

        // Compression options - same as rest of app
        const options = {
          maxSizeMB: 3, // Target 3MB (more aggressive)
          maxWidthOrHeight: 1920, // Max 1920px (Full HD)
          useWebWorker: true,
          initialQuality: 0.85, // Start with 85% quality
          fileType: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
        };

        // Compress the image
        const compressedFile = await imageCompression(file, options);
        
        // Show compression result
        const originalSizeMB = (file.size / 1024 / 1024).toFixed(2);
        const compressedSizeMB = (compressedFile.size / 1024 / 1024).toFixed(2);
        
        console.log(`Compressed: ${originalSizeMB}MB → ${compressedSizeMB}MB`);
        
        setSelectedFile(compressedFile);
      } else {
        // File is already small, use as-is
        console.log('File is small enough, skipping compression');
        setSelectedFile(file);
      }
    } catch (error) {
      console.error('Error compressing image:', error);
      toast({
        title: 'Komprimeringsfeil',
        description: 'Bruker original bilde.',
        variant: 'destructive',
      });
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    if (!befaringPunktId) { // If befaringPunktId is null (dialog mode)
      onImagesChange?.([selectedFile]);
      setSelectedFile(null);
      setShowUploadDialog(false);
      toast({
        title: 'Bilde lagt til',
        description: 'Bildet vil bli lastet opp når punktet opprettes.',
      });
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Ikke innlogget');

      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `befaring-images/${orgId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('befaring-assets')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('befaring-assets')
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase
        .from('oppgave_bilder' as any)
        .insert({
          image_url: urlData.publicUrl,
          befaring_punkt_id: befaringPunktId,
          image_source: 'punkt',
          uploaded_by: user.id,
          uploaded_by_email: user.email,
          image_type: selectedImageType
        });

      if (insertError) throw insertError;

      toast({
        title: 'Bilde lastet opp',
        description: 'Bildet er lagt til befaringspunktet.',
      });

      setSelectedFile(null);
      setSelectedImageType('standard');
      loadImages(); // Reload images
      onImageCountChange?.(images.length + 1);
      setShowUploadDialog(false); // Close dialog after successful upload
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Feil ved opplasting',
        description: 'Kunne ikke laste opp bildet.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const openCamera = () => {
    cameraInputRef.current?.click();
  };

  const loadImages = useCallback(async () => {
    // Skip loading if befaringPunktId is null (new point in dialog)
    if (!befaringPunktId) {
      setLoading(false);
      return;
    }

    try {
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

  if (loading && images.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-12 h-12 bg-gray-200 rounded animate-pulse"></div>
        <div className="w-12 h-12 bg-gray-200 rounded animate-pulse"></div>
        <div className="w-12 h-12 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  if (images.length === 0) {
    if (!showUploadButton || !canUpload) {
      console.log('⚠️ Upload button hidden:', { showUploadButton, canUpload, befaringPunktId });
      return null;
    }
    
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-10 px-3 text-sm bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          console.log('🖼️ Opening upload dialog, befaringPunktId:', befaringPunktId, 'showUploadDialog state:', showUploadDialog);
          setShowUploadDialog(true);
        }}
      >
        <Plus className="h-4 w-4 mr-2" />
        Legg til bilde
      </Button>
    );
  }

  const visibleImages = images.slice(0, maxThumbnails);
  const remainingCount = images.length - maxThumbnails;

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Thumbnails */}
        {visibleImages.map((image, index) => (
          <div
            key={image.id}
            className="relative w-12 h-12 rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:border-blue-300 transition-colors shadow-sm"
            onClick={(e) => {
              e.stopPropagation();
              handleImageClick(image);
            }}
          >
            <img
              src={image.image_url}
              alt={`Thumbnail ${index + 1}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            
            {/* Image type indicator */}
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white"
                 style={{ backgroundColor: getImageTypeColor(image.image_type).split(' ')[0].replace('bg-', '') }}>
            </div>
          </div>
        ))}

        {/* "See all" button if there are more images */}
        {remainingCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-10 px-3 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            onClick={(e) => {
              e.stopPropagation();
              setShowFullGallery(true);
            }}
          >
            <ChevronRight className="h-4 w-4 mr-1" />
            Se alle ({images.length})
          </Button>
        )}

        {/* Upload button */}
        {showUploadButton && canUpload && (
          <Button
            variant="ghost"
            size="sm"
            className="h-10 px-3 text-sm text-gray-600 hover:text-gray-700 hover:bg-gray-50"
            onClick={(e) => {
              e.stopPropagation();
              console.log('🖼️ Opening upload dialog (existing images), befaringPunktId:', befaringPunktId);
              setShowUploadDialog(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
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
      <Dialog open={showUploadDialog} onOpenChange={(open) => {
        console.log('🔄 Upload dialog state changed:', open);
        setShowUploadDialog(open);
      }}>
        <DialogContent className="sm:max-w-md z-50">
          <DialogHeader>
            <DialogTitle>Last opp bilde</DialogTitle>
            <DialogDescription>
              Velg et bilde å laste opp til dette befaringspunktet
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Drag and Drop Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragActive 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragActive(false);
              }}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                const file = e.dataTransfer.files[0];
                if (file) {
                  handleFileSelect(file);
                }
              }}
            >
              {selectedFile ? (
                <div className="space-y-2">
                  <div className="aspect-video rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={URL.createObjectURL(selectedFile)}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-sm text-gray-600">{selectedFile.name}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedFile(null)}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Fjern
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-gray-400" />
                  <p className="text-sm">Dra og slipp bilde her</p>
                  <p className="text-xs text-gray-500">eller</p>
                  <div className="flex space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={openFilePicker}
                      className="flex-1"
                    >
                      <ImageIcon className="h-4 w-4 mr-1" />
                      Velg fil
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={openCamera}
                      className="flex-1"
                    >
                      <Camera className="h-4 w-4 mr-1" />
                      Ta bilde
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileSelect(file);
                }
                // Reset input value to allow selecting the same file again
                (e.target as HTMLInputElement).value = '';
              }}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileSelect(file);
                }
                // Reset input value to allow selecting the same file again
                (e.target as HTMLInputElement).value = '';
              }}
              className="hidden"
            />

            {/* Image type selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Bildetype</label>
              <Select value={selectedImageType} onValueChange={setSelectedImageType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Upload Progress */}
            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Laster opp...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Avbryt
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={!selectedFile || uploading}
            >
              {uploading ? 'Laster opp...' : 'Last opp'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
