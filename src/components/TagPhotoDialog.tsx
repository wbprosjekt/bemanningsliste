'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface TagPhotoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photo: {
    id: string;
    image_url: string;
    prosjekt_id: string | null;
    comment: string | null;
  };
  orgId: string;
  photoIds?: string[]; // For bulk tagging
  onSuccess?: () => void;
}

interface Befaring {
  id: string;
  title: string;
  befaring_date: string;
  tripletex_project_id: number | null;
}

interface Oppgave {
  id: string;
  oppgave_nummer: number;
  fag: string | null;
  beskrivelse: string | null;
  befaring_id: string;
}

export default function TagPhotoDialog({
  open,
  onOpenChange,
  photo,
  orgId,
  photoIds = [],
  onSuccess
}: TagPhotoDialogProps) {
  const [tagType, setTagType] = useState<'project' | 'befaring' | 'oppgave' | 'general'>('project');
  const [selectedBefaring, setSelectedBefaring] = useState<string>('');
  const [selectedOppgave, setSelectedOppgave] = useState<string>('');
  const [befaringer, setBefaringer] = useState<Befaring[]>([]);
  const [oppgaver, setOppgaver] = useState<Oppgave[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingBefaringer, setLoadingBefaringer] = useState(false);
  const [loadingOppgaver, setLoadingOppgaver] = useState(false);
  const { toast } = useToast();
  
  const isBulkTagging = photoIds.length > 0;

  // Load befaringer when dialog opens
  useEffect(() => {
    if (open && photo.prosjekt_id) {
      loadBefaringer();
    }
  }, [open, photo.prosjekt_id]);

  // Load oppgaver when befaring is selected
  useEffect(() => {
    if (selectedBefaring) {
      loadOppgaver();
    } else {
      setOppgaver([]);
    }
  }, [selectedBefaring]);

  const loadBefaringer = async () => {
    if (!photo.prosjekt_id) return;
    
    setLoadingBefaringer(true);
    try {
      const { data, error } = await supabase
        .from('befaringer')
        .select('id, title, befaring_date, tripletex_project_id')
        .eq('org_id', orgId)
        .eq('tripletex_project_id', photo.prosjekt_id)
        .order('befaring_date', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      setBefaringer(data || []);
    } catch (error: any) {
      console.error('Error loading befaringer:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke laste befaringer',
        variant: 'destructive'
      });
    } finally {
      setLoadingBefaringer(false);
    }
  };

  const loadOppgaver = async () => {
    if (!selectedBefaring) return;
    
    setLoadingOppgaver(true);
    try {
      const { data, error } = await supabase
        .from('oppgaver')
        .select('id, oppgave_nummer, fag, beskrivelse, befaring_id')
        .eq('befaring_id', selectedBefaring)
        .order('oppgave_nummer', { ascending: true });
      
      if (error) throw error;
      
      setOppgaver(data || []);
    } catch (error: any) {
      console.error('Error loading oppgaver:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke laste oppgaver',
        variant: 'destructive'
      });
    } finally {
      setLoadingOppgaver(false);
    }
  };

  const handleTag = async () => {
    setLoading(true);

    try {
      const updates: any = {
        is_tagged: true
      };

      if (tagType === 'project') {
        // Behold som generelt prosjekt-bilde (prosjekt_id er allerede satt)
        updates.is_tagged = true;
      } else if (tagType === 'befaring' && selectedBefaring) {
        updates.befaring_id = selectedBefaring;
      } else if (tagType === 'oppgave' && selectedOppgave) {
        updates.oppgave_id = selectedOppgave;
      } else if (tagType === 'general') {
        // Behold som generelt bilde uten prosjekt
        updates.is_tagged = true;
      }

      // Tag single photo or bulk
      const idsToUpdate = isBulkTagging ? photoIds : [photo.id];
      
      const { error } = await supabase
        .from('oppgave_bilder')
        .update(updates)
        .in('id', idsToUpdate);

      if (error) throw error;

      toast({
        title: isBulkTagging ? 'Bilder tagget' : 'Bilde tagget',
        description: isBulkTagging 
          ? `${photoIds.length} bilder er nå knyttet til riktig sted`
          : 'Bildet er nå knyttet til riktig sted',
      });

      onSuccess?.();
      onOpenChange(false);
      
      // Reset
      setTagType('project');
      setSelectedBefaring('');
      setSelectedOppgave('');

    } catch (error: any) {
      console.error('Error tagging photo:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke tagge bilde(r)',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isBulkTagging ? `Tagge ${photoIds.length} bilder` : 'Tagge bilde'}
          </DialogTitle>
          <DialogDescription>
            {isBulkTagging 
              ? 'Velg hvor disse bildene tilhører'
              : 'Velg hvor dette bildet tilhører'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isBulkTagging && (
            <div className="flex justify-center">
              <img
                src={photo.image_url}
                alt="Photo to tag"
                className="max-h-64 rounded-lg"
              />
            </div>
          )}
          
          {isBulkTagging && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-900">
                Du tagger {photoIds.length} bilder samtidig
              </p>
            </div>
          )}

          <div>
            <Label>Hvor tilhører bildet?</Label>
            <RadioGroup value={tagType} onValueChange={(v: any) => setTagType(v)} className="mt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="project" id="project" />
                <Label htmlFor="project" className="cursor-pointer">Generelt prosjekt-bilde</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="befaring" id="befaring" />
                <Label htmlFor="befaring" className="cursor-pointer">Befaring</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="oppgave" id="oppgave" />
                <Label htmlFor="oppgave" className="cursor-pointer">Oppgave</Label>
              </div>
            </RadioGroup>
          </div>

          {tagType === 'befaring' && (
            <div>
              <Label htmlFor="befaring-select">Velg befaring</Label>
              <Select
                value={selectedBefaring}
                onValueChange={setSelectedBefaring}
                disabled={loadingBefaringer}
              >
                <SelectTrigger id="befaring-select" className="mt-1">
                  <SelectValue placeholder={loadingBefaringer ? "Laster befaringer..." : "Velg befaring..."} />
                </SelectTrigger>
                <SelectContent>
                  {befaringer.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.title} - {new Date(b.befaring_date).toLocaleDateString('no-NO')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {befaringer.length === 0 && !loadingBefaringer && (
                <p className="text-xs text-muted-foreground mt-1">
                  Ingen befaringer funnet for dette prosjektet
                </p>
              )}
            </div>
          )}

          {tagType === 'oppgave' && (
            <div>
              <Label htmlFor="oppgave-select">Velg oppgave</Label>
              <Select
                value={selectedOppgave}
                onValueChange={setSelectedOppgave}
                disabled={loadingOppgaver || !selectedBefaring}
              >
                <SelectTrigger id="oppgave-select" className="mt-1">
                  <SelectValue placeholder={
                    !selectedBefaring 
                      ? "Velg befaring først..." 
                      : loadingOppgaver 
                      ? "Laster oppgaver..." 
                      : "Velg oppgave..."
                  } />
                </SelectTrigger>
                <SelectContent>
                  {oppgaver.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      #{o.oppgave_nummer} - {o.fag || 'Uten fag'} - {o.beskrivelse || 'Uten beskrivelse'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {oppgaver.length === 0 && !loadingOppgaver && selectedBefaring && (
                <p className="text-xs text-muted-foreground mt-1">
                  Ingen oppgaver funnet for denne befaringen
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Avbryt
          </Button>
          <Button 
            onClick={handleTag} 
            disabled={
              loading || 
              (tagType === 'project' && !photo.prosjekt_id) ||
              (tagType === 'befaring' && !selectedBefaring) ||
              (tagType === 'oppgave' && !selectedOppgave)
            }
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Lagrer...
              </>
            ) : (
              isBulkTagging ? `Tagge ${photoIds.length} bilder` : 'Tagge bilde'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

