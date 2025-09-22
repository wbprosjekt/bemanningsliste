import { useState, useEffect, useCallback } from 'react';
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
  existingEntry?: {
    id: string;
    timer: number;
    aktivitet_id: string;
    notat: string;
    status: string;
  };
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
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Separate overtime time entries for 100% and 50%
  const [overtime100Hours, setOvertime100Hours] = useState(0);
  const [overtime100Minutes, setOvertime100Minutes] = useState(0);
  const [overtime50Hours, setOvertime50Hours] = useState(0);
  const [overtime50Minutes, setOvertime50Minutes] = useState(0);
  const [showOvertime, setShowOvertime] = useState(false); // Collapsed by default

  // Calculate total timer value from hours and minutes
  const timer = hours + (minutes / 60);
  const overtime100Timer = overtime100Hours + (overtime100Minutes / 60);
  const overtime50Timer = overtime50Hours + (overtime50Minutes / 60);
  const totalOvertimeTimer = overtime100Timer + overtime50Timer;

  useEffect(() => {
    const baseTimer = existingEntry?.timer ?? defaultTimer;
    const baseHours = Math.floor(baseTimer);
    const baseMinutes = Math.round((baseTimer % 1) * 60);

    setHours(Math.max(0, Math.min(8, baseHours)));
    setMinutes(Math.max(0, Math.min(45, Math.round(baseMinutes / 15) * 15)));
    setAktivitetId(existingEntry?.aktivitet_id || '');
    setNotat(existingEntry?.notat || '');
    setStatus(existingEntry?.status || 'utkast');
  }, [existingEntry, defaultTimer]);

  useEffect(() => {
    loadActivities();
    loadExistingOvertime();
  }, [orgId, existingEntry, vaktId, loadActivities, loadExistingOvertime]);

  const loadExistingOvertime = useCallback(async () => {
    try {
      // Reset overtime state before loading to avoid stale values when switching entries
      setOvertime100Hours(0);
      setOvertime100Minutes(0);
      setOvertime50Hours(0);
      setOvertime50Minutes(0);
      setShowOvertime(false);

      // Load existing overtime entries for this vakt
      const { data, error } = await supabase
        .from('vakt_timer')
        .select('timer, is_overtime')
        .eq('vakt_id', vaktId)
        .eq('is_overtime', true);

      if (error) throw error;

      if (data && data.length > 0) {
        const totalOvertime = data.reduce((sum, entry) => sum + (entry.timer ?? 0), 0);
        setOvertime100Hours(Math.floor(totalOvertime));
        setOvertime100Minutes(Math.round((totalOvertime % 1) * 60));
        setShowOvertime(true);
      }
    } catch (error) {
      console.error('Error loading existing overtime:', error);
    }
  }, [vaktId]);

  const loadActivities = useCallback(async () => {
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
  }, [orgId]);

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

  const adjustOvertime100Hours = (delta: number) => {
    const newHours = Math.max(0, Math.min(12, overtime100Hours + delta));
    setOvertime100Hours(newHours);
  };

  const adjustOvertime100Minutes = (delta: number) => {
    const newMinutes = Math.max(0, Math.min(45, overtime100Minutes + delta));
    const roundedMinutes = Math.round(newMinutes / 15) * 15;
    setOvertime100Minutes(roundedMinutes);
  };

  const adjustOvertime50Hours = (delta: number) => {
    const newHours = Math.max(0, Math.min(12, overtime50Hours + delta));
    setOvertime50Hours(newHours);
  };

  const adjustOvertime50Minutes = (delta: number) => {
    const newMinutes = Math.max(0, Math.min(45, overtime50Minutes + delta));
    const roundedMinutes = Math.round(newMinutes / 15) * 15;
    setOvertime50Minutes(roundedMinutes);
  };

  const handleTimeInputChange = (value: string) => {
    const parsed = parseTimeValue(value);
    const newHours = Math.floor(parsed);
    const newMinutes = Math.round((parsed % 1) * 60);
    setHours(Math.max(0, Math.min(8, newHours)));
    setMinutes(Math.max(0, Math.min(45, Math.round(newMinutes / 15) * 15)));
  };

  const handleSave = async (nextStatus: 'utkast' | 'sendt' | 'godkjent' = status) => {
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

    if (
      totalOvertimeTimer > 0 &&
      (!validateTimeStep(overtime100Timer) || !validateTimeStep(overtime50Timer))
    ) {
      toast({
        title: "Ugyldig overtidstidsverdi",
        description: "Overtidstimer må være i 0,25-steg (f.eks. 1,25, 2,50, 3,75, 4,00).",
        variant: "destructive"
      });
      return;
    }

    const previousStatus = status;
    setStatus(nextStatus);
    setLoading(true);
    try {
      // Save normal time entry
      const normalTimeData = {
        vakt_id: vaktId,
        org_id: orgId,
        timer,
        aktivitet_id: aktivitetId,
        notat: notat || null,
        status: nextStatus,
        is_overtime: false
      };

      let result;
      if (existingEntry) {
        result = await supabase
          .from('vakt_timer')
          .update(normalTimeData)
          .eq('id', existingEntry.id);
      } else {
        result = await supabase
          .from('vakt_timer')
          .insert(normalTimeData);
      }

      if (result.error) throw result.error;

      // Handle overtime entries - delete existing first
      await supabase
        .from('vakt_timer')
        .delete()
        .eq('vakt_id', vaktId)
        .eq('is_overtime', true);

      // Insert 100% overtime if exists
      if (overtime100Timer > 0) {
        const overtime100Data = {
          vakt_id: vaktId,
          org_id: orgId,
          timer: overtime100Timer,
          aktivitet_id: aktivitetId,
          notat: notat || null,
          status: nextStatus,
          is_overtime: true,
          overtime_type: '100'
        };

        const overtime100Result = await supabase
          .from('vakt_timer')
          .insert(overtime100Data);

        if (overtime100Result.error) throw overtime100Result.error;
      }

      // Insert 50% overtime if exists
      if (overtime50Timer > 0) {
        const overtime50Data = {
          vakt_id: vaktId,
          org_id: orgId,
          timer: overtime50Timer,
          aktivitet_id: aktivitetId,
          notat: notat || null,
          status: nextStatus,
          is_overtime: true,
          overtime_type: '50'
        };

        const overtime50Result = await supabase
          .from('vakt_timer')
          .insert(overtime50Data);

        if (overtime50Result.error) throw overtime50Result.error;
      }

      toast({
        title: "Lagret",
        description: `Timeføring lagret${totalOvertimeTimer > 0 ? ` med ${formatTimeValue(totalOvertimeTimer)} overtid` : ''}.`
      });

      onSave?.();
    } catch (error: unknown) {
      toast({
        title: "Lagring feilet",
        description: error instanceof Error ? error.message : 'En ukjent feil oppstod',
        variant: "destructive"
      });
      setStatus(previousStatus);
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
    <Card className="mb-4">
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
            {totalOvertimeTimer > 0 && (
              <span className="ml-2 text-yellow-600 font-bold">
                + {formatTimeValue(totalOvertimeTimer)} overtid ⚡
              </span>
            )}
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

        {/* Overtime Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Overtid
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowOvertime(!showOvertime)}
              className="text-xs"
            >
              {showOvertime ? 'Skjul' : 'Vis'}
            </Button>
          </div>
          
          {showOvertime && (
            <div className="space-y-4 p-4 border rounded-lg bg-yellow-50 border-yellow-200">
              {/* 100% Overtime */}
              <div className="space-y-2">
                <Label className="text-blue-600 font-medium">Overtidstillegg 100%</Label>
                <div className="flex items-center justify-center gap-6">
                  {/* 100% Hours */}
                  <div className="flex flex-col items-center space-y-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => adjustOvertime100Hours(1)}
                      disabled={overtime100Hours >= 12}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <div className="text-3xl font-bold w-16 text-center">
                      {overtime100Hours.toString().padStart(2, '0')}
                      <div className="text-xs text-muted-foreground font-normal mt-1">T</div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => adjustOvertime100Hours(-1)}
                      disabled={overtime100Hours <= 0}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* 100% Minutes */}
                  <div className="flex flex-col items-center space-y-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => adjustOvertime100Minutes(15)}
                      disabled={overtime100Minutes >= 45}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <div className="text-3xl font-bold w-16 text-center">
                      {overtime100Minutes.toString().padStart(2, '0')}
                      <div className="text-xs text-muted-foreground font-normal mt-1">M</div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => adjustOvertime100Minutes(-15)}
                      disabled={overtime100Minutes <= 0}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* 50% Overtime */}
              <div className="space-y-2">
                <Label className="text-blue-600 font-medium">Overtidstillegg 50%</Label>
                <div className="flex items-center justify-center gap-6">
                  {/* 50% Hours */}
                  <div className="flex flex-col items-center space-y-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => adjustOvertime50Hours(1)}
                      disabled={overtime50Hours >= 12}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <div className="text-3xl font-bold w-16 text-center">
                      {overtime50Hours.toString().padStart(2, '0')}
                      <div className="text-xs text-muted-foreground font-normal mt-1">T</div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => adjustOvertime50Hours(-1)}
                      disabled={overtime50Hours <= 0}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* 50% Minutes */}
                  <div className="flex flex-col items-center space-y-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => adjustOvertime50Minutes(15)}
                      disabled={overtime50Minutes >= 45}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <div className="text-3xl font-bold w-16 text-center">
                      {overtime50Minutes.toString().padStart(2, '0')}
                      <div className="text-xs text-muted-foreground font-normal mt-1">M</div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => adjustOvertime50Minutes(-15)}
                      disabled={overtime50Minutes <= 0}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {showOvertime && (
            <div className="text-center text-sm text-muted-foreground">
              Overtid: {formatTimeValue(totalOvertimeTimer)} timer
              {totalOvertimeTimer > 0 && <span className="ml-2 text-yellow-600 font-bold">⚡</span>}
            </div>
          )}
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
            onClick={() => handleSave('utkast')}
            disabled={loading}
            variant="outline"
          >
            {loading && status === 'utkast' ? 'Lagrer...' : 'Lagre utkast'}
          </Button>
          <Button
            onClick={() => handleSave('sendt')}
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
