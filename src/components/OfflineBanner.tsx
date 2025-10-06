"use client";

import { useState, useEffect } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { WifiOff, Wifi } from 'lucide-react';

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [showOnlineMessage, setShowOnlineMessage] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    }
    
    if (isOnline && wasOffline) {
      // Show "back online" message for 3 seconds
      setShowOnlineMessage(true);
      const timer = setTimeout(() => {
        setShowOnlineMessage(false);
        setWasOffline(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // Show offline banner
  if (!isOnline) {
    return (
      <div className="sticky top-0 z-50 bg-yellow-500 text-black px-4 py-3 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
          <WifiOff className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium text-center">
            Du er offline - koble til internett for å lagre timer
          </p>
        </div>
      </div>
    );
  }

  // Show "back online" message briefly
  if (showOnlineMessage) {
    return (
      <div className="sticky top-0 z-50 bg-green-500 text-white px-4 py-3 shadow-md animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
          <Wifi className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium text-center">
            ✅ Du er online igjen!
          </p>
        </div>
      </div>
    );
  }

  // Don't render anything when online (after message fades)
  return null;
}

