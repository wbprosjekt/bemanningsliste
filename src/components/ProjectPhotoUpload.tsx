'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Upload, Camera, Image as ImageIcon, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface ProjectPhotoUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
}

type UploadMode = 'with-project' | 'without-project';

export default function ProjectPhotoUpload({ open, onOpenChange, orgId }: ProjectPhotoUploadProps) {
  const [uploadMode, setUploadMode] = useState<UploadMode>('with-project');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: string; project_name: string; project_number: string }>>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Load projects when dialog opens
  useEffect(() => {
    const loadProjects = async () => {
      if (!open || !orgId) return;
      
      setLoadingProjects(true);
      try {
        const { data, error } = await supabase
          .from('ttx_project_cache')
          .select('id, project_name, project_number')
          .eq('org_id', orgId)
          .eq('is_active', true)
          .order('project_name', { ascending: true });
        
        if (error) throw error;
        
        setProjects(data || []);
      } catch (error) {
        console.error('Error loading projects:', error);
        toast({
          title: 'Feil',
          description: 'Kunne ikke laste prosjekter',
          variant: 'destructive'
        });
      } finally {
        setLoadingProjects(false);
      }
    };
    
    loadProjects();
  }, [open, orgId]);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const validFiles = Array.from(files).filter(file => {
      const isValidType = file.type.startsWith('image/');
      const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB
      return isValidType && isValidSize;
    });

    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    // Validation
    if (uploadMode === 'with-project' && !selectedProject) {
      toast({
        title: 'Feil',
        description: 'Velg prosjekt før opplasting',
        variant: 'destructive'
      });
      return;
    }

    if (uploadMode === 'without-project' && !comment.trim()) {
      toast({
        title: 'Feil',
        description: 'Skriv en kommentar før opplasting',
        variant: 'destructive'
      });
      return;
    }

    if (selectedFiles.length === 0) {
      toast({
        title: 'Feil',
        description: 'Velg bilder før opplasting',
        variant: 'destructive'
      });
      return;
    }

    setUploading(true);

    try {
      for (const file of selectedFiles) {
        // Compress image
        const compressedFile = await compressImage(file);

        // Upload to storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        // Create path based on upload mode
        const filePath = uploadMode === 'with-project' 
          ? `project-photos/${orgId}/${selectedProject}/${fileName}`
          : `project-photos/${orgId}/untagged/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('befaring-assets')
          .upload(filePath, compressedFile);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('befaring-assets')
          .getPublicUrl(filePath);

        // Insert into database
        // @ts-ignore - comment and prosjekt_id columns will be added via migration
        const { error: insertError } = await supabase
          .from('oppgave_bilder')
          .insert({
            prosjekt_id: uploadMode === 'with-project' ? selectedProject : null,
            image_url: publicUrl,
            storage_path: filePath,
            uploaded_by: user?.id,
            is_tagged: false,
            inbox_date: new Date().toISOString(),
            file_size_bytes: compressedFile.size,
            file_format: 'webp',
            is_optimized: true,
            comment: uploadMode === 'without-project' ? comment : null
          } as any);

        if (insertError) throw insertError;
      }

      toast({
        title: 'Suksess',
        description: `${selectedFiles.length} bilder lastet opp til prosjekt-innboks`
      });

      // Reset
      setSelectedFiles([]);
      setSelectedProject('');
      setComment('');
      setUploadMode('with-project');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error uploading images:', error);
      toast({
        title: 'Feil',
        description: `Kunne ikke laste opp bilder: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxWidth = 2048;
          const maxHeight = 2048;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(new File([blob], file.name, { type: 'image/webp' }));
              } else {
                resolve(file);
              }
            },
            'image/webp',
            0.85
          );
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2 sm:p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg sm:text-xl">Last opp bilder til prosjekt</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Last opp bilder som skal tagges senere
              </CardDescription>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onOpenChange(false)}
              className="flex-shrink-0 h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4 flex-1 overflow-y-auto">
          {/* Upload mode selector */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Opplastingsmodus
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setUploadMode('with-project')}
                className={`p-3 text-sm border rounded-md transition-colors ${
                  uploadMode === 'with-project'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                Med prosjekt
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('without-project')}
                className={`p-3 text-sm border rounded-md transition-colors ${
                  uploadMode === 'without-project'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                Uten prosjekt
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {uploadMode === 'with-project' 
                ? 'Bildene går direkte til prosjekt-innboks'
                : 'Bildene går til global innboks for senere taggning'}
            </p>
          </div>

          {/* Project selector - only show if "with-project" */}
          {uploadMode === 'with-project' && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                Velg prosjekt *
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full p-2 border rounded-md"
                disabled={loadingProjects}
              >
                <option value="">
                  {loadingProjects ? 'Laster prosjekter...' : 'Velg prosjekt...'}
                </option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.project_number} - {project.project_name}
                  </option>
                ))}
              </select>
              {projects.length === 0 && !loadingProjects && (
                <p className="text-xs text-muted-foreground mt-1">
                  Ingen aktive prosjekter funnet
                </p>
              )}
            </div>
          )}

          {/* Comment - only show if "without-project" */}
          {uploadMode === 'without-project' && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                Kommentar *
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Beskriv hva bildene viser..."
                className="w-full p-2 border rounded-md min-h-[80px] resize-none"
              />
            </div>
          )}

          {/* File upload area */}
          <div
            className={`border-2 border-dashed rounded-lg p-4 sm:p-8 text-center ${
              dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-4 text-gray-400" />
            <p className="text-xs sm:text-sm text-gray-600 mb-2">
              Dra bilder hit eller
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto"
            >
              <ImageIcon className="h-4 w-4 mr-2" />
              Velg bilder
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              capture="environment"
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />
            <p className="text-xs text-gray-500 mt-2">
              Maksimal filstørrelse: 5MB per bilde
            </p>
          </div>

          {/* Selected files */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Valgte bilder ({selectedFiles.length})
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm truncate">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={uploading}
              className="w-full sm:w-auto"
            >
              Avbryt
            </Button>
            <Button
              onClick={handleUpload}
              disabled={
                (uploadMode === 'with-project' && !selectedProject) ||
                (uploadMode === 'without-project' && !comment.trim()) ||
                selectedFiles.length === 0 ||
                uploading
              }
              className="w-full sm:w-auto"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Laster opp...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Last opp ({selectedFiles.length})
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

