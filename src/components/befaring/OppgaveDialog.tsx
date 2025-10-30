'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';

interface Oppgave {
  id?: string;
  plantegning_id: string;
  oppgave_nummer: number;
  fag: string;
  fag_color: string;
  x_position: number;  // Legacy: 0-100 (prosent)
  y_position: number;  // Legacy: 0-100 (prosent)
  x_normalized?: number;  // Ny: 0-1 (zoom-safe)
  y_normalized?: number;  // Ny: 0-1 (zoom-safe)
  title?: string;
  description?: string;
  status: string;
  prioritet: string;
  frist?: string;
}

interface OppgaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plantegningId: string;
  xPosition: number;
  yPosition: number;
  oppgave?: Oppgave | null;
  onSuccess: () => void;
  befaringId: string;
}

const FAG_OPTIONS = [
  { value: 'maling', label: 'Maling', color: '#ef4444' },
  { value: 'gulv', label: 'Gulv', color: '#f97316' },
  { value: 'elektro', label: 'Elektro', color: '#eab308' },
  { value: 'rør', label: 'Rør', color: '#22c55e' },
  { value: 'ventilasjon', label: 'Ventilasjon', color: '#06b6d4' },
  { value: 'kjøkken', label: 'Kjøkken', color: '#8b5cf6' },
  { value: 'bad', label: 'Bad', color: '#ec4899' },
  { value: 'dør', label: 'Dør/Vinduer', color: '#6b7280' },
  { value: 'annet', label: 'Annet', color: '#6366f1' }
];

const STATUS_OPTIONS = [
  { value: 'apen', label: 'Åpen' },
  { value: 'under_arbeid', label: 'Under arbeid' },
  { value: 'lukket', label: 'Lukket' }
];

const PRIORITET_OPTIONS = [
  { value: 'kritisk', label: 'Kritisk' },
  { value: 'høy', label: 'Høy' },
  { value: 'medium', label: 'Medium' },
  { value: 'lav', label: 'Lav' }
];

