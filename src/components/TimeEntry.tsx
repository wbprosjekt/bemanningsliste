import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Clock, MessageSquare, Paperclip, Plus, Minus } from 'lucide-react';
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
  const [timer, setTimer] = useState(existingEntry?.timer || defaultTimer);
  const [aktivitetId, setAktivitetId] = useState(existingEntry?.aktivitet_id || '');
  const [notat, setNotat] = useState(existingEntry?.notat || '');
  const [status, setStatus] = useState(existingEntry?.status || 'utkast');
  const [lonnstype, setLonnstype] = useState(existingEntry?.lonnstype || 'normal');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

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

  const adjustTime = (delta: number) => {
    const newTime = Math.max(0, timer + delta);
    if (validateTimeStep(newTime)) {
      setTimer(newTime);
    }
  };

  const handleTimeInputChange = (value: string) => {
    const parsed = parseTimeValue(value);
    setTimer(parsed);
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
        <div className="space-y-2">
          <Label htmlFor="timer">Timer</Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => adjustTime(-0.25)}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              id="timer"
              type="text"
              value={formatTimeValue(timer)}
              onChange={(e) => handleTimeInputChange(e.target.value)}
              className="text-center"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => adjustTime(0.25)}
            >
              <Plus className="h-4 w-4" />
            </Button>
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