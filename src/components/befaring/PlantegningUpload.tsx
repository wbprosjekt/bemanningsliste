'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Upload, X, Image as ImageIcon, FileText } from 'lucide-react';

interface PlantegningUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  befaringId: string;
  onSuccess: () => void;
}

export default function PlantegningUpload({
  open,
  onOpenChange,
  befaringId,
  onSuccess
}: PlantegningUploadProps) {
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (file: File) => {
    // Validate file type (images and PDFs)
    const isImage = file.type.startsWith('image/');
    const isPDF = file.type === 'application/pdf';
    
    if (!isImage && !isPDF) {
      toast({
        title: 'Ugyldig filtype',
        description: 'Kun bildefiler og PDF-er er tillatt.',
        variant: 'destructive'
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Fil for stor',
        description: 'Filen kan ikke være større enn 10MB.',
        variant: 'destructive'
      });
      return;
    }

    setSelectedFile(file);
    setTitle(file.name.replace(/\.[^/.]+$/, '')); // Remove extension
    
    // Create preview only for images (not PDFs)
    if (isImage) {
      setPreviewLoading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
        setPreviewLoading(false);
      };
      reader.onerror = () => {
        setPreviewLoading(false);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile || !title.trim()) {
      toast({
        title: 'Mangler informasjon',
        description: 'Vennligst velg en fil og skriv inn en tittel.',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      console.log('📤 Starting plantegning upload...', { befaringId, title, fileName: selectedFile.name });
      
      // Get next display order
      const { data: lastPlantegning } = await supabase
        .from('plantegninger')
        .select('display_order')
        .eq('befaring_id', befaringId)
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log('📊 Last plantegning:', lastPlantegning);
      const nextOrder = lastPlantegning?.display_order ? lastPlantegning.display_order + 1 : 1;
      console.log('📋 Next order:', nextOrder);

      // Upload file to Supabase Storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${befaringId}/${Date.now()}.${fileExt}`;
      console.log('📁 Uploading to:', fileName);
      
      const { error: uploadError } = await supabase.storage
        .from('befaring-assets')
        .upload(fileName, selectedFile);

      if (uploadError) {
        console.error('❌ Upload error:', uploadError);
        throw uploadError;
      }
      console.log('✅ Upload successful');

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('befaring-assets')
        .getPublicUrl(fileName);
      console.log('🔗 Public URL:', urlData.publicUrl);

      // Determine file type
      const fileType = selectedFile.type === 'application/pdf' ? 'pdf' : 'image';
      console.log('📄 File type:', fileType);

      // Create plantegning record
      const { error: insertError } = await supabase
        .from('plantegninger')
        .insert({
          befaring_id: befaringId,
          title: title.trim(),
          image_url: urlData.publicUrl,
          display_order: nextOrder,
          file_type: fileType
        });

      if (insertError) {
        console.error('❌ Insert error:', insertError);
        throw insertError;
      }
      console.log('✅ Plantegning created successfully');

      toast({
        title: 'Plantegning lastet opp',
        description: `${title} har blitt lagt til befaringen.`
      });

      // Reset form
      setSelectedFile(null);
      setTitle('');
      setPreview(null);
      onOpenChange(false);
      
      console.log('🔄 Calling onSuccess callback...');
      onSuccess();
      console.log('✅ onSuccess callback completed');
    } catch (error) {
      console.error('Error uploading plantegning:', error);
      toast({
        title: 'Feil ved opplasting',
        description: error instanceof Error ? error.message : 'En ukjent feil oppstod',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setTitle('');
    setPreview(null);
    setPreviewLoading(false);
    setDragOver(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Last opp plantegning</DialogTitle>
          <DialogDescription>
            Velg et bilde eller PDF som skal brukes som plantegning for befaringen.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File upload area */}
          <div
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
              ${selectedFile ? 'border-green-500 bg-green-50' : ''}
            `}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {selectedFile ? (
              <div className="space-y-4">
                {previewLoading && (
                  <div className="mx-auto max-w-xs flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                )}
                {preview && !previewLoading && (
                  <div className="mx-auto max-w-xs">
                    <img
                      src={preview}
                      alt="Preview"
                      className="w-full h-auto rounded-lg border border-gray-200"
                    />
                  </div>
                )}
                <div>
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    {selectedFile.type === 'application/pdf' ? (
                      <FileText className="h-5 w-5" />
                    ) : (
                      <ImageIcon className="h-5 w-5" />
                    )}
                    <span className="font-medium">{selectedFile.name}</span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • {selectedFile.type === 'application/pdf' ? 'PDF' : 'Bilde'}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedFile(null);
                    setPreview(null);
                    setPreviewLoading(false);
                    setTitle('');
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Fjern fil
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                <div>
                  <div className="text-lg font-medium text-gray-900">
                    Dra og slipp bilde eller PDF her
                  </div>
                  <div className="text-sm text-gray-500">
                    eller klikk for å velge fil
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Velg fil
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Title input */}
          <div className="space-y-2">
            <Label htmlFor="title">Tittel *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="F.eks. 1. etasje, Kjøkken, Bad..."
              required
            />
          </div>

          {/* File info */}
          {selectedFile && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <div><strong>Filtype:</strong> {selectedFile.type}</div>
              <div><strong>Størrelse:</strong> {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</div>
              <div><strong>Maks størrelse:</strong> 10 MB</div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
            >
              Avbryt
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !selectedFile || !title.trim()}
            >
              {loading ? 'Laster opp...' : 'Last opp'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}