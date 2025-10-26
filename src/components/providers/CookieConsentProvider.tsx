"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export interface CookieConsentState {
  essential: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
  version: string;
}

const CONSENT_STORAGE_KEY = "cookie-consent";
const CONSENT_VERSION = "2025-01";
const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 12 months
const FUNCTIONAL_STORAGE_KEYS = [
  "user-preferences",
  "ui-state",
  "fieldnote_recent_searches",
  "weather-history",
  "rotation-tip-dismissed",
];
const FUNCTIONAL_STORAGE_PREFIXES = ["client:"];
const FUNCTIONAL_COOKIES = ["sidebar:state"];

type ConsentInput = Pick<CookieConsentState, "essential" | "functional" | "analytics" | "marketing">;

interface CookieConsentContextValue {
  consent: CookieConsentState | null;
  effectiveConsent: CookieConsentState;
  isReady: boolean;
  showBanner: boolean;
  showSettings: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  requireBanner: () => void;
  saveConsent: (consent: ConsentInput) => void;
  acceptEssential: () => void;
  acceptAll: () => void;
  hasFunctionalConsent: () => boolean;
  hasAnalyticsConsent: () => boolean;
  hasMarketingConsent: () => boolean;
  doNotTrack: boolean;
}

const DEFAULT_CONSENT: CookieConsentState = {
  essential: true,
  functional: false,
  analytics: false,
  marketing: false,
  timestamp: new Date().toISOString(),
  version: CONSENT_VERSION,
};

const CookieConsentContext = createContext<CookieConsentContextValue | undefined>(undefined);

declare global {
  interface Window {
    __cookieConsent?: CookieConsentState;
  }
}

function isDoNotTrackEnabled() {
  if (typeof window === "undefined") {
    return false;
  }
  const dnt = ((window as unknown as { doNotTrack?: string }).doNotTrack || 
               (navigator as unknown as { doNotTrack?: string })?.doNotTrack || 
               (navigator as unknown as { msDoNotTrack?: string })?.msDoNotTrack) ?? "0";
  return dnt === "1" || dnt === "yes";
}

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<CookieConsentState | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [doNotTrack, setDoNotTrack] = useState(false);

  const loadStoredConsent = useCallback(() => {
    if (typeof window === "undefined") {
      return null;
    }
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!stored) return null;

    try {
      const parsed = JSON.parse(stored) as CookieConsentState;
      const timestampOk = Date.now() - new Date(parsed.timestamp).getTime() < CONSENT_MAX_AGE_MS;
      if (parsed.version === CONSENT_VERSION && timestampOk) {
        return parsed;
      }
    } catch (error) {
      console.error("Failed to parse stored cookie consent", error);
    }
    return null;
  }, []);

  useEffect(() => {
    setDoNotTrack(isDoNotTrackEnabled());
    const stored = loadStoredConsent();
    if (stored) {
      setConsent(stored);
      setShowBanner(false);
    } else {
      setConsent(DEFAULT_CONSENT);
      setShowBanner(true);
    }
    setIsReady(true);
  }, [loadStoredConsent]);

  const effectiveConsent = useMemo(() => {
    if (doNotTrack) {
      return {
        ...(consent ?? DEFAULT_CONSENT),
        functional: false,
        analytics: false,
        marketing: false,
      };
    }
    return consent ?? DEFAULT_CONSENT;
  }, [consent, doNotTrack]);

  const persistConsent = useCallback((nextConsent: CookieConsentState) => {
    setConsent(nextConsent);
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(nextConsent));
  }, []);

  const saveConsent = useCallback(
    (next: ConsentInput) => {
      const consentWithMeta: CookieConsentState = {
        ...next,
        timestamp: new Date().toISOString(),
        version: CONSENT_VERSION,
      };
      persistConsent(consentWithMeta);
      setShowBanner(false);
      setShowSettings(false);
    },
    [persistConsent],
  );

  const acceptEssential = useCallback(() => {
    saveConsent({
      essential: true,
      functional: false,
      analytics: false,
      marketing: false,
    });
  }, [saveConsent]);

  const acceptAll = useCallback(() => {
    saveConsent({
      essential: true,
      functional: true,
      analytics: true,
      marketing: true,
    });
  }, [saveConsent]);

  const openSettings = useCallback(() => {
    setShowSettings(true);
    setShowBanner(false);
  }, []);

  const closeSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  const requireBanner = useCallback(() => {
    setShowBanner(true);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    window.__cookieConsent = effectiveConsent;
    window.dispatchEvent(
      new CustomEvent("cookie-consent-changed", {
        detail: effectiveConsent,
      }),
    );
  }, [effectiveConsent, isReady]);

  const purgeFunctionalStorage = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      FUNCTIONAL_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (FUNCTIONAL_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
          localStorage.removeItem(key);
        }
      }
      FUNCTIONAL_COOKIES.forEach((cookieName) => {
        document.cookie = `${cookieName}=; Max-Age=0; path=/`;
      });
    } catch (error) {
      console.error("Failed to purge functional storage", error);
    }
  }, []);

  useEffect(() => {
    if (isReady && !effectiveConsent.functional) {
      purgeFunctionalStorage();
    }
  }, [effectiveConsent.functional, isReady, purgeFunctionalStorage]);

  const contextValue = useMemo<CookieConsentContextValue>(
    () => ({
      consent,
      effectiveConsent,
      isReady,
      showBanner,
      showSettings,
      openSettings,
      closeSettings,
      requireBanner,
      saveConsent,
      acceptEssential,
      acceptAll,
      hasFunctionalConsent: () => effectiveConsent.functional,
      hasAnalyticsConsent: () => effectiveConsent.analytics,
      hasMarketingConsent: () => effectiveConsent.marketing,
      doNotTrack,
    }),
    [
      consent,
      effectiveConsent,
      isReady,
      showBanner,
      showSettings,
      openSettings,
      closeSettings,
      requireBanner,
      saveConsent,
      acceptEssential,
      acceptAll,
      doNotTrack,
    ],
  );

  return <CookieConsentContext.Provider value={contextValue}>{children}</CookieConsentContext.Provider>;
}

export function useCookieConsentContext() {
  const context = useContext(CookieConsentContext);
  if (!context) {
    throw new Error("useCookieConsentContext must be used within CookieConsentProvider");
  }
  return context;
}

export const useCookieConsent = useCookieConsentContext;
