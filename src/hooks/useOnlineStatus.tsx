import { useState, useEffect } from 'react';

/**
 * Hook for å detektere online/offline status
 * Brukes for å vise offline banner og disable funksjoner som krever nett
 * 
 * Kombinerer navigator.onLine med faktisk nettverkssjekk for mer robust deteksjon
 */
export const useOnlineStatus = (): boolean => {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    // Faktisk nettverkssjekk
    const checkOnline = async () => {
      try {
        // Prøv å hente en liten fil fra CDN (Google favicon)
        // Bruker no-cors mode for å unngå CORS-problemer
        await fetch('https://www.google.com/favicon.ico', {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-cache'
        });
        
        if (!isOnline) {
          console.log('✅ Network: Online (verified)');
        }
        setIsOnline(true);
      } catch (error) {
        console.warn('⚠️ Network: Offline (verified)', error);
        setIsOnline(false);
      }
    };

    // Event handlers for navigator.onLine (rask respons)
    const handleOnline = () => {
      console.log('✅ Network: Online (navigator)');
      // Verifiser med faktisk sjekk
      checkOnline();
    };

    const handleOffline = () => {
      console.warn('⚠️ Network: Offline (navigator)');
      setIsOnline(false);
    };

    // Initial check
    checkOnline();

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Sjekk hvert 30. sekund for å fange opp endringer
    const interval = setInterval(checkOnline, 30000);

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [isOnline]);

  return isOnline;
};
