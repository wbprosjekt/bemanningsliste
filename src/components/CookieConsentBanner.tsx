 "use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Cookie, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCookieConsent } from "@/components/providers/CookieConsentProvider";

export default function CookieConsentBanner() {
  const {
    effectiveConsent,
    showBanner,
    showSettings,
    openSettings,
    closeSettings,
    acceptAll,
    acceptEssential,
    saveConsent,
    doNotTrack,
  } = useCookieConsent();
  const [draftConsent, setDraftConsent] = useState(effectiveConsent);

  useEffect(() => {
    setDraftConsent(effectiveConsent);
  }, [effectiveConsent, showSettings]);

  const handleSaveCustom = () => {
    saveConsent({
      essential: true,
      functional: draftConsent.functional,
      analytics: draftConsent.analytics,
      marketing: draftConsent.marketing,
    });
  };

  const handleRejectAll = () => {
    acceptEssential();
  };

  if (!showBanner && !showSettings) {
    return null;
  }

  return (
    <>
      {showBanner && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/95 backdrop-blur-sm border-t shadow-lg">
          <Card className="max-w-4xl mx-auto">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Cookie className="h-5 w-5 text-orange-600" />
                  <CardTitle className="text-lg">Vi bruker cookies</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-3 space-y-2">
              <p className="text-sm text-muted-foreground">
                Vi bruker cookies for å forbedre din opplevelse, sikre funksjonalitet og beskytte Tjenesten. Nødvendige
                cookies er alltid aktivert. Du kan velge å akseptere eller tilpasse dine preferanser.
              </p>
              {doNotTrack && (
                <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md p-2">
                  Nettleseren din har «Do Not Track» aktivert. Vi vil kun bruke nødvendige cookies inntil du endrer dette
                  signalet.
                </p>
              )}
              <div className="flex gap-2 mt-3">
                <Button variant="link" size="sm" onClick={() => window.open("/privacy", "_blank")} className="h-auto p-0 text-xs">
                  Personvernerklæring
                </Button>
                <span className="text-xs text-muted-foreground">·</span>
                <Button variant="link" size="sm" onClick={() => window.open("/cookies", "_blank")} className="h-auto p-0 text-xs">
                  Cookie Policy
                </Button>
              </div>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2 pt-3">
              <Button onClick={acceptAll} className="flex-1 sm:flex-initial">
                Aksepter alle
              </Button>
              <Button onClick={acceptEssential} variant="outline" className="flex-1 sm:flex-initial">
                Kun nødvendige
              </Button>
              <Button onClick={openSettings} variant="ghost" className="flex-1 sm:flex-initial">
                <Settings className="h-4 w-4 mr-2" />
                Tilpass
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      <Dialog open={showSettings} onOpenChange={(open) => (open ? openSettings() : closeSettings())}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Cookie Innstillinger
            </DialogTitle>
            <DialogDescription>Velg hvilke cookies du vil tillate. Nødvendige cookies kan ikke deaktiveres.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Essential Cookies */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 flex-1">
                  <Label className="text-base font-semibold">
                    Nødvendige cookies
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Disse cookies er nødvendige for at Tjenesten skal fungere. 
                    De kan ikke deaktiveres.
                  </p>
                </div>
                <Switch
                  checked={true}
                  disabled={true}
                  className="ml-4"
                />
              </div>
              <div className="ml-4 pl-4 border-l-2 border-gray-200 text-xs text-muted-foreground space-y-1">
                <p>• Autentisering og innlogging</p>
                <p>• CSRF-beskyttelse</p>
                <p>• Sesjonsdata</p>
              </div>
            </div>

            {/* Functional Cookies */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="functional" className="text-base font-semibold">
                    Funksjonelle cookies
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Forbedrer funksjonaliteten og husker dine preferanser.
                  </p>
                </div>
                <Switch
                  id="functional"
                  checked={draftConsent.functional && !doNotTrack}
                  disabled={doNotTrack}
                  onCheckedChange={(checked) =>
                    setDraftConsent((prev) => ({
                      ...prev,
                      functional: checked,
                    }))
                  }
                  className="ml-4"
                />
              </div>
              <div className="ml-4 pl-4 border-l-2 border-gray-200 text-xs text-muted-foreground space-y-1">
                <p>• Brukerpreferanser (språk, tema)</p>
                <p>• UI-tilstand (åpne paneler, sortering)</p>
                <p>• Cookie consent preferanser</p>
              </div>
            </div>

            {/* Analytics Cookies */}
            <div className="space-y-3 opacity-60">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="analytics" className="text-base font-semibold">
                    Analyse cookies
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Hjelper oss å forstå hvordan Tjenesten brukes. (Ikke i bruk)
                  </p>
                </div>
                <Switch
                  id="analytics"
                  checked={draftConsent.analytics && !doNotTrack}
                  disabled={true}
                  className="ml-4"
                />
              </div>
              <div className="ml-4 pl-4 border-l-2 border-gray-200 text-xs text-muted-foreground">
                <p>• Ikke i bruk for øyeblikket</p>
              </div>
            </div>

            {/* Marketing Cookies */}
            <div className="space-y-3 opacity-60">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="marketing" className="text-base font-semibold">
                    Markedsføring cookies
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Brukes til målrettet markedsføring. (Ikke i bruk)
                  </p>
                </div>
                <Switch
                  id="marketing"
                  checked={draftConsent.marketing && !doNotTrack}
                  disabled={true}
                  className="ml-4"
                />
              </div>
              <div className="ml-4 pl-4 border-l-2 border-gray-200 text-xs text-muted-foreground">
                <p>• Vi bruker ikke markedsføring-cookies</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleRejectAll} className="flex-1 sm:flex-initial">
              Avvis alle
            </Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={closeSettings} className="flex-1 sm:flex-initial">
              Avbryt
            </Button>
            <Button onClick={handleSaveCustom} className="flex-1 sm:flex-initial">
              Lagre preferanser
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
