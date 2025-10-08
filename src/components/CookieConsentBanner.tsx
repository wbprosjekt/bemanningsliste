"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Cookie, Settings, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CookieConsent {
  essential: boolean; // Always true
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
}

const DEFAULT_CONSENT: CookieConsent = {
  essential: true, // Always required
  functional: false,
  analytics: false,
  marketing: false,
  timestamp: new Date().toISOString(),
};

export default function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [consent, setConsent] = useState<CookieConsent>(DEFAULT_CONSENT);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    // Check if user has already given consent
    const savedConsent = localStorage.getItem('cookie-consent');
    
    if (savedConsent) {
      try {
        const parsed = JSON.parse(savedConsent);
        setConsent(parsed);
        setHasInteracted(true);
        applyConsent(parsed);
      } catch (e) {
        console.error('Failed to parse cookie consent:', e);
        setShowBanner(true);
      }
    } else {
      // Show banner after a short delay for better UX
      setTimeout(() => setShowBanner(true), 1000);
    }
  }, []);

  const applyConsent = (consentData: CookieConsent) => {
    // Apply consent settings
    if (!consentData.functional) {
      // Remove functional cookies if not consented
      localStorage.removeItem('user-preferences');
      localStorage.removeItem('ui-state');
    }

    if (!consentData.analytics) {
      // Remove analytics cookies (if any in the future)
      // Currently not used
    }

    if (!consentData.marketing) {
      // Remove marketing cookies (if any in the future)
      // Currently not used
    }

    // Fire custom event that other parts of the app can listen to
    window.dispatchEvent(new CustomEvent('cookie-consent-changed', { 
      detail: consentData 
    }));
  };

  const saveConsent = (consentData: CookieConsent) => {
    const consentWithTimestamp = {
      ...consentData,
      timestamp: new Date().toISOString(),
    };

    localStorage.setItem('cookie-consent', JSON.stringify(consentWithTimestamp));
    setConsent(consentWithTimestamp);
    setHasInteracted(true);
    applyConsent(consentWithTimestamp);
    setShowBanner(false);
    setShowSettings(false);
  };

  const handleAcceptAll = () => {
    saveConsent({
      essential: true,
      functional: true,
      analytics: true,
      marketing: true,
      timestamp: new Date().toISOString(),
    });
  };

  const handleAcceptEssential = () => {
    saveConsent({
      essential: true,
      functional: false,
      analytics: false,
      marketing: false,
      timestamp: new Date().toISOString(),
    });
  };

  const handleSaveCustom = () => {
    saveConsent(consent);
  };

  const handleRejectAll = () => {
    // Only essential cookies
    handleAcceptEssential();
  };

  if (!showBanner || hasInteracted) {
    return null;
  }

  return (
    <>
      {/* Main Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/95 backdrop-blur-sm border-t shadow-lg">
        <Card className="max-w-4xl mx-auto">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Cookie className="h-5 w-5 text-orange-600" />
                <CardTitle className="text-lg">Vi bruker cookies</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowBanner(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pb-3">
            <p className="text-sm text-muted-foreground">
              Vi bruker cookies for å forbedre din opplevelse, sikre funksjonalitet og beskytte Tjenesten. 
              Nødvendige cookies er alltid aktivert. Du kan velge å akseptere eller tilpasse dine preferanser.
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                variant="link"
                size="sm"
                onClick={() => window.open('/privacy', '_blank')}
                className="h-auto p-0 text-xs"
              >
                Personvernerklæring
              </Button>
              <span className="text-xs text-muted-foreground">·</span>
              <Button
                variant="link"
                size="sm"
                onClick={() => window.open('/cookies', '_blank')}
                className="h-auto p-0 text-xs"
              >
                Cookie Policy
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2 pt-3">
            <Button onClick={handleAcceptAll} className="flex-1 sm:flex-initial">
              Aksepter alle
            </Button>
            <Button onClick={handleAcceptEssential} variant="outline" className="flex-1 sm:flex-initial">
              Kun nødvendige
            </Button>
            <Button 
              onClick={() => setShowSettings(true)} 
              variant="ghost" 
              className="flex-1 sm:flex-initial"
            >
              <Settings className="h-4 w-4 mr-2" />
              Tilpass
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Cookie Innstillinger
            </DialogTitle>
            <DialogDescription>
              Velg hvilke cookies du vil tillate. Nødvendige cookies kan ikke deaktiveres.
            </DialogDescription>
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
                  checked={consent.functional}
                  onCheckedChange={(checked) => 
                    setConsent({ ...consent, functional: checked })
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
                  checked={consent.analytics}
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
                  checked={consent.marketing}
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
            <Button 
              variant="outline" 
              onClick={handleRejectAll}
              className="flex-1 sm:flex-initial"
            >
              Avvis alle
            </Button>
            <div className="flex-1" />
            <Button 
              variant="outline" 
              onClick={() => setShowSettings(false)}
              className="flex-1 sm:flex-initial"
            >
              Avbryt
            </Button>
            <Button 
              onClick={handleSaveCustom}
              className="flex-1 sm:flex-initial"
            >
              Lagre preferanser
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Hook to check if user has given consent for specific cookie types
 */
export function useCookieConsent() {
  const [consent, setConsent] = useState<CookieConsent | null>(null);

  useEffect(() => {
    const loadConsent = () => {
      const savedConsent = localStorage.getItem('cookie-consent');
      if (savedConsent) {
        try {
          setConsent(JSON.parse(savedConsent));
        } catch (e) {
          console.error('Failed to parse cookie consent:', e);
          setConsent(null);
        }
      }
    };

    loadConsent();

    // Listen for consent changes
    const handleConsentChange = (event: CustomEvent) => {
      setConsent(event.detail);
    };

    window.addEventListener('cookie-consent-changed', handleConsentChange as EventListener);
    
    return () => {
      window.removeEventListener('cookie-consent-changed', handleConsentChange as EventListener);
    };
  }, []);

  return {
    consent,
    hasConsent: (type: keyof CookieConsent) => consent?.[type] ?? false,
    isEssential: consent?.essential ?? true,
    isFunctional: consent?.functional ?? false,
    isAnalytics: consent?.analytics ?? false,
    isMarketing: consent?.marketing ?? false,
  };
}

