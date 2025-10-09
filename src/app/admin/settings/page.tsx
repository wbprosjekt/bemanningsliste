"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Users, Building, Settings, ArrowRight, Clock, Mail, Info, GitBranch, Calendar, Code } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { getVersionInfo, getShortCommitHash, getFormattedBuildTime } from "@/lib/version";

export default function SettingsPage() {
  const router = useRouter();
  const versionInfo = getVersionInfo();
  const shortCommit = getShortCommitHash();
  const buildTime = getFormattedBuildTime();

  return (
    <ProtectedRoute requiredRole="any-admin">
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Innstillinger</h1>
          <p className="text-muted-foreground">
            Konfigurer systeminnstillinger og organisasjonsoppsett
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Påminnelser */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-blue-600" />
                Påminnelser
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Konfigurer påminnelser for timeføring og lønnskjøring
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    Tilgjengelig
                  </Badge>
                  <Button 
                    onClick={() => router.push('/admin/settings/reminders')}
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    Innstillinger
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant="default" className="bg-blue-100 text-blue-800">
                    Ny funksjon
                  </Badge>
                  <Button 
                    onClick={() => router.push('/admin/settings/templates')}
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-1"
                  >
                    Templates
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* E-post innstillinger */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-green-600" />
                E-post innstillinger
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Konfigurer e-post service for påminnelser og notifikasjoner
              </p>
              <div className="flex items-center justify-between">
                <Badge variant="default" className="bg-green-100 text-green-800">
                  Ny funksjon
                </Badge>
                <Button 
                  onClick={() => router.push('/admin/settings/email')}
                  size="sm"
                  className="flex items-center gap-1"
                >
                  Konfigurer
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* E-post Logg */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-purple-600" />
                E-post Logg
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Se oversikt over alle sendte e-poster og påminnelser
              </p>
              <div className="flex items-center justify-between">
                <Badge variant="default" className="bg-purple-100 text-purple-800">
                  Ny funksjon
                </Badge>
                <Button 
                  onClick={() => router.push('/admin/settings/email-logs')}
                  size="sm"
                  className="flex items-center gap-1"
                >
                  Se logg
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Brukerinnstillinger */}
          <Card className="hover:shadow-md transition-shadow opacity-75">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-gray-400" />
                Brukerinnstillinger
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Administrer brukerroller og tilganger
              </p>
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                  Kommer snart
                </Badge>
                <Button 
                  disabled
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-1"
                >
                  Snart
                  <Clock className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Organisasjonsoppsett */}
          <Card className="hover:shadow-md transition-shadow opacity-75">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5 text-gray-400" />
                Organisasjonsoppsett
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Konfigurer organisasjonsinformasjon og integrasjoner
              </p>
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                  Kommer snart
                </Badge>
                <Button 
                  disabled
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-1"
                >
                  Snart
                  <Clock className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Systeminnstillinger */}
          <Card className="hover:shadow-md transition-shadow opacity-75">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-gray-400" />
                Systeminnstillinger
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Avanserte systemkonfigurasjoner og vedlikehold
              </p>
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                  Kommer snart
                </Badge>
                <Button 
                  disabled
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-1"
                >
                  Snart
                  <Clock className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Informasjon */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Bell className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900">Påminnelser er tilgjengelig!</h3>
                <p className="text-sm text-blue-700 mt-1">
                  Du kan nå konfigurere påminnelser for timeføring og lønnskjøring. 
                  Klikk på "Gå til" for å komme i gang.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Versjonsinformasjon */}
        <Card className="bg-slate-50 border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Info className="h-5 w-5 text-slate-600" />
              Om systemet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Version */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Code className="h-4 w-4" />
                  <span className="font-medium">Versjon</span>
                </div>
                <p className="text-lg font-semibold text-slate-900">{versionInfo.version}</p>
              </div>

              {/* Git Commit */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <GitBranch className="h-4 w-4" />
                  <span className="font-medium">Git Commit</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono bg-slate-200 px-2 py-1 rounded">
                    {shortCommit}
                  </code>
                  {versionInfo.gitCommit !== 'unknown' && (
                    <Badge variant="outline" className="text-xs">
                      {versionInfo.gitBranch}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Build Time */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">Build</span>
                </div>
                <p className="text-sm text-slate-700">{buildTime}</p>
              </div>

              {/* Environment */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Settings className="h-4 w-4" />
                  <span className="font-medium">Miljø</span>
                </div>
                <Badge 
                  variant={versionInfo.environment === 'production' ? 'default' : 'secondary'}
                  className={versionInfo.environment === 'production' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                  }
                >
                  {versionInfo.environment === 'production' ? 'Produksjon' : 'Utvikling'}
                </Badge>
              </div>
            </div>

            {/* Additional Info */}
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Next.js {versionInfo.nextVersion}</span>
                <span>Bemanningsliste © 2025</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
