"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export default function TermsOfServicePage() {
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
            <FileText className="h-8 w-8 text-blue-600" />
            Vilkår for bruk
          </h1>
          <p className="text-muted-foreground">
            Sist oppdatert: {new Date().toLocaleDateString('nb-NO', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Introduction */}
      <Card>
        <CardHeader>
          <CardTitle>Velkommen til Bemanningsliste</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Disse vilkårene regulerer bruken av vårt bemanningslistesystem ("Tjenesten"). 
            Ved å registrere deg og bruke Tjenesten aksepterer du disse vilkårene i sin helhet.
          </p>
          <p className="font-semibold">
            Hvis du ikke aksepterer disse vilkårene, må du ikke bruke Tjenesten.
          </p>
        </CardContent>
      </Card>

      {/* Account Registration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            1. Registrering og brukerkonto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">1.1 Krav til registrering</h3>
            <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
              <li>Du må være minimum 16 år gammel for å bruke Tjenesten</li>
              <li>Du må oppgi korrekt og fullstendig informasjon</li>
              <li>Du er ansvarlig for å holde innloggingsinformasjonen din sikker</li>
              <li>Du må varsle oss umiddelbart ved mistanke om uautorisert bruk</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">1.2 Organisasjonskonto</h3>
            <p className="text-sm">
              For å bruke Tjenesten må du være tilknyttet en organisasjon. 
              Organisasjonens administrator er ansvarlig for å administrere tilganger og brukerrettigheter.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">1.3 Kontosikkerhet</h3>
            <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
              <li>Du er ansvarlig for all aktivitet på din konto</li>
              <li>Bruk sterke og unike passord</li>
              <li>Ikke del innloggingsinformasjon med andre</li>
              <li>Logg ut etter bruk på delte enheter</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Acceptable Use */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-blue-600" />
            2. Akseptabel bruk
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">2.1 Tillatt bruk</h3>
            <p className="text-sm mb-2">Tjenesten skal brukes til:</p>
            <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
              <li>Registrering av arbeidstimer</li>
              <li>Prosjektstyring og ressursplanlegging</li>
              <li>Rapportering til ledelse</li>
              <li>Integrasjon med godkjente regnskapssystemer</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              2.2 Forbudt bruk
            </h3>
            <p className="text-sm mb-2">Du skal ikke:</p>
            <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
              <li>Registrere falske eller misvisende timer</li>
              <li>Forsøke å få tilgang til andre brukeres data</li>
              <li>Bruke Tjenesten til ulovlige formål</li>
              <li>Omgå sikkerhetstiltak eller adgangskontroller</li>
              <li>Laste opp virus, malware eller skadelig kode</li>
              <li>Forstyrre eller avbryte Tjenestens drift</li>
              <li>Automatisere tilgang til Tjenesten (scraping, bots)</li>
              <li>Viderelisensiere, selge eller leie ut Tjenesten</li>
            </ul>
          </div>

          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
            <p className="font-semibold text-red-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Brudd på disse vilkårene
            </p>
            <p className="text-sm text-red-800 mt-2">
              Brudd på disse vilkårene kan føre til suspensjon eller stenging av kontoen din, 
              samt juridiske konsekvenser.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Data and Content */}
      <Card>
        <CardHeader>
          <CardTitle>3. Data og innhold</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">3.1 Ditt innhold</h3>
            <p className="text-sm">
              Du beholder eierskapet til dataene du legger inn i Tjenesten (timeføringer, notater, etc.). 
              Ved å bruke Tjenesten gir du oss lisens til å behandle disse dataene for å levere Tjenesten.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">3.2 Dataansvar</h3>
            <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
              <li>Du er ansvarlig for nøyaktigheten av dataene du registrerer</li>
              <li>Du må ikke legge inn sensitive eller fortrolige data uten godkjenning</li>
              <li>Vi er ikke ansvarlige for tap av data som følge av feil bruk</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">3.3 Backup og sikkerhet</h3>
            <p className="text-sm">
              Vi tar regelmessige sikkerhetskopier av data, men anbefaler at din organisasjon 
              også eksporterer viktige data jevnlig.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Intellectual Property */}
      <Card>
        <CardHeader>
          <CardTitle>4. Immaterielle rettigheter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">4.1 Våre rettigheter</h3>
            <p className="text-sm">
              Alle rettigheter til Tjenesten, inkludert kildekode, design, logoer og dokumentasjon, 
              tilhører oss eller våre lisensgivere. Du får kun en begrenset, ikke-eksklusiv lisens 
              til å bruke Tjenesten i henhold til disse vilkårene.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">4.2 Begrensninger</h3>
            <p className="text-sm mb-2">Du skal ikke:</p>
            <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
              <li>Kopiere, modifisere eller distribuere Tjenesten</li>
              <li>Dekompilere, reverse engineere eller forsøke å utlede kildekode</li>
              <li>Fjerne copyright-merknader eller andre rettighetsmerknader</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Service Availability */}
      <Card>
        <CardHeader>
          <CardTitle>5. Tjenestetilgjengelighet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">5.1 Tilgjengelighet</h3>
            <p className="text-sm">
              Vi streber etter å holde Tjenesten tilgjengelig 24/7, men kan ikke garantere 
              100% oppetid. Vi forbeholder oss retten til å utføre vedlikehold og oppdateringer.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">5.2 Planlagt vedlikehold</h3>
            <p className="text-sm">
              Planlagt vedlikehold vil varsles i god tid, fortrinnsvis utenfor normal arbeidstid.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">5.3 Tjenesteforstyrrelser</h3>
            <p className="text-sm">
              Vi er ikke ansvarlige for forsinkelser eller feil forårsaket av forhold utenfor vår kontroll 
              (force majeure), inkludert nettverksproblemer, strømbrudd, eller tredjeparts tjenestefeil.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Payment and Pricing */}
      <Card>
        <CardHeader>
          <CardTitle>6. Betaling og priser</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">6.1 Abonnement</h3>
            <p className="text-sm">
              Priser for Tjenesten avtales direkte med din organisasjon. 
              Fakturering skjer i henhold til avtalt betalingsplan.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">6.2 Prisendringer</h3>
            <p className="text-sm">
              Vi forbeholder oss retten til å endre priser med 30 dagers varsel.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">6.3 Manglende betaling</h3>
            <p className="text-sm">
              Ved manglende betaling kan tilgangen til Tjenesten suspenderes inntil betaling er mottatt.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Termination */}
      <Card>
        <CardHeader>
          <CardTitle>7. Oppsigelse</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">7.1 Oppsigelse fra din side</h3>
            <p className="text-sm">
              Din organisasjon kan si opp Tjenesten i henhold til avtalt oppsigelsesfrist. 
              Individuelle brukere kan be om å få slettet sin konto.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">7.2 Oppsigelse fra vår side</h3>
            <p className="text-sm">
              Vi kan suspendere eller avslutte din tilgang til Tjenesten umiddelbart ved 
              brudd på disse vilkårene, ulovlig aktivitet, eller hvis vi avslutter Tjenesten.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">7.3 Etter oppsigelse</h3>
            <p className="text-sm">
              Ved oppsigelse vil du miste tilgang til Tjenesten. Data vil bli oppbevart i henhold 
              til vår personvernerklæring og juridiske forpliktelser.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Liability */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            8. Ansvarsbegrensning
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">8.1 Garantier</h3>
            <p className="text-sm">
              Tjenesten leveres "som den er" uten garantier av noe slag, verken uttrykkelige eller 
              underforståtte. Vi garanterer ikke at Tjenesten er feilfri eller alltid tilgjengelig.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">8.2 Ansvarsbegrensning</h3>
            <p className="text-sm">
              Vi er ikke ansvarlige for indirekte tap, tapt fortjeneste, datamisbruk eller andre 
              følgeskader som følge av bruk eller manglende bruk av Tjenesten.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">8.3 Maksimalt ansvar</h3>
            <p className="text-sm">
              Vårt totale ansvar overfor deg er begrenset til beløpet din organisasjon har betalt 
              for Tjenesten i de siste 12 månedene.
            </p>
          </div>

          <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
            <p className="text-sm text-orange-900">
              Ingenting i disse vilkårene begrenser vårt ansvar for grov uaktsomhet, 
              forsettlige handlinger eller brudd på lovpålagte rettigheter.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Changes to Terms */}
      <Card>
        <CardHeader>
          <CardTitle>9. Endringer i vilkårene</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            Vi kan oppdatere disse vilkårene fra tid til annen. Vesentlige endringer vil bli 
            varslet via e-post eller i Tjenesten minst 30 dager før de trer i kraft.
          </p>
          <p className="text-sm">
            Ved å fortsette å bruke Tjenesten etter at endringene trer i kraft, aksepterer du 
            de oppdaterte vilkårene.
          </p>
        </CardContent>
      </Card>

      {/* Governing Law */}
      <Card>
        <CardHeader>
          <CardTitle>10. Lovvalg og tvister</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">10.1 Lovvalg</h3>
            <p className="text-sm">
              Disse vilkårene er underlagt norsk lov.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">10.2 Tvisteløsning</h3>
            <p className="text-sm">
              Tvister skal søkes løst i minnelighet. Hvis dette ikke er mulig, skal tvisten 
              avgjøres av norske domstoler med verneting i [din by/region].
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle>11. Kontakt</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm mb-4">
            Har du spørsmål om disse vilkårene, kontakt din organisasjons administrator 
            eller vår kundeservice.
          </p>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="font-semibold">Kontaktinformasjon:</p>
            <p className="text-sm text-muted-foreground mt-2">
              Se din organisasjons kontaktinformasjon for support og henvendelser.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Footer Actions */}
      <div className="flex gap-4 justify-between pt-4">
        <Button variant="outline" onClick={() => router.push('/privacy')}>
          Personvernerklæring
        </Button>
        <Button variant="outline" onClick={() => router.push('/cookies')}>
          Cookie Policy
        </Button>
      </div>
    </div>
  );
}

