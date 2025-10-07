"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, RefreshCw, Filter, Download, Eye, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

interface EmailLog {
  id: string;
  org_id: string;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  template_type: 'payroll' | 'weekly' | 'test';
  sent_at: string;
  status: 'sent' | 'failed' | 'pending';
  error_message?: string;
  message_id?: string;
  provider: string;
  triggered_by: 'manual' | 'cron' | 'test';
  reminder_type?: 'payroll' | 'weekly' | 'test';
}

export default function EmailLogsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    template_type: 'all',
    triggered_by: 'all',
    search: ''
  });

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  useEffect(() => {
    if (user && profile) {
      loadLogs();
    }
  }, [user, profile]);

  const loadProfile = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, org:org_id (id, name)")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error("Error loading profile:", err);
      toast({
        title: "Profil mangler",
        description: "Kunne ikke laste profil. Prøv å logge ut og inn igjen.",
        variant: "destructive",
      });
    }
  };

  const loadLogs = async () => {
    if (!profile?.org_id) return;

    try {
      setLoading(true);
      
      let query = supabase
        .from('email_logs')
        .select('*')
        .eq('org_id', profile.org_id)
        .order('sent_at', { ascending: false })
        .limit(100);

      // Apply filters
      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      
      if (filters.template_type !== 'all') {
        query = query.eq('template_type', filters.template_type);
      }
      
      if (filters.triggered_by !== 'all') {
        query = query.eq('triggered_by', filters.triggered_by);
      }
      
      if (filters.search) {
        query = query.or(`recipient_email.ilike.%${filters.search}%,subject.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error loading email logs:', error);
      toast({
        title: "Feil ved lasting av e-post logg",
        description: error instanceof Error ? error.message : 'En ukjent feil oppstod',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshLogs = async () => {
    setRefreshing(true);
    await loadLogs();
    setRefreshing(false);
    toast({
      title: "E-post logg oppdatert",
      description: "Loggen er oppdatert med de nyeste oppføringene",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <Mail className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default" className="bg-green-100 text-green-800">Sendt</Badge>;
      case 'failed':
        return <Badge variant="destructive">Feilet</Badge>;
      case 'pending':
        return <Badge variant="secondary">Venter</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTemplateTypeBadge = (type: string) => {
    switch (type) {
      case 'payroll':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Payroll</Badge>;
      case 'weekly':
        return <Badge variant="outline" className="bg-purple-100 text-purple-800">Ukentlig</Badge>;
      case 'test':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">Test</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const exportLogs = () => {
    const csvContent = [
      ['Dato', 'Mottaker', 'Emne', 'Type', 'Status', 'Triggered By', 'Message ID', 'Feilmelding'],
      ...logs.map(log => [
        format(new Date(log.sent_at), 'dd.MM.yyyy HH:mm', { locale: nb }),
        log.recipient_email,
        log.subject,
        log.template_type,
        log.status,
        log.triggered_by,
        log.message_id || '',
        log.error_message || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `email_logs_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg text-muted-foreground">Laster e-post logg...</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute requiredRole="any-admin">
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">E-post Logg</h1>
          <p className="text-muted-foreground">
            Oversikt over alle sendte e-poster og påminnelser
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtrer og søk
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select value={filters.status} onValueChange={(value) => setFilters({...filters, status: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alle statuser" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle statuser</SelectItem>
                    <SelectItem value="sent">Sendt</SelectItem>
                    <SelectItem value="failed">Feilet</SelectItem>
                    <SelectItem value="pending">Venter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium">Type</label>
                <Select value={filters.template_type} onValueChange={(value) => setFilters({...filters, template_type: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alle typer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle typer</SelectItem>
                    <SelectItem value="payroll">Payroll</SelectItem>
                    <SelectItem value="weekly">Ukentlig</SelectItem>
                    <SelectItem value="test">Test</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium">Triggered By</label>
                <Select value={filters.triggered_by} onValueChange={(value) => setFilters({...filters, triggered_by: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="manual">Manuell</SelectItem>
                    <SelectItem value="cron">Automatisk</SelectItem>
                    <SelectItem value="test">Test</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium">Søk</label>
                <Input
                  placeholder="Søk i e-post eller emne..."
                  value={filters.search}
                  onChange={(e) => setFilters({...filters, search: e.target.value})}
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={loadLogs} variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Bruk filtre
              </Button>
              <Button onClick={refreshLogs} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Oppdater
              </Button>
              <Button onClick={exportLogs} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Eksporter CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Email Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              E-post Logg ({logs.length} oppføringer)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <div className="text-center py-8">
                <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Ingen e-post logg funnet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dato</TableHead>
                      <TableHead>Mottaker</TableHead>
                      <TableHead>Emne</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Triggered By</TableHead>
                      <TableHead>Message ID</TableHead>
                      <TableHead>Feilmelding</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          {format(new Date(log.sent_at), 'dd.MM.yyyy HH:mm', { locale: nb })}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{log.recipient_name || log.recipient_email}</div>
                            <div className="text-sm text-muted-foreground">{log.recipient_email}</div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate" title={log.subject}>
                          {log.subject}
                        </TableCell>
                        <TableCell>
                          {getTemplateTypeBadge(log.template_type)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(log.status)}
                            {getStatusBadge(log.status)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {log.triggered_by === 'manual' ? 'Manuell' : 
                             log.triggered_by === 'cron' ? 'Automatisk' : 'Test'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.message_id ? (
                            <span className="text-green-600" title={log.message_id}>
                              {log.message_id.substring(0, 8)}...
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          {log.error_message ? (
                            <span className="text-red-600 text-sm" title={log.error_message}>
                              {log.error_message.substring(0, 50)}...
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
