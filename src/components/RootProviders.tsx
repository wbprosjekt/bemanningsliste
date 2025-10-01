"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as ShadcnToaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/useAuth";
import NavigationWrapper from "@/components/NavigationWrapper";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface RootProvidersProps {
  children: React.ReactNode;
}

export default function RootProviders({ children }: RootProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <NavigationWrapper />
            <ShadcnToaster />
            <Sonner />
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {children as any}
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
