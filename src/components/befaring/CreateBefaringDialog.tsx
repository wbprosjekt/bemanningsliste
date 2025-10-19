'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CreateBefaringDialogProps {
  orgId: string;
  userId: string;
  onSuccess: () => void;
  variant?: 'header' | 'fab' | 'inline';
}

interface BefaringFormData {
  title: string;
  description: string;
  adresse: string;
  postnummer: string;
  sted: string;
  befaring_date: Date | null;
  befaring_type: string;
  tripletex_project_id: number | null;
}

interface TripletexProject {
  id: string;
  tripletex_project_id: number;
  project_name: string;
  project_number: number;
  customer_name: string | null;
}

const BEFARING_TYPES = [
  { value: 'forbefaring', label: 'Forbefaring' },
  { value: 'ferdigbefaring', label: 'Ferdigbefaring' },
  { value: 'kvalitetskontroll', label: 'Kvalitetskontroll' },
  { value: 'sikkerhetsbefaring', label: 'Sikkerhetsbefaring' },
  { value: 'vedlikeholdsbefaring', label: 'Vedlikeholdsbefaring' },
  { value: 'annet', label: 'Annet' },
];

export default function CreateBefaringDialog({ orgId, userId, onSuccess, variant = 'fab' }: CreateBefaringDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<TripletexProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState<BefaringFormData>({
    title: '',
    description: '',
    adresse: '',
    postnummer: '',
    sted: '',
    befaring_date: new Date(),
    befaring_type: 'forbefaring',
    tripletex_project_id: null,
  });

  const loadTripletexProjects = async () => {
    setProjectsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ttx_project_cache')
        .select('id, tripletex_project_id, project_name, project_number, customer_name')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('project_name');

      if (error) throw error;

      const sanitizedProjects: TripletexProject[] = (data || [])
        .filter((project) => project.tripletex_project_id !== null)
        .map((project) => ({
          id: project.id,
          tripletex_project_id: project.tripletex_project_id as number,
          project_name: project.project_name ?? 'Uten navn',
          project_number: project.project_number ?? 0,
          customer_name: project.customer_name,
        }));

      setProjects(sanitizedProjects);
    } catch (error) {
      console.error('Error loading projects:', error);
      toast({
        title: 'Feil ved lasting',
        description: 'Kunne ikke laste Tripletex-prosjekter.',
        variant: 'destructive',
      });
    } finally {
      setProjectsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.befaring_date || !formData.tripletex_project_id) {
      toast({
        title: 'Mangler påkrevde felt',
        description: 'Tittel, befaring-dato og Tripletex-prosjekt er påkrevd.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
        const { data, error } = await supabase
        .from('befaringer')
        .insert({
          org_id: orgId,
          tripletex_project_id: formData.tripletex_project_id,
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          adresse: formData.adresse.trim() || null,
          postnummer: formData.postnummer.trim() || null,
          sted: formData.sted.trim() || null,
          befaring_date: formData.befaring_date.toISOString().split('T')[0],
          befaring_type: formData.befaring_type,
          status: 'aktiv',
          created_by: userId, // Use userId directly (auth.uid())
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Befaring opprettet',
        description: `"${formData.title}" er nå opprettet.`,
      });

      // Reset form
      setFormData({
        title: '',
        description: '',
        adresse: '',
        postnummer: '',
        sted: '',
        befaring_date: new Date(),
        befaring_type: 'forbefaring',
        tripletex_project_id: null,
      });

      setOpen(false);
      onSuccess();
    } catch (error) {
      console.error('Error creating befaring:', error);
      toast({
        title: 'Feil ved oppretting',
        description: 'Kunne ikke opprette befaring. Prøv igjen.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof BefaringFormData, value: string | Date | number | null) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  // Load projects when dialog opens
  useEffect(() => {
    if (open) {
      loadTripletexProjects();
    }
  }, [open, orgId]);

  // Render different button styles based on variant
  const renderTriggerButton = () => {
    if (variant === 'header') {
      return (
        <Button 
          size="lg"
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 
                     shadow-lg hover:shadow-xl transition-all whitespace-nowrap"
        >
          <Plus className="h-5 w-5 mr-2" />
          Ny befaring
        </Button>
      );
    }
    
    if (variant === 'inline') {
      return (
        <Button 
          size="lg"
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
        >
          <Plus className="h-5 w-5 mr-2" />
          Opprett din første befaring
        </Button>
      );
    }
    
    // Default FAB variant
    return (
      <Button className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-xl 
                         bg-gradient-to-r from-blue-600 to-blue-700 
                         hover:scale-110 active:scale-95 transition-transform duration-200">
        <Plus className="h-6 w-6" />
      </Button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {renderTriggerButton()}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Opprett ny befaring</DialogTitle>
          <DialogDescription>
            Fyll ut informasjonen for den nye befaringen.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tripletex-prosjekt */}
          <div className="space-y-2">
            <Label htmlFor="tripletex_project">Tripletex-prosjekt *</Label>
            <Select
              value={formData.tripletex_project_id?.toString() || ''}
              onValueChange={(value) => handleInputChange('tripletex_project_id', value ? parseInt(value) : null)}
            >
              <SelectTrigger>
                <SelectValue placeholder={projectsLoading ? "Laster prosjekter..." : "Velg prosjekt"} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.tripletex_project_id.toString()}>
                    <div className="flex flex-col">
                      <span className="font-medium">{project.project_name}</span>
                      <span className="text-xs text-gray-500">
                        #{project.tripletex_project_id} • {project.customer_name || 'Ingen kunde'}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Befaring-type */}
          <div className="space-y-2">
            <Label htmlFor="befaring_type">Befaring-type</Label>
            <Select
              value={formData.befaring_type}
              onValueChange={(value) => handleInputChange('befaring_type', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Velg type" />
              </SelectTrigger>
              <SelectContent>
                {BEFARING_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tittel */}
          <div className="space-y-2">
            <Label htmlFor="title">Tittel *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="f.eks. Befaring av kontorbygg - Etasje 2"
              required
            />
          </div>

          {/* Beskrivelse */}
          <div className="space-y-2">
            <Label htmlFor="description">Beskrivelse</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Kort beskrivelse av befaringen..."
              rows={3}
            />
          </div>

          {/* Adresse */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="adresse">Adresse</Label>
              <Input
                id="adresse"
                value={formData.adresse}
                onChange={(e) => handleInputChange('adresse', e.target.value)}
                placeholder="f.eks. Storgata 123"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postnummer">Postnummer</Label>
              <Input
                id="postnummer"
                value={formData.postnummer}
                onChange={(e) => handleInputChange('postnummer', e.target.value)}
                placeholder="0000"
                maxLength={4}
              />
            </div>
          </div>

          {/* Sted */}
          <div className="space-y-2">
            <Label htmlFor="sted">Sted</Label>
            <Input
              id="sted"
              value={formData.sted}
              onChange={(e) => handleInputChange('sted', e.target.value)}
              placeholder="f.eks. Oslo"
            />
          </div>

          {/* Befaring-dato */}
          <div className="space-y-2">
            <Label>Befaring-dato *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.befaring_date ? (
                    formData.befaring_date.toLocaleDateString('no-NO', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  ) : (
                    'Velg dato'
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.befaring_date || undefined}
                  onSelect={(date) => handleInputChange('befaring_date', date ?? null)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Avbryt
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Oppretter...' : 'Opprett befaring'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
