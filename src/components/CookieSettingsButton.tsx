"use client";

import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCookieConsent } from "@/components/providers/CookieConsentProvider";

export function CookieSettingsButton() {
  const { openSettings, showBanner, showSettings } = useCookieConsent();

  if (showBanner || showSettings) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-40">
      <Button variant="outline" size="sm" onClick={openSettings} className="shadow-md">
        <Shield className="h-3.5 w-3.5 mr-2" />
        Cookie-innstillinger
      </Button>
    </div>
  );
}
