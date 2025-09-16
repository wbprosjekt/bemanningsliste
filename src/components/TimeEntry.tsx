import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Clock, MessageSquare, Paperclip, ChevronUp, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatTimeValue, parseTimeValue, validateTimeStep } from '@/lib/displayNames';

interface TimeEntryProps {
  vaktId: string;
  orgId: string;
  onSave?: () => void;
  defaultTimer?: number;
  existingEntry?: any;
}

interface Activity {
  id: string;
  navn: string;
}

const TimeEntry = ({ vaktId, orgId, onSave, defaultTimer = 8.0, existingEntry }: TimeEntryProps) => {
  const [hours, setHours] = useState(Math.floor(existingEntry?.timer || defaultTimer));
  const [minutes, setMinutes] = useState(Math.round(((existingEntry?.timer || defaultTimer) % 1) * 60));
  const [aktivitetId, setAktivitetId] = useState(existingEntry?.aktivitet_id || '');
  const [notat, setNotat] = useState(existingEntry?.notat || '');
  const [status, setStatus] = useState(existingEntry?.status || 'utkast');
  const [lonnstype, setLonnstype] = useState(existingEntry?.lonnstype || 'normal');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Calculate total timer value from hours and minutes
  const timer = hours + (minutes / 60);

  useEffect(() => {
    loadActivities();
  }, [orgId]);

  const loadActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('ttx_activity_cache')
        .select('id, navn')
        .eq('org_id', orgId)
        .eq('aktiv', true)
        .order('navn');

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error loading activities:', error);
    }
  };

  const adjustHours = (delta: number) => {
    const newHours = Math.max(0, Math.min(8, hours + delta));
    setHours(newHours);
  };

  const adjustMinutes = (delta: number) => {
    const newMinutes = Math.max(0, Math.min(45, minutes + delta));
    // Ensure minutes are in 15-minute intervals
    const roundedMinutes = Math.round(newMinutes / 15) * 15;
    setMinutes(roundedMinutes);
  };

  const handleTimeInputChange = (value: string) => {
    const parsed = parseTimeValue(value);
    const newHours = Math.floor(parsed);
    const newMinutes = Math.round((parsed % 1) * 60);
    setHours(Math.max(0, Math.min(8, newHours)));
    setMinutes(Math.max(0, Math.min(45, Math.round(newMinutes / 15) * 15)));
  };

  const handleSave = async () => {
    if (!aktivitetId) {
      toast({
        title: "Aktivitet påkrevd",
        description: "Du må velge en aktivitet før du kan lagre.",
        variant: "destructive"
      });
      return;
    }

    if (!validateTimeStep(timer)) {
      toast({
        title: "Ugyldig tidsverdi",
        description: "Timer må være i 0,25-steg (f.eks. 7,25, 7,50, 7,75, 8,00).",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const data = {
        vakt_id: vaktId,
        org_id: orgId,
        timer,
        aktivitet_id: aktivitetId,
        notat: notat || null,
        status,
        lonnstype
      };

      let result;
      if (existingEntry) {
        result = await supabase
          .from('vakt_timer')
          .update(data)
          .eq('id', existingEntry.id);
      } else {
        result = await supabase
          .from('vakt_timer')
          .insert(data);
      }

      if (result.error) throw result.error;

      toast({
        title: "Lagret",
        description: "Timeføringen er lagret."
      });

      onSave?.();
    } catch (error: any) {
      toast({
        title: "Lagring feilet",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'godkjent':
        return <Badge className="bg-green-500">🟢 Godkjent</Badge>;
      case 'sendt':
        return <Badge className="bg-blue-500">🔵 Sendt</Badge>;
      default:
        return <Badge variant="outline">📝 Utkast</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Timeføring
          </span>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <Label>Timer</Label>
          <div className="flex items-center justify-center gap-6 p-4 border rounded-lg bg-muted/20">
            {/* Hours Section */}
            <div className="flex flex-col items-center space-y-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => adjustHours(1)}
                disabled={hours >= 8}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <div className="text-3xl font-bold w-16 text-center">
                {hours.toString().padStart(2, '0')}
                <div className="text-xs text-muted-foreground font-normal mt-1">T</div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => adjustHours(-1)}
                disabled={hours <= 0}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>

            {/* Minutes Section */}
            <div className="flex flex-col items-center space-y-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => adjustMinutes(15)}
                disabled={minutes >= 45}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <div className="text-3xl font-bold w-16 text-center">
                {minutes.toString().padStart(2, '0')}
                <div className="text-xs text-muted-foreground font-normal mt-1">M</div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => adjustMinutes(-15)}
                disabled={minutes <= 0}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="text-center text-sm text-muted-foreground">
            Total: {formatTimeValue(timer)} timer
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="aktivitet">Aktivitet *</Label>
          <Select value={aktivitetId} onValueChange={setAktivitetId}>
            <SelectTrigger>
              <SelectValue placeholder="Velg aktivitet" />
            </SelectTrigger>
            <SelectContent className="bg-background border z-50">
              {activities.map((activity) => (
                <SelectItem key={activity.id} value={activity.id}>
                  {activity.navn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lonnstype">Lønnstype</Label>
          <Select value={lonnstype} onValueChange={setLonnstype}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background border z-50">
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="overtid">Overtid</SelectItem>
              <SelectItem value="helg">Helg</SelectItem>
              <SelectItem value="ferie">Ferie</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notat">Notat</Label>
          <Textarea
            id="notat"
            value={notat}
            onChange={(e) => setNotat(e.target.value)}
            placeholder="Valgfritt notat..."
            rows={3}
          />
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={() => {
              setStatus('utkast');
              handleSave();
            }} 
            disabled={loading}
            variant="outline"
          >
            {loading && status === 'utkast' ? 'Lagrer...' : 'Lagre utkast'}
          </Button>
          <Button 
            onClick={() => {
              setStatus('sendt');
              handleSave();
            }} 
            disabled={loading}
          >
            {loading && status === 'sendt' ? 'Sender...' : 'Send til godkjenning'}
          </Button>
          {existingEntry && (
            <div className="flex gap-1">
              <Button variant="outline" size="icon">
                <MessageSquare className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon">
                <Paperclip className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TimeEntry;