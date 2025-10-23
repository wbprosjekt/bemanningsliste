'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Image as ImageIcon, 
  Plus, 
  Trash2, 
  Eye, 
  Download,
  Camera,
  Upload,
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

interface BefaringPunktImagesProps {
  befaringPunktId: string | null; // Allow null for new points
  orgId: string;
  canUpload?: boolean;
  onImageCountChange?: (count: number) => void;
  compact?: boolean; // New prop for dialog usage
  onImagesChange?: (images: File[]) => void; // New prop for dialog usage
}

const IMAGE_TYPES = [
  { value: 'standard', label: 'Standard' },
  { value: 'før', label: 'Før' },
  { value: 'etter', label: 'Etter' },
];

export default function BefaringPunktImages({
  befaringPunktId,
  orgId,
  canUpload = true,
  onImageCountChange,
  compact = false,
  onImagesChange
}: BefaringPunktImagesProps) {
  const [images, setImages] = useState<BefaringPunktImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<BefaringPunktImage | null>(null);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pendingImages, setPendingImages] = useState<File[]>([]); // For dialog usage
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
      setPendingImages(prev => [...prev, selectedFile]);
      onImagesChange?.([...pendingImages, selectedFile]); // Notify parent
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

  const loadImages = async () => {
    // Skip loading if befaringPunktId is null (new point in dialog)
    if (!befaringPunktId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('oppgave_bilder')
        .select('*')
        .eq('befaring_punkt_id', befaringPunktId)
        .eq('image_source', 'punkt')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Cast data to our interface type
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
      toast({
        title: 'Feil',
        description: 'Kunne ikke laste bilder',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadImages();
  }, [befaringPunktId]);

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('Er du sikker på at du vil slette dette bildet?')) return;

    try {
      setDeleting(imageId);
      
      // Get image URL to delete from storage
      const image = images.find(img => img.id === imageId);
      if (image) {
        // Extract file path from URL
        const urlParts = image.image_url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        const filePath = `befaring-images/${orgId}/${fileName}`;
        
        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from('befaring-assets')
          .remove([filePath]);
        
        if (storageError) {
          console.warn('Error deleting from storage:', storageError);
        }
      }

      // Delete from database
      const { error } = await supabase
        .from('oppgave_bilder')
        .delete()
        .eq('id', imageId);

      if (error) throw error;

      setImages(prev => prev.filter(img => img.id !== imageId));
      onImageCountChange?.(images.length - 1);
      
      toast({
        title: 'Suksess',
        description: 'Bilde slettet',
      });
    } catch (error) {
      console.error('Error deleting image:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke slette bilde',
        variant: 'destructive',
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleDownloadImage = async (image: BefaringPunktImage) => {
    try {
      const response = await fetch(image.image_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `befaring-bilde-${image.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading image:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke laste ned bilde',
        variant: 'destructive',
      });
    }
  };

  const getImageTypeColor = (type: string | null) => {
    switch (type) {
      case 'før': return 'bg-blue-100 text-blue-800';
      case 'etter': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <ImageIcon className="h-5 w-5 text-gray-600" />
              <h3 className="font-semibold">
                Bilder ({images.length + pendingImages.length})
                {compact && pendingImages.length > 0 && (
                  <span className="text-sm text-blue-600 ml-2">
                    ({pendingImages.length} venter)
                  </span>
                )}
              </h3>
            </div>
            {canUpload && (
              <Button
                size="sm"
                onClick={() => setShowUploadDialog(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Last opp
              </Button>
            )}
          </div>

          {images.length === 0 && pendingImages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ImageIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Ingen bilder ennå</p>
              <p className="text-sm">Klikk "Last opp" for å legge til bilder</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {images.map((image) => (
                <div key={image.id} className="relative group">
                  <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={image.image_url}
                      alt={`Befaring bilde ${image.id}`}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => {
                        setSelectedImage(image);
                        setShowImageViewer(true);
                      }}
                    />
                  </div>
                  
                  {/* Overlay with actions */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setSelectedImage(image);
                          setShowImageViewer(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleDownloadImage(image)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {canUpload && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteImage(image.id)}
                          disabled={deleting === image.id}
                        >
                          {deleting === image.id ? (
                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Image type badge */}
                  <div className="absolute top-2 left-2">
                    <Badge className={getImageTypeColor(image.image_type)}>
                      {IMAGE_TYPES.find(t => t.value === image.image_type)?.label || 'Standard'}
                    </Badge>
                  </div>
                </div>
              ))}

              {/* Pending images (for dialog mode) */}
              {pendingImages.map((file, index) => (
                <div key={`pending-${index}`} className="relative group">
                  <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Pending image ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  {/* Pending badge */}
                  <div className="absolute top-2 left-2">
                    <Badge className="text-xs bg-blue-100 text-blue-800">
                      Ventende
                    </Badge>
                  </div>
                  
                  {/* Remove button */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setPendingImages(prev => prev.filter((_, i) => i !== index));
                        onImagesChange?.(pendingImages.filter((_, i) => i !== index));
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog - Same experience as OppgaveImageUpload */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-md">
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

      {/* Image Viewer */}
      <Dialog open={showImageViewer} onOpenChange={setShowImageViewer}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Bilde visning</span>
              {selectedImage && (
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownloadImage(selectedImage)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Last ned
                  </Button>
                  {canUpload && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        handleDeleteImage(selectedImage.id);
                        setShowImageViewer(false);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Slett
                    </Button>
                  )}
                </div>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="flex justify-center">
              <img
                src={selectedImage.image_url}
                alt={`Befaring bilde ${selectedImage.id}`}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

