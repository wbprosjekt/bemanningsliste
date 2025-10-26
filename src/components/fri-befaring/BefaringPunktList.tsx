'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Plus,
  Edit,
  Trash2,
  CheckSquare,
  AlertCircle,
  Clock,
  Image as ImageIcon,
  FileText,
  Calendar,
  User,
  Save,
  X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import BefaringPunktImages from './BefaringPunktImages';
import BefaringPunktImageThumbnails from './BefaringPunktImageThumbnails';

interface BefaringPunkt {
  id: string;
  punkt_nummer: number;
  title: string;
  description: string | null;
  status: 'aktiv' | 'lukket';
  fag: string | null;
  prioritet: 'kritisk' | 'høy' | 'medium' | 'lav';
  frist: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface BefaringPunktListProps {
  befaringId: string;
  onStatsUpdate: () => void;
  canEdit: boolean;
  orgId: string;
  userId: string;
}

export default function BefaringPunktList({ befaringId, onStatsUpdate, canEdit, orgId, userId }: BefaringPunktListProps) {
  const { toast } = useToast();
  const [punkter, setPunkter] = useState<BefaringPunkt[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPunkt, setEditingPunkt] = useState<BefaringPunkt | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    title: '',
    description: '',
    fag: '',
    prioritet: 'medium' as 'kritisk' | 'høy' | 'medium' | 'lav',
    frist: ''
  });
  const [pendingImages, setPendingImages] = useState<File[]>([]);

  useEffect(() => {
    loadPunkter();
  }, [befaringId]);

  const loadPunkter = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('befaring_punkter' as any)
        .select('*')
        .eq('fri_befaring_id', befaringId)
        .order('punkt_nummer', { ascending: true });

      if (error) throw error;
      setPunkter((data as unknown as BefaringPunkt[]) || []);
    } catch (error) {
      console.error('Error loading punkter:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke laste befaringspunkter',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePunkt = async () => {
    try {
      const nextNummer = Math.max(0, ...punkter.map(p => p.punkt_nummer)) + 1;
      
      const { data, error } = await supabase
        .from('befaring_punkter' as any)
        .insert({
          fri_befaring_id: befaringId,
          punkt_nummer: nextNummer,
          title: editData.title,
          description: editData.description || null,
          fag: editData.fag || null,
          prioritet: editData.prioritet,
          frist: editData.frist || null,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) throw error;

      // Upload pending images if any
      if (pendingImages.length > 0) {
        await uploadPendingImages((data as any).id);
      }

      setPunkter(prev => [...prev, data as unknown as BefaringPunkt]);
      onStatsUpdate();
      setIsDialogOpen(false);
      resetForm();
      
      toast({
        title: 'Suksess',
        description: 'Befaringspunkt opprettet',
      });
    } catch (error) {
      console.error('Error creating punkt:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke opprette befaringspunkt',
        variant: 'destructive',
      });
    }
  };

  const handleUpdatePunkt = async () => {
    if (!editingPunkt) return;

    try {
      const { error } = await supabase
        .from('befaring_punkter' as any)
        .update({
          title: editData.title,
          description: editData.description || null,
          fag: editData.fag || null,
          prioritet: editData.prioritet,
          frist: editData.frist || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingPunkt.id);

      if (error) throw error;

      setPunkter(prev => prev.map(p => 
        p.id === editingPunkt.id 
          ? { ...p, ...editData, frist: editData.frist || null }
          : p
      ));

      setIsEditing(false);
      setEditingPunkt(null);
      resetForm();
      
      toast({
        title: 'Suksess',
        description: 'Befaringspunkt oppdatert',
      });
    } catch (error) {
      console.error('Error updating punkt:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke oppdatere befaringspunkt',
        variant: 'destructive',
      });
    }
  };

  const handleDeletePunkt = async (punktId: string) => {
    if (!confirm('Er du sikker på at du vil slette dette befaringspunktet?')) return;

    try {
      const { error } = await supabase
        .from('befaring_punkter' as any)
        .delete()
        .eq('id', punktId);

      if (error) throw error;

      setPunkter(prev => prev.filter(p => p.id !== punktId));
      onStatsUpdate();
      
      toast({
        title: 'Suksess',
        description: 'Befaringspunkt slettet',
      });
    } catch (error) {
      console.error('Error deleting punkt:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke slette befaringspunkt',
        variant: 'destructive',
      });
    }
  };

  const uploadPendingImages = async (punktId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    for (const file of pendingImages) {
      try {
        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `befaring-images/${orgId}/${fileName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('befaring-assets')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('befaring-assets')
          .getPublicUrl(filePath);

        // Insert into database
        await supabase
          .from('oppgave_bilder' as any)
          .insert({
            image_url: urlData.publicUrl,
            befaring_punkt_id: punktId,
            image_source: 'punkt',
            uploaded_by: user.id,
            uploaded_by_email: user.email,
            image_type: 'standard'
          });

      } catch (error) {
        console.error('Error uploading pending image:', error);
        toast({
          title: 'Feil ved bildeopplasting',
          description: 'Kunne ikke laste opp alle bilder',
          variant: 'destructive',
        });
      }
    }
  };

  const resetForm = () => {
    setEditData({
      title: '',
      description: '',
      fag: '',
      prioritet: 'medium',
      frist: ''
    });
    setPendingImages([]);
  };

  const startEdit = (punkt: BefaringPunkt) => {
    setEditingPunkt(punkt);
    setEditData({
      title: punkt.title,
      description: punkt.description || '',
      fag: punkt.fag || '',
      prioritet: punkt.prioritet,
      frist: punkt.frist || ''
    });
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditingPunkt(null);
    resetForm();
  };

  const getPrioritetColor = (prioritet: string) => {
    switch (prioritet) {
      case 'kritisk': return 'bg-red-100 text-red-800';
      case 'høy': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'lav': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aktiv': return 'bg-green-100 text-green-800';
      case 'lukket': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Befaringspunkter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center space-x-2 min-w-0">
            <CheckSquare className="h-5 w-5 flex-shrink-0" />
            <span className="truncate">Befaringspunkter ({punkter.length})</span>
          </CardTitle>
          {canEdit && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="flex-shrink-0">
                  <Plus className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="hidden sm:inline">Legg til punkt</span>
                  <span className="sm:hidden">Legg til</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Nytt befaringspunkt</DialogTitle>
                  <DialogDescription>
                    Legg til et nytt punkt i befaringsrapporten
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Tittel *</label>
                    <Input
                      value={editData.title}
                      onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="F.eks. Elektrisk installasjon"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Beskrivelse</label>
                    <Textarea
                      value={editData.description}
                      onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Beskrivelse av punktet..."
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Fag</label>
                      <Input
                        value={editData.fag}
                        onChange={(e) => setEditData(prev => ({ ...prev, fag: e.target.value }))}
                        placeholder="F.eks. Elektro"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Prioritet</label>
                      <Select
                        value={editData.prioritet}
                        onValueChange={(value: 'kritisk' | 'høy' | 'medium' | 'lav') => 
                          setEditData(prev => ({ ...prev, prioritet: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kritisk">Kritisk</SelectItem>
                          <SelectItem value="høy">Høy</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="lav">Lav</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Frist</label>
                    <Input
                      type="date"
                      value={editData.frist}
                      onChange={(e) => setEditData(prev => ({ ...prev, frist: e.target.value }))}
                    />
                  </div>

                  {/* Foto-seksjon */}
                  <div className="border-t pt-4">
                    <BefaringPunktImages
                      befaringPunktId={null}
                      orgId={orgId}
                      canUpload={true}
                      compact={true}
                      onImagesChange={setPendingImages}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Avbryt
                  </Button>
                  <Button 
                    onClick={handleCreatePunkt}
                    disabled={!editData.title.trim()}
                  >
                    Opprett punkt
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {punkter.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CheckSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>Ingen befaringspunkter ennå</p>
            <p className="text-sm">Klikk "Legg til punkt" for å komme i gang</p>
          </div>
        ) : (
          <div className="space-y-4">
            {punkter.map((punkt) => (
              <Card key={punkt.id} className="border-l-4 border-l-blue-500">
                <CardContent className="p-4">
                  {isEditing && editingPunkt?.id === punkt.id ? (
                    // Edit mode
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">Tittel *</label>
                        <Input
                          value={editData.title}
                          onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Beskrivelse</label>
                        <Textarea
                          value={editData.description}
                          onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                          rows={2}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium">Fag</label>
                          <Input
                            value={editData.fag}
                            onChange={(e) => setEditData(prev => ({ ...prev, fag: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Prioritet</label>
                          <Select
                            value={editData.prioritet}
                            onValueChange={(value: 'kritisk' | 'høy' | 'medium' | 'lav') => 
                              setEditData(prev => ({ ...prev, prioritet: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="kritisk">Kritisk</SelectItem>
                              <SelectItem value="høy">Høy</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="lav">Lav</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Frist</label>
                        <Input
                          type="date"
                          value={editData.frist}
                          onChange={(e) => setEditData(prev => ({ ...prev, frist: e.target.value }))}
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={cancelEdit}>
                          <X className="h-4 w-4 mr-2" />
                          Avbryt
                        </Button>
                        <Button onClick={handleUpdatePunkt}>
                          <Save className="h-4 w-4 mr-2" />
                          Lagre
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-semibold text-lg">
                              {punkt.punkt_nummer}. {punkt.title}
                            </h3>
                            <Badge className={getPrioritetColor(punkt.prioritet)}>
                              {punkt.prioritet}
                            </Badge>
                            <Badge className={getStatusColor(punkt.status)}>
                              {punkt.status}
                            </Badge>
                          </div>
                          {punkt.description && (
                            <p className="text-gray-600 mb-2">{punkt.description}</p>
                          )}
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            {punkt.fag && (
                              <span className="flex items-center space-x-1">
                                <FileText className="h-4 w-4" />
                                <span>{punkt.fag}</span>
                              </span>
                            )}
                            {punkt.frist && (
                              <span className="flex items-center space-x-1">
                                <Calendar className="h-4 w-4" />
                                <span>Frist: {new Date(punkt.frist).toLocaleDateString('no-NO')}</span>
                              </span>
                            )}
                            <span className="flex items-center space-x-1">
                              <User className="h-4 w-4" />
                              <span>Opprettet: {new Date(punkt.created_at).toLocaleDateString('no-NO')}</span>
                            </span>
                          </div>
                        </div>
                        {canEdit && (
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startEdit(punkt)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeletePunkt(punkt.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Images Section - Compact Thumbnails */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <ImageIcon className="h-4 w-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">Bilder</span>
                      </div>
                    </div>
                    <div className="min-h-[60px] flex items-center">
                      <BefaringPunktImageThumbnails
                        befaringPunktId={punkt.id}
                        orgId={orgId}
                        canUpload={canEdit}
                        onImageCountChange={() => onStatsUpdate()}
                        maxThumbnails={6}
                        showUploadButton={canEdit}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
