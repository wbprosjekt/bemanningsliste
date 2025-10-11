'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Upload, 
  Image as ImageIcon, 
  X, 
  Plus,
  FileImage,
  Trash2
} from 'lucide-react';

interface Plantegning {
  id: string;
  navn: string;
  filsti: string;
  rekkefolge: number;
}

interface PlantegningUploadProps {
  befaringId: string;
  onUploadSuccess: () => void;
}

export default function PlantegningUpload({ befaringId, onUploadSuccess }: PlantegningUploadProps) {
  const [plantegninger, setPlantegninger] = useState<Plantegning[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (files: FileList) => {
    if (!files.length) return;

    setLoading(true);
    const uploadPromises = Array.from(files).map(async (file) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Ugyldig filtype',
          description: `${file.name} er ikke et bilde.`,
          variant: 'destructive',
        });
        return null;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'Fil for stor',
          description: `${file.name} er større enn 10MB.`,
          variant: 'destructive',
        });
        return null;
      }

      try {
        // Upload to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `plantegninger/${befaringId}/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('befaring-assets')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('befaring-assets')
          .getPublicUrl(filePath);

        // Save to database
        const { data: dbData, error: dbError } = await supabase
          .from('plantegninger')
          .insert({
            befaring_id: befaringId,
            navn: file.name.replace(/\.[^/.]+$/, ''), // Remove file extension
            filsti: filePath,
            rekkefolge: plantegninger.length + 1,
          })
          .select()
          .single();

        if (dbError) throw dbError;

        return {
          ...dbData,
          url: urlData.publicUrl,
        };
      } catch (error) {
        console.error('Error uploading file:', error);
        toast({
          title: 'Feil ved opplasting',
          description: `Kunne ikke laste opp ${file.name}.`,
          variant: 'destructive',
        });
        return null;
      }
    });

    try {
      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter(Boolean);
      
      if (successfulUploads.length > 0) {
        setPlantegninger(prev => [...prev, ...successfulUploads]);
        onUploadSuccess();
        
        toast({
          title: 'Plantegninger lastet opp',
          description: `${successfulUploads.length} plantegning(er) lastet opp.`,
        });
      }
    } catch (error) {
      console.error('Error in batch upload:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileSelect(e.target.files);
    }
  };

  const handleDeletePlantegning = async (plantegningId: string) => {
    try {
      setLoading(true);
      
      // Delete from database first
      const { error: dbError } = await supabase
        .from('plantegninger')
        .delete()
        .eq('id', plantegningId);

      if (dbError) throw dbError;

      // Update local state
      setPlantegninger(prev => prev.filter(p => p.id !== plantegningId));
      
      toast({
        title: 'Plantegning slettet',
        description: 'Plantegningen er fjernet.',
      });
    } catch (error) {
      console.error('Error deleting plantegning:', error);
      toast({
        title: 'Feil ved sletting',
        description: 'Kunne ikke slette plantegningen.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileImage className="h-5 w-5" />
            Last opp plantegninger
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">
              Dra og slipp plantegninger her
            </p>
            <p className="text-sm text-gray-500 mb-4">
              eller klikk for å velge filer
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              variant="outline"
            >
              <Plus className="mr-2 h-4 w-4" />
              Velg filer
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>
          
          <div className="mt-4 text-xs text-gray-500">
            <p>• Støtter JPG, PNG, PDF (maks 10MB per fil)</p>
            <p>• Flere filer kan lastes opp samtidig</p>
          </div>
        </CardContent>
      </Card>

      {/* Uploaded Plantegninger */}
      {plantegninger.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Lastet opp plantegninger ({plantegninger.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plantegninger.map((plantegning, index) => (
                <div key={plantegning.id} className="relative group">
                  <div className="aspect-video bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                    <div className="text-center">
                      <ImageIcon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                      <p className="text-sm font-medium text-gray-900 line-clamp-2">
                        {plantegning.navn}
                      </p>
                      <p className="text-xs text-gray-500">
                        Plantegning {index + 1}
                      </p>
                    </div>
                  </div>
                  
                  <Button
                    size="sm"
                    variant="destructive"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDeletePlantegning(plantegning.id)}
                    disabled={loading}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
