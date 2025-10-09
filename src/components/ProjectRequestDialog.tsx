import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Send } from 'lucide-react';

interface ProjectRequestDialogProps {
  date: Date;
  orgId: string;
  personId: string;
  onRequestSent?: () => void;
}

const ProjectRequestDialog = ({ date, orgId, personId, onRequestSent }: ProjectRequestDialogProps) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [preferredHours, setPreferredHours] = useState('8');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleRequestProject = async () => {
    if (!message.trim()) {
      toast({
        title: "Melding påkrevd",
        description: "Vennligst skriv en melding om hvilket prosjekt du trenger.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Create a project request comment/note in the system
      // This could be implemented as a separate table or notification system
      
      // For now, we'll create a placeholder vakt that admin can see and assign project to
      const { data: vakt, error: vaktError } = await supabase
        .from('vakt')
        .insert({
          person_id: personId,
          org_id: orgId,
          dato: date.toISOString().split('T')[0],
          beskrivelse: `PROSJEKTFORESPØRSEL: ${message}`,
          timer: parseFloat(preferredHours) || 8
        })
        .select()
        .single();

      if (vaktError) throw vaktError;

      // Add a comment to track the request
      await supabase
        .from('vakt_kommentar')
        .insert({
          vakt_id: vakt.id,
          org_id: orgId,
          kommentar: `Prosjektforespørsel fra ansatt: ${message}. Ønsket antall timer: ${preferredHours}`,
          created_by: personId
        });

      toast({
        title: "Forespørsel sendt",
        description: "Prosjektforespørselen er sendt til administrator."
      });

      setOpen(false);
      setMessage('');
      setPreferredHours('8');
      onRequestSent?.();
    } catch (error: unknown) {
      toast({
        title: "Feil ved sending",
        description: error instanceof Error ? error.message : 'En ukjent feil oppstod',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <Plus className="h-3 w-3 mr-1" />
          Be om prosjekt
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Be om prosjekttilordning - {date.toLocaleDateString('no-NO')}
          </DialogTitle>
          <DialogDescription>
            Send en forespørsel til administrator om å få tilordnet et prosjekt
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Badge variant="outline" className="mb-2">
              {date.toLocaleDateString('no-NO', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long' 
              })}
            </Badge>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Ønsket antall timer
            </label>
            <Input
              type="number"
              value={preferredHours}
              onChange={(e) => setPreferredHours(e.target.value)}
              min="0"
              max="24"
              step="0.5"
              className="w-full"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Melding til administrator
            </label>
            <Textarea
              placeholder="Beskriv hvilket type prosjekt du ønsker å jobbe på, eller annen relevant informasjon..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full"
            />
          </div>

          <div className="bg-muted/50 p-3 rounded text-sm">
            <p><strong>Hva skjer videre?</strong></p>
            <p>Din forespørsel sendes til administrator som kan tilordne et passende prosjekt til denne dagen.</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={handleRequestProject} disabled={loading}>
              <Send className="h-4 w-4 mr-1" />
              Send forespørsel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectRequestDialog;