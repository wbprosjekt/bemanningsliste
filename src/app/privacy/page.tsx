"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Database, UserCheck, Mail, Clock, FileText } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PrivacyPolicyPage() {
  const router = useRouter();

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
            <Shield className="h-8 w-8 text-blue-600" />
            Personvernerklæring
          </h1>
          <p className="text-muted-foreground">
            Sist oppdatert: {new Date().toLocaleDateString('nb-NO', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Introduction */}
      <Card>
        <CardHeader>
          <CardTitle>Innledning</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Vi tar personvernet ditt på alvor. Denne personvernerklæringen forklarer hvordan vi samler inn, 
            bruker, oppbevarer og beskytter dine personopplysninger når du bruker vårt bemanningslistesystem.
          </p>
          <p>
            Ved å bruke denne tjenesten aksepterer du vilkårene beskrevet i denne personvernerklæringen.
          </p>
        </CardContent>
      </Card>

      {/* Data Collection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-green-600" />
            Hvilke data samler vi inn?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">1. Brukerinformasjon</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>E-postadresse (for autentisering og kommunikasjon)</li>
              <li>Navn (for identifikasjon i systemet)</li>
              <li>Organisasjonstilhørighet</li>
              <li>Brukerrolle (admin, bruker, etc.)</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">2. Arbeidsdata</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Timeføringer (arbeidstimer, prosjekt, aktivitet)</li>
              <li>Prosjekttilknytning</li>
              <li>Notater knyttet til arbeid</li>
              <li>Godkjenningsstatus</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">3. Teknisk informasjon</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>IP-adresse (for sikkerhet)</li>
              <li>Innloggingstidspunkt</li>
              <li>Enhetsinformasjon (nettlesertype)</li>
              <li>Cookies (se Cookie Policy for detaljer)</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">4. Tripletex-integrasjon</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Ansattinformasjon (navn, e-post, ansatt-ID)</li>
              <li>Prosjektinformasjon</li>
              <li>Aktiviteter</li>
              <li>Synkronisert timedata</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Why We Collect */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-purple-600" />
            Hvorfor samler vi inn data?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Lovlig grunnlag (GDPR Art. 6)</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>Oppfyllelse av arbeidsavtale:</strong> Timeføring og lønnskjøring</li>
              <li><strong>Legitim interesse:</strong> Prosjektstyring og rapportering</li>
              <li><strong>Samtykke:</strong> E-postvarsler og påminnelser</li>
              <li><strong>Juridisk forpliktelse:</strong> Lovpålagt dokumentasjon</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Formål</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Timeføring og lønnskjøring</li>
              <li>Prosjektstyring og ressursplanlegging</li>
              <li>Rapportering til ledelse og kunder</li>
              <li>Integrasjon med regnskapssystem (Tripletex)</li>
              <li>Kommunikasjon om timeføring og påminnelser</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Data Retention */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-600" />
            Hvor lenge lagrer vi data?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Lagringsperioder</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>Brukerinformasjon:</strong> Så lenge du har en aktiv konto</li>
              <li><strong>Timeføringer:</strong> 5 år (i henhold til bokføringsloven)</li>
              <li><strong>Audit logs:</strong> 2 år</li>
              <li><strong>E-post logs:</strong> 1 år</li>
              <li><strong>Session data:</strong> 30 dager etter siste aktivitet</li>
            </ul>
          </div>

          <p>
            Etter utløp av lagringsperioden slettes eller anonymiseres data automatisk, 
            med mindre det foreligger juridisk plikt til lengre oppbevaring.
          </p>
        </CardContent>
      </Card>

      {/* Your Rights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-red-600" />
            Dine rettigheter
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>Du har følgende rettigheter i henhold til GDPR:</p>

          <div className="space-y-3">
            <div>
              <h3 className="font-semibold">1. Rett til innsyn (Art. 15)</h3>
              <p className="text-sm text-muted-foreground">
                Du kan be om innsyn i hvilke personopplysninger vi har om deg.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">2. Rett til retting (Art. 16)</h3>
              <p className="text-sm text-muted-foreground">
                Du kan be om å få rettet feil eller ufullstendige opplysninger.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">3. Rett til sletting (Art. 17)</h3>
              <p className="text-sm text-muted-foreground">
                Du kan be om å få slettet dine personopplysninger ("retten til å bli glemt").
              </p>
            </div>

            <div>
              <h3 className="font-semibold">4. Rett til dataportabilitet (Art. 20)</h3>
              <p className="text-sm text-muted-foreground">
                Du kan be om å få utlevert dine data i et strukturert, maskinlesbart format.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">5. Rett til å protestere (Art. 21)</h3>
              <p className="text-sm text-muted-foreground">
                Du kan protestere mot vår behandling av dine personopplysninger.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">6. Rett til begrensning (Art. 18)</h3>
              <p className="text-sm text-muted-foreground">
                Du kan be om å begrense behandlingen av dine personopplysninger.
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mt-4">
            <p className="font-semibold text-blue-900">Hvordan utøve dine rettigheter?</p>
            <p className="text-sm text-blue-800 mt-2">
              Kontakt din administrator eller send e-post til personvernansvarlig i din organisasjon.
              Vi vil svare på din henvendelse innen 30 dager.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            Sikkerhet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>Vi bruker følgende sikkerhetstiltak for å beskytte dine data:</p>

          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Kryptert kommunikasjon (HTTPS/TLS)</li>
            <li>Tilgangskontroll (Row Level Security)</li>
            <li>Autentisering via sikker innlogging</li>
            <li>Regelmessige sikkerhetsoppdateringer</li>
            <li>Logging av administrative handlinger</li>
            <li>Backup og gjenoppretting</li>
            <li>CSRF-beskyttelse</li>
          </ul>

          <p className="text-sm text-muted-foreground">
            Til tross for våre sikkerhetstiltak kan ingen overføring over internett garanteres å være 100% sikker. 
            Vi oppfordrer deg til å bruke sterke passord og ikke dele innloggingsinformasjon.
          </p>
        </CardContent>
      </Card>

      {/* Third Parties */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-indigo-600" />
            Deling med tredjeparter
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>Vi deler data med følgende tredjeparter:</p>

          <div className="space-y-3">
            <div>
              <h3 className="font-semibold">1. Tripletex AS</h3>
              <p className="text-sm text-muted-foreground">
                Regnskapssystem for lønnskjøring og fakturering. Data deles kun med ditt samtykke.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">2. Supabase (database-leverandør)</h3>
              <p className="text-sm text-muted-foreground">
                Databasetjeneste for lagring av data. Supabase er GDPR-kompatibel og lagrer data i EU.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">3. Vercel (hosting)</h3>
              <p className="text-sm text-muted-foreground">
                Hosting av applikasjonen. Vercel er GDPR-kompatibel.
              </p>
            </div>
          </div>

          <p className="text-sm font-semibold mt-4">
            Vi selger aldri dine personopplysninger til tredjeparter.
          </p>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle>Kontaktinformasjon</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Har du spørsmål om hvordan vi behandler dine personopplysninger, eller ønsker du å utøve dine rettigheter?
          </p>

          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <p className="font-semibold">Personvernansvarlig:</p>
            <p className="text-sm">Kontakt din organisasjons administrator</p>
            <p className="text-sm text-muted-foreground">
              Du kan også klage til Datatilsynet hvis du mener vi ikke behandler dine personopplysninger korrekt.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Changes */}
      <Card>
        <CardHeader>
          <CardTitle>Endringer i personvernerklæringen</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Vi kan oppdatere denne personvernerklæringen fra tid til annen. Eventuelle endringer vil bli 
            publisert på denne siden med oppdatert dato. Vi oppfordrer deg til å gjennomgå denne erklæringen 
            jevnlig for å holde deg informert om hvordan vi beskytter dine personopplysninger.
          </p>
        </CardContent>
      </Card>

      {/* Footer Actions */}
      <div className="flex gap-4 justify-between pt-4">
        <Button variant="outline" onClick={() => router.push('/terms')}>
          Vilkår for bruk
        </Button>
        <Button variant="outline" onClick={() => router.push('/cookies')}>
          Cookie Policy
        </Button>
      </div>
    </div>
  );
}

