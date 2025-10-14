'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Upload, X, Image as ImageIcon, Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import imageCompression from 'browser-image-compression';

interface OppgaveImageUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oppgaveId: string;
}

const IMAGE_TYPES = [
  { value: 'standard', label: 'Standard' },
  { value: 'før', label: 'Før' },
  { value: 'etter', label: 'Etter' },
];

export default function OppgaveImageUpload({
  open,
  onOpenChange,
  oppgaveId,
}: OppgaveImageUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageType, setImageType] = useState<string>('standard');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [openingFilePicker, setOpeningFilePicker] = useState(false);
  const { toast } = useToast();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Ugyldig filtype',
        description: 'Kun bildefiler er tillatt.',
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

        // Compression options
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
      console.error('Compression error:', error);
      toast({
        title: 'Komprimeringsfeil',
        description: 'Bruker original bilde.',
        variant: 'destructive',
      });
      setSelectedFile(file);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const openFilePicker = () => {
    console.log('📁 Opening file picker (gallery)');
    setOpeningFilePicker(true);
    fileInputRef.current?.click();
    // Reset openingFilePicker after a short delay
    setTimeout(() => {
      console.log('⏰ Resetting file picker state');
      setOpeningFilePicker(false);
    }, 250);
  };

  const openCamera = () => {
    console.log('📷 Opening camera');
    setOpeningFilePicker(true);
    cameraInputRef.current?.click();
    // Reset openingFilePicker after a short delay
    setTimeout(() => {
      console.log('⏰ Resetting camera state');
      setOpeningFilePicker(false);
    }, 250);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress(0);
    
    try {
      // Get user ID once at the start
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Ikke autentisert');

      setUploadProgress(10);

      // Generate unique filename
      const timestamp = Date.now();
      const fileExtension = selectedFile.name.split('.').pop();
      const fileName = `${oppgaveId}/${timestamp}_${imageType}.${fileExtension}`;

      setUploadProgress(20);

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('befaring-assets')
        .upload(fileName, selectedFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      setUploadProgress(70);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('befaring-assets')
        .getPublicUrl(fileName);

      setUploadProgress(80);

      // Save image record to database
      const { error: dbError } = await supabase
        .from('oppgave_bilder')
        .insert({
          oppgave_id: oppgaveId,
          image_url: urlData.publicUrl,
          image_type: imageType,
          uploaded_by: user.id,
        });

      if (dbError) throw dbError;

      setUploadProgress(100);

      // Reset form
      setSelectedFile(null);
      setImageType('standard');
      setUploadProgress(0);
      
      // Close dialog
      onOpenChange(false);
      
      toast({
        title: 'Bilde lastet opp',
        description: 'Bildet ble lagt til oppgaven.',
      });
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Feil ved opplasting',
        description: error.message || 'Kunne ikke laste opp bilde',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setImageType('standard');
    setOpeningFilePicker(false);
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    console.log('🔍 Sheet state change:', { 
      newOpen, 
      openingFilePicker, 
      currentOpen: open
    });
    
    // Prevent closing if file picker is opening
    if (openingFilePicker && !newOpen) {
      console.log('🚫 Preventing close - file picker opening');
      return;
    }
    if (!newOpen) {
      console.log('❌ Closing sheet');
      handleClose();
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent 
        side="right"
        className="w-full sm:max-w-[500px] overflow-y-auto"
        onInteractOutside={(e) => {
          if (openingFilePicker) {
            e.preventDefault();
          }
        }}
      >
        <SheetHeader>
          <SheetTitle>Last opp bilde til oppgave</SheetTitle>
          <SheetDescription>
            Legg til et bilde som dokumentasjon for oppgaven.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          {/* Image Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="image-type">Bildetype</Label>
            <Select value={imageType} onValueChange={setImageType}>
              <SelectTrigger>
                <SelectValue placeholder="Velg bildetype" />
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

          {/* File Upload Area */}
          <div className="space-y-2">
            <Label>Bildefil</Label>
            <div
              className={`
                border-2 border-dashed rounded-lg p-6 text-center transition-colors
                ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
                ${selectedFile ? 'border-green-500 bg-green-50' : ''}
              `}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              {selectedFile ? (
                <div className="space-y-2">
                  <ImageIcon className="h-12 w-12 text-green-500 mx-auto" />
                  <p className="text-sm font-medium text-green-700">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                    className="mt-2"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Fjern fil
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      Dra og slipp bilde her, eller velg nedenfor
                    </p>
                    <p className="text-xs text-gray-500">
                      PNG, JPG, JPEG • Maks 5MB • Komprimeres automatisk
                    </p>
                  </div>
                  
                  {/* Hidden file inputs */}
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    onClick={(e) => {
                      // Reset input value to allow selecting the same file again
                      (e.target as HTMLInputElement).value = '';
                    }}
                  />
                  <Input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                    onClick={(e) => {
                      // Reset input value to allow selecting the same file again
                      (e.target as HTMLInputElement).value = '';
                    }}
                  />
                  
                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={openFilePicker}
                      className="flex-1"
                    >
                      <ImageIcon className="h-4 w-4 mr-1" />
                      Fra galleri
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
          </div>
        </div>

        {/* Upload Progress */}
        {uploading && uploadProgress > 0 && (
          <div className="space-y-2">
            <Progress value={uploadProgress} className="w-full" />
            <p className="text-xs text-center text-gray-500">
              Laster opp... {uploadProgress}%
            </p>
          </div>
        )}

        <SheetFooter className="mt-6">
          <Button type="button" variant="outline" onClick={handleClose} disabled={uploading}>
            Avbryt
          </Button>
          <Button 
            type="button"
            onClick={handleUpload} 
            disabled={!selectedFile || uploading}
          >
            {uploading ? `Laster opp... ${uploadProgress}%` : 'Last opp bilde'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
