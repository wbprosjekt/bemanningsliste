"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as ShadcnToaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/useAuth";
import NavigationWrapper from "@/components/NavigationWrapper";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineBanner } from "@/components/OfflineBanner";
import { CookieConsentProvider } from "@/components/providers/CookieConsentProvider";
import { CookieSettingsButton } from "@/components/CookieSettingsButton";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import { FEATURE_GLOBAL_NAV } from "@/config";

interface RootProvidersProps {
  children: React.ReactNode;
}

export default function RootProviders({ children }: RootProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data is considered fresh for 1 minute
            staleTime: 60 * 1000,
            // Cache data for 5 minutes
            gcTime: 5 * 60 * 1000,
            // Retry failed requests 3 times
            retry: 3,
            // Retry with exponential backoff
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            // Refetch on window focus
            refetchOnWindowFocus: true,
            // Don't refetch on mount if data is fresh
            refetchOnMount: false,
            // Refetch on reconnect
            refetchOnReconnect: true,
          },
          mutations: {
            // Retry failed mutations once
            retry: 1,
            // Retry delay for mutations
            retryDelay: 1000,
          },
        },
      })
  );

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <CookieConsentProvider>
              {!FEATURE_GLOBAL_NAV && <NavigationWrapper />}
              <OfflineBanner />
              <CookieConsentBanner />
              <CookieSettingsButton />
              <ShadcnToaster />
              <Sonner />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {children as any}
            </CookieConsentProvider>
          </TooltipProvider>
        </AuthProvider>
        {/* React Query DevTools - only in development */}
        <ReactQueryDevtools initialIsOpen={false} position="bottom" />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
