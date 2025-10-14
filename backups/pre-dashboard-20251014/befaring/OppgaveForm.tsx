'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Save, X, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import OppgaveImages from './OppgaveImages';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const oppgaveSchema = z.object({
  fag: z.string().min(1, 'Fag er påkrevd.'),
  fag_color: z.string().min(1, 'Fag-farge er påkrevd.'),
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['apen', 'under_arbeid', 'lukket']),
  prioritet: z.enum(['kritisk', 'høy', 'medium', 'lav']),
  frist: z.date().optional(),
  underleverandor_id: z.string().optional(),
});

interface Underleverandor {
  id: string;
  navn: string;
  epost: string;
  fag: string[];
}

interface Oppgave {
  id: string;
  oppgave_nummer: number;
  fag: string;
  fag_color: string;
  x_position: number;
  y_position: number;
  title?: string;
  description?: string;
  status: 'apen' | 'under_arbeid' | 'lukket';
  prioritet: 'kritisk' | 'høy' | 'medium' | 'lav';
  frist?: string;
  underleverandor_id?: string;
}

interface OppgaveFormProps {
  oppgave: Oppgave | null;
  plantegningId: string;
  orgId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const FAG_OPTIONS = [
  { value: 'elektriker', label: 'Elektriker', color: '#fbbf24' },
  { value: 'vvs', label: 'VVS', color: '#3b82f6' },
  { value: 'tømrer', label: 'Tømrer', color: '#8b5cf6' },
  { value: 'maler', label: 'Maler', color: '#10b981' },
  { value: 'rørlegger', label: 'Rørlegger', color: '#06b6d4' },
  { value: 'flislegger', label: 'Flislegger', color: '#f59e0b' },
  { value: 'murer', label: 'Murer', color: '#6b7280' },
  { value: 'glassmester', label: 'Glassmester', color: '#84cc16' },
  { value: 'klima', label: 'Klima', color: '#ec4899' },
  { value: 'ventilasjon', label: 'Ventilasjon', color: '#6366f1' },
  { value: 'annet', label: 'Annet', color: '#94a3b8' },
];

const STATUS_OPTIONS = [
  { value: 'apen', label: 'Åpen' },
  { value: 'under_arbeid', label: 'Under arbeid' },
  { value: 'lukket', label: 'Lukket' },
];

const PRIORITY_OPTIONS = [
  { value: 'lav', label: 'Lav' },
  { value: 'medium', label: 'Medium' },
  { value: 'høy', label: 'Høy' },
  { value: 'kritisk', label: 'Kritisk' },
];

export default function OppgaveForm({
  oppgave,
  plantegningId,
  orgId,
  isOpen,
  onClose,
  onSave,
}: OppgaveFormProps) {
  const [underleverandorer, setUnderleverandorer] = useState<Underleverandor[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof oppgaveSchema>>({
    resolver: zodResolver(oppgaveSchema),
    defaultValues: {
      fag: '',
      fag_color: '',
      title: '',
      description: '',
      status: 'apen',
      prioritet: 'medium',
      frist: undefined,
      underleverandor_id: '',
    },
  });

  // Load underleverandorer when component mounts
  useEffect(() => {
    const loadUnderleverandorer = async () => {
      try {
        const { data, error } = await supabase
          .from('underleverandorer')
          .select('id, navn, epost')
          .eq('org_id', orgId)
          .order('navn');

        if (error) throw error;
        setUnderleverandorer(data || []);
      } catch (error) {
        console.error('Error loading underleverandorer:', error);
      }
    };

    if (isOpen) {
      loadUnderleverandorer();
    }
  }, [isOpen, orgId]);

  // Update form when oppgave changes
  useEffect(() => {
    if (oppgave) {
      form.reset({
        fag: oppgave.fag,
        fag_color: oppgave.fag_color,
        title: oppgave.title || '',
        description: oppgave.description || '',
        status: oppgave.status,
        prioritet: oppgave.prioritet,
        frist: oppgave.frist ? new Date(oppgave.frist) : undefined,
        underleverandor_id: oppgave.underleverandor_id || '',
      });
    } else {
      form.reset({
        fag: '',
        fag_color: '',
        title: '',
        description: '',
        status: 'apen',
        prioritet: 'medium',
        frist: undefined,
        underleverandor_id: '',
      });
    }
  }, [oppgave, form]);

  const onSubmit = async (values: z.infer<typeof oppgaveSchema>) => {
    setLoading(true);
    try {
      if (oppgave) {
        // Update existing oppgave
        const { error } = await supabase
          .from('oppgaver')
          .update({
            fag: values.fag,
            fag_color: values.fag_color,
            title: values.title || null,
            description: values.description || null,
            status: values.status,
            prioritet: values.prioritet,
            frist: values.frist ? values.frist.toISOString().split('T')[0] : null,
            underleverandor_id: values.underleverandor_id || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', oppgave.id);

        if (error) throw error;

        toast({
          title: 'Oppgave oppdatert',
          description: 'Oppgaven ble lagret.',
        });
      } else {
        // Create new oppgave
        // First, get the next oppgave number for this plantegning
        const { data: maxNumData, error: maxNumError } = await supabase
          .from('oppgaver')
          .select('oppgave_nummer')
          .eq('plantegning_id', plantegningId)
          .order('oppgave_nummer', { ascending: false })
          .limit(1);

        if (maxNumError) throw maxNumError;

        const nextNummer = maxNumData && maxNumData.length > 0 ? maxNumData[0].oppgave_nummer + 1 : 1;

        const { error } = await supabase
          .from('oppgaver')
          .insert({
            plantegning_id,
            oppgave_nummer: nextNummer,
            fag: values.fag,
            fag_color: values.fag_color,
            x_position: 50, // Default position, will be updated when placed on plantegning
            y_position: 50,
            title: values.title || null,
            description: values.description || null,
            status: values.status,
            prioritet: values.prioritet,
            frist: values.frist ? values.frist.toISOString().split('T')[0] : null,
            underleverandor_id: values.underleverandor_id || null,
          });

        if (error) throw error;

        toast({
          title: 'Oppgave opprettet',
          description: 'Oppgaven ble opprettet.',
        });
      }

      onSave();
      onClose();
    } catch (error: any) {
      console.error('Error saving oppgave:', error);
      toast({
        title: 'Feil',
        description: `Kunne ikke lagre oppgave: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFagChange = (fagValue: string) => {
    const fagOption = FAG_OPTIONS.find(option => option.value === fagValue);
    if (fagOption) {
      form.setValue('fag', fagValue);
      form.setValue('fag_color', fagOption.color);
    }
  };

  const handleDelete = async () => {
    if (!oppgave) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('oppgaver')
        .delete()
        .eq('id', oppgave.id);

      if (error) throw error;

      toast({
        title: 'Oppgave slettet',
        description: 'Oppgaven ble slettet.',
      });

      onSave(); // Refresh the data
      onClose();
      setShowDeleteDialog(false);
    } catch (error: any) {
      console.error('Error deleting oppgave:', error);
      toast({
        title: 'Feil',
        description: `Kunne ikke slette oppgave: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {oppgave ? `Rediger oppgave #${oppgave.oppgave_nummer}` : 'Ny oppgave'}
          </DialogTitle>
          <DialogDescription>
            {oppgave ? 'Endre detaljer for oppgaven.' : 'Fyll ut detaljene for den nye oppgaven.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Fag */}
            <FormField
              control={form.control}
              name="fag"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fag *</FormLabel>
                  <Select onValueChange={handleFagChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Velg fag" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {FAG_OPTIONS.map((fag) => (
                        <SelectItem key={fag.value} value={fag.value}>
                          <div className="flex items-center space-x-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: fag.color }}
                            />
                            <span>{fag.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tittel */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tittel (valgfritt)</FormLabel>
                  <FormControl>
                    <Input placeholder="F.eks. Manglende stikk i stue" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Beskrivelse */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beskrivelse (valgfritt)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Detaljert beskrivelse av oppgaven..."
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              {/* Status */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Prioritet */}
              <FormField
                control={form.control}
                name="prioritet"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioritet</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((priority) => (
                          <SelectItem key={priority.value} value={priority.value}>
                            {priority.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Frist */}
            <FormField
              control={form.control}
              name="frist"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Frist (valgfritt)</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={'outline'}
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            field.value.toLocaleDateString('no-NO')
                          ) : (
                            <span>Velg frist</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date < new Date() || date < new Date('1900-01-01')
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Underleverandør */}
            <FormField
              control={form.control}
              name="underleverandor_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Underleverandør (valgfritt)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Velg underleverandør" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {underleverandorer.map((ul) => (
                        <SelectItem key={ul.id} value={ul.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{ul.navn}</span>
                            <span className="text-xs text-gray-500">{ul.epost}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Oppgave Images - Only show if oppgave exists */}
            {oppgave && (
              <div className="space-y-2">
                <OppgaveImages 
                  oppgaveId={oppgave.id} 
                  orgId={orgId}
                  canUpload={true}
                />
              </div>
            )}

            <DialogFooter className="flex justify-between items-center">
              <div className="flex-1">
                {oppgave && (
                  <Button 
                    type="button" 
                    variant="destructive" 
                    onClick={() => setShowDeleteDialog(true)}
                    className="mr-auto"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Slett oppgave
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  <X className="h-4 w-4 mr-2" />
                  Avbryt
                </Button>
                <Button type="submit" disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Lagrer...' : 'Lagre'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil permanent slette oppgave #{oppgave?.oppgave_nummer}.
              Denne handlingen kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? 'Sletter...' : 'Slett oppgave'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
