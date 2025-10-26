"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Cookie, Shield, Settings, CheckCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCookieConsent } from "@/components/providers/CookieConsentProvider";

const COOKIE_POLICY_LAST_UPDATED = "14. oktober 2025";

export default function CookiePolicyPage() {
  const router = useRouter();
  const { openSettings } = useCookieConsent();

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Cookie className="h-8 w-8 text-orange-600" />
            Cookie Policy
          </h1>
          <p className="text-muted-foreground">
            Sist oppdatert: {COOKIE_POLICY_LAST_UPDATED}
          </p>
        </div>
      </div>

      {/* Introduction */}
      <Card>
        <CardHeader>
          <CardTitle>Hva er cookies?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Cookies er små tekstfiler som lagres på din enhet (datamaskin, telefon, nettbrett) når du besøker 
            en nettside. Cookies gjør det mulig for nettstedet å huske dine handlinger og preferanser over tid.
          </p>
          <p>
            Vi bruker cookies og lignende teknologier (som localStorage) for å forbedre din opplevelse, 
            sikre funksjonalitet og beskytte Tjenesten.
          </p>
        </CardContent>
      </Card>

      {/* Types of Cookies */}
      <Card>
        <CardHeader>
          <CardTitle>Hvilke cookies bruker vi?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Essential Cookies */}
          <div className="border-l-4 border-green-500 pl-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-lg">1. Nødvendige cookies (Essential)</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Disse cookies er nødvendige for at Tjenesten skal fungere. De kan ikke deaktiveres.
            </p>
            
            <div className="space-y-4 ml-4">
              <div>
                <p className="font-semibold text-sm">Autentisering</p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-sm text-muted-foreground">
                  <li><strong>Navn:</strong> supabase-auth-token</li>
                  <li><strong>Formål:</strong> Holder deg innlogget</li>
                  <li><strong>Varighet:</strong> Sesjon / 7 dager</li>
                  <li><strong>Type:</strong> First-party</li>
                </ul>
              </div>

              <div>
                <p className="font-semibold text-sm">Sikkerhet (CSRF)</p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-sm text-muted-foreground">
                  <li><strong>Navn:</strong> csrf-token, sessionId</li>
                  <li><strong>Formål:</strong> Beskytter mot CSRF-angrep</li>
                  <li><strong>Varighet:</strong> 1 time</li>
                  <li><strong>Type:</strong> First-party</li>
                </ul>
              </div>

              <div>
                <p className="font-semibold text-sm">Session Management</p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-sm text-muted-foreground">
                  <li><strong>Navn:</strong> session-data</li>
                  <li><strong>Formål:</strong> Lagrer sesjonsdata (org_id, rolle)</li>
                  <li><strong>Varighet:</strong> Sesjon</li>
                  <li><strong>Type:</strong> First-party</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Functional Cookies */}
          <div className="border-l-4 border-blue-500 pl-4">
            <div className="flex items-center gap-2 mb-2">
              <Settings className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-lg">2. Funksjonelle cookies (Functional)</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Disse cookies forbedrer funksjonaliteten og personalisering. De kan deaktiveres.
            </p>
            
            <div className="space-y-4 ml-4">
              <div>
                <p className="font-semibold text-sm">Brukerpreferanser</p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-sm text-muted-foreground">
                  <li><strong>Navn:</strong> user-preferences</li>
                  <li><strong>Formål:</strong> Lagrer visningsinnstillinger, språk, tema</li>
                  <li><strong>Varighet:</strong> 1 år</li>
                  <li><strong>Type:</strong> First-party</li>
                </ul>
              </div>

              <div>
                <p className="font-semibold text-sm">Cookie Consent</p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-sm text-muted-foreground">
                  <li><strong>Navn:</strong> cookie-consent</li>
                  <li><strong>Formål:</strong> Husker dine cookie-preferanser</li>
                  <li><strong>Varighet:</strong> 1 år</li>
                  <li><strong>Type:</strong> First-party</li>
                </ul>
              </div>

              <div>
                <p className="font-semibold text-sm">UI State</p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-sm text-muted-foreground">
                  <li><strong>Navn:</strong> ui-state</li>
                  <li><strong>Formål:</strong> Lagrer UI-tilstand (åpne paneler, sortering)</li>
                  <li><strong>Varighet:</strong> 30 dager</li>
                  <li><strong>Type:</strong> First-party</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Analytics Cookies (not currently used) */}
          <div className="border-l-4 border-gray-300 pl-4 opacity-60">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="h-5 w-5 text-gray-400" />
              <h3 className="font-semibold text-lg">3. Analyse cookies (Analytics)</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Vi bruker for øyeblikket ikke analyse-cookies. Hvis dette endres, vil du bli varslet.
            </p>
          </div>

          {/* Marketing Cookies (not used) */}
          <div className="border-l-4 border-gray-300 pl-4 opacity-60">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="h-5 w-5 text-gray-400" />
              <h3 className="font-semibold text-lg">4. Markedsføring cookies (Marketing)</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Vi bruker ikke markedsføring-cookies eller sporing for reklameformål.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Local Storage */}
      <Card>
        <CardHeader>
          <CardTitle>LocalStorage og SessionStorage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            I tillegg til cookies bruker vi localStorage og sessionStorage for å lagre data lokalt 
            i nettleseren din. Disse teknologiene fungerer på samme måte som cookies, men data 
            sendes ikke automatisk til serveren.
          </p>

          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-sm">Data lagret i localStorage:</h3>
              <ul className="list-disc list-inside space-y-1 ml-4 text-sm text-muted-foreground">
                <li>Autentiseringstoken (Supabase)</li>
                <li>CSRF session ID</li>
                <li>Brukerpreferanser (språk, tema)</li>
                <li>Cookie consent preferanser</li>
                <li>Midlertidig cache av data (for offline-støtte)</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-sm">Data lagret i sessionStorage:</h3>
              <ul className="list-disc list-inside space-y-1 ml-4 text-sm text-muted-foreground">
                <li>Midlertidig sesjonsdata</li>
                <li>Skjemadata (draft state)</li>
              </ul>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            LocalStorage-data slettes ikke automatisk, men kan slettes manuelt via nettleserinnstillinger. 
            SessionStorage-data slettes automatisk når du lukker nettleseren.
          </p>
        </CardContent>
      </Card>

      {/* Third Party Services */}
      <Card>
        <CardHeader>
          <CardTitle>Tredjepartstjenester</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            Vi bruker følgende tredjepartstjenester som kan sette cookies:
          </p>

          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold">Supabase (Database og Autentisering)</h3>
              <p className="text-sm text-muted-foreground mt-2">
                <strong>Cookies:</strong> Autentiseringstoken<br />
                <strong>Formål:</strong> Håndtere innlogging og sikker datautveksling<br />
                <strong>Privacy Policy:</strong> <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">supabase.com/privacy</a>
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold">Vercel (Hosting)</h3>
              <p className="text-sm text-muted-foreground mt-2">
                <strong>Cookies:</strong> Ingen permanente cookies<br />
                <strong>Formål:</strong> Hosting av applikasjonen<br />
                <strong>Privacy Policy:</strong> <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">vercel.com/legal/privacy-policy</a>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Managing Cookies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-purple-600" />
            Hvordan administrere cookies?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">1. I Tjenesten</h3>
            <p className="text-sm mb-3">
              Du kan administrere dine cookie-preferanser via cookie-banneret som vises ved første besøk, 
              eller ved å klikke på "Cookie Innstillinger" i bunnen av siden.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                openSettings();
              }}
            >
              Åpne Cookie Innstillinger
            </Button>
          </div>

          <div>
            <h3 className="font-semibold mb-2">2. I nettleseren</h3>
            <p className="text-sm mb-2">Du kan også administrere cookies direkte i nettleseren:</p>
            <ul className="list-disc list-inside space-y-1 ml-4 text-sm text-muted-foreground">
              <li><strong>Chrome:</strong> Innstillinger → Personvern og sikkerhet → Cookies</li>
              <li><strong>Firefox:</strong> Innstillinger → Personvern og sikkerhet → Cookies</li>
              <li><strong>Safari:</strong> Innstillinger → Personvern → Cookies</li>
              <li><strong>Edge:</strong> Innstillinger → Personvern → Cookies</li>
            </ul>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mt-4">
            <p className="font-semibold text-yellow-900">⚠️ Viktig</p>
            <p className="text-sm text-yellow-800 mt-2">
              Hvis du blokkerer nødvendige cookies, vil Tjenesten ikke fungere korrekt. 
              Du vil ikke kunne logge inn eller bruke funksjoner som krever autentisering.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Do Not Track */}
      <Card>
        <CardHeader>
          <CardTitle>Do Not Track (DNT)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Vi respekterer "Do Not Track" signaler fra nettleseren din. Hvis DNT er aktivert, 
            vil vi ikke bruke funksjonelle cookies (kun nødvendige cookies for at Tjenesten skal fungere).
          </p>
          <p className="text-sm mt-2 text-muted-foreground">
            Merk: Nødvendige cookies kan ikke deaktiveres av tekniske årsaker.
          </p>
        </CardContent>
      </Card>

      {/* Updates */}
      <Card>
        <CardHeader>
          <CardTitle>Endringer i Cookie Policy</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Vi kan oppdatere denne Cookie Policy fra tid til annen for å gjenspeile endringer i 
            vår bruk av cookies eller av juridiske årsaker. Eventuelle endringer vil bli publisert 
            på denne siden med oppdatert dato.
          </p>
          <p className="text-sm mt-2">
            Vi oppfordrer deg til å gjennomgå denne policyen jevnlig for å holde deg informert.
          </p>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle>Spørsmål?</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm mb-4">
            Har du spørsmål om vår bruk av cookies, kontakt din organisasjons administrator 
            eller se vår Personvernerklæring for mer informasjon.
          </p>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="font-semibold">Kontakt:</p>
            <p className="text-sm text-muted-foreground mt-2">
              Se din organisasjons kontaktinformasjon for henvendelser om cookies og personvern.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Footer Actions */}
      <div className="flex gap-4 justify-between pt-4">
        <Button variant="outline" onClick={() => router.push('/privacy')}>
          Personvernerklæring
        </Button>
        <Button variant="outline" onClick={() => router.push('/terms')}>
          Vilkår for bruk
        </Button>
      </div>
    </div>
  );
}