export default function OppgaveDialog({
  open,
  onOpenChange,
  plantegningId,
  xPosition,
  yPosition,
  oppgave,
  onSuccess,
  befaringId
}: OppgaveDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fag: '',
    fag_color: '#6366f1',
    title: '',
    description: '',
    status: 'apen',
    prioritet: 'medium',
    frist: null as Date | null
  });
  const { toast } = useToast();

  // Reset form when dialog opens/closes or oppgave changes
  useEffect(() => {
    if (open) {
      if (oppgave) {
        // Edit mode
        setFormData({
          fag: oppgave.fag,
          fag_color: oppgave.fag_color,
          title: oppgave.title || '',
          description: oppgave.description || '',
          status: oppgave.status,
          prioritet: oppgave.prioritet,
          frist: oppgave.frist ? new Date(oppgave.frist) : null
        });
      } else {
        // Create mode
        setFormData({
          fag: '',
          fag_color: '#6366f1',
          title: '',
          description: '',
          status: 'apen',
          prioritet: 'medium',
          frist: null
        });
      }
    }
  }, [open, oppgave]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.fag) {
      toast({
        title: 'Fag påkrevd',
        description: 'Vennligst velg et fag for oppgaven.',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      if (oppgave?.id) {
        // Update existing oppgave
        const { error } = await supabase
          .from('oppgaver')
          .update({
            fag: formData.fag,
            fag_color: formData.fag_color,
            title: formData.title.trim() || null,
            description: formData.description.trim() || null,
            status: formData.status,
            prioritet: formData.prioritet,
            frist: formData.frist ? formData.frist.toISOString().split('T')[0] : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', oppgave.id);

        if (error) throw error;

        toast({
          title: 'Oppgave oppdatert',
          description: 'Oppgaven har blitt oppdatert.'
        });
      } else {
        // Create new oppgave
        // First, get the next oppgave_nummer for this plantegning
        const { data: lastOppgave, error: countError } = await supabase
          .from('oppgaver')
          .select('oppgave_nummer')
          .eq('plantegning_id', plantegningId)
          .order('oppgave_nummer', { ascending: false })
          .limit(1)
          .single();

        const nextNumber = lastOppgave ? lastOppgave.oppgave_nummer + 1 : 1;

        // Get current user profile
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!profile) throw new Error('Profile not found');

        // OPPDATERT: Lagre både normalized (ny) og position (legacy for bakoverkompatibilitet)
        // xPosition og yPosition kommer nå som normalized (0-1) fra InteractivePlantegning
        const { error } = await supabase
          .from('oppgaver')
          .insert({
            plantegning_id: plantegningId,
            oppgave_nummer: nextNumber,
            fag: formData.fag,
            fag_color: formData.fag_color,
            x_position: xPosition * 100,      // Legacy: Konverter til prosent (0-100)
            y_position: yPosition * 100,      // Legacy: Konverter til prosent (0-100)
            x_normalized: xPosition,          // Ny: Normalized (0-1) - zoom-safe!
            y_normalized: yPosition,          // Ny: Normalized (0-1) - zoom-safe!
            title: formData.title.trim() || null,
            description: formData.description.trim() || null,
            status: formData.status,
            prioritet: formData.prioritet,
            frist: formData.frist ? formData.frist.toISOString().split('T')[0] : null,
            created_by: profile.id
          });

        if (error) throw error;

        toast({
          title: 'Oppgave opprettet',
          description: `Oppgave ${nextNumber} har blitt opprettet.`
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving oppgave:', error);
      toast({
        title: 'Feil ved lagring',
        description: error instanceof Error ? error.message : 'En ukjent feil oppstod',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFagChange = (fag: string) => {
    const selectedFag = FAG_OPTIONS.find(f => f.value === fag);
    setFormData(prev => ({
      ...prev,
      fag,
      fag_color: selectedFag?.color || '#6366f1'
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {oppgave ? 'Rediger oppgave' : 'Ny oppgave'}
          </DialogTitle>
          <DialogDescription>
            {oppgave 
              ? 'Oppdater informasjonen for oppgaven.'
              : `Opprett ny oppgave på posisjon (${Math.round(xPosition)}%, ${Math.round(yPosition)}%)`
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 flex-1 overflow-y-auto" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
          {/* Fag */}
          <div className="space-y-2">
            <Label htmlFor="fag">Fag *</Label>
            <Select value={formData.fag} onValueChange={handleFagChange}>
              <SelectTrigger className="min-w-0" >
                <SelectValue placeholder="Velg fag" />
              </SelectTrigger>
              <SelectContent>
                {FAG_OPTIONS.map((fag) => (
                  <SelectItem key={fag.value} value={fag.value}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: fag.color }}
                      ></div>
                      {fag.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tittel */}
          <div className="space-y-2">
            <Label htmlFor="title">Tittel</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Kort beskrivelse av oppgaven"
              className="min-w-0"
            />
          </div>
          {/* Beskrivelse */}
          <div className="space-y-2">
            <Label htmlFor="description">Beskrivelse</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Detaljert beskrivelse av oppgaven..."
              rows={3}
              className="min-w-0"
            />
          </div>
          {/* Status og prioritet */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                <SelectTrigger className="min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prioritet">Prioritet</Label>
              <Select value={formData.prioritet} onValueChange={(value) => setFormData(prev => ({ ...prev, prioritet: value }))}>
                <SelectTrigger className="min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITET_OPTIONS.map((prioritet) => (
                    <SelectItem key={prioritet.value} value={prioritet.value}>
                      {prioritet.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Frist og underleverandør */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="frist">Frist (valgfritt)</Label>
              {/* Din datepicker/fristfelt her ( behold padding etc. ) */}
              {/* Legg className="min-w-0" hvis mulig på input/trigger */}
            </div>
            <div className="space-y-2">
              <Label htmlFor="underleverandor">Underleverandør (valgfritt)</Label>
              <Select
                value={formData.underleverandor}
                onValueChange={(value) => setFormData(prev => ({ ...prev, underleverandor: value }))}
              >
                <SelectTrigger className="min-w-0">
                  <SelectValue placeholder="Velg underleverandør" />
                </SelectTrigger>
                <SelectContent>
                  {/* ...ditt innhold... */}
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Bilder, ekstra spacing nedover */}
          <div className="mb-2">
            {/* Bilderuten/knapper etc. */}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
