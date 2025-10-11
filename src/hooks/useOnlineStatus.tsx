import { useState, useEffect } from 'react';

/**
 * Hook for å detektere online/offline status
 * Brukes for å vise offline banner og disable funksjoner som krever nett
 */
export const useOnlineStatus = (): boolean => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    // Event handlers
    const handleOnline = () => {
      console.log('✅ Network: Online');
      setIsOnline(true);
    };

    const handleOffline = () => {
      console.warn('⚠️ Network: Offline');
      setIsOnline(false);
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};
