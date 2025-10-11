'use client';

import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WifiOff, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Banner som vises når brukeren er offline
 * Vises øverst på siden med varsel om at enkelte funksjoner ikke er tilgjengelige
 */
export const OfflineBanner = () => {
  const isOnline = useOnlineStatus();
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    }

    if (isOnline && wasOffline) {
      // Vis "Tilkoblet igjen" melding i 3 sekunder
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // Vis "Tilkoblet igjen" melding
  if (showReconnected) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 animate-in slide-in-from-top-2 duration-300">
        <Alert className="rounded-none border-green-500 bg-green-50 text-green-900">
          <Wifi className="h-4 w-4" />
          <AlertDescription className="ml-2">
            <strong>Tilkoblet igjen!</strong> Du er nå online.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Vis offline banner
  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 animate-in slide-in-from-top-2 duration-300">
        <Alert 
          variant="destructive" 
          className="rounded-none border-amber-500 bg-amber-50 text-amber-900"
        >
          <WifiOff className="h-4 w-4" />
          <AlertDescription className="ml-2">
            <strong>Du er offline.</strong> Enkelte funksjoner er ikke tilgjengelige uten internett.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return null;
};
