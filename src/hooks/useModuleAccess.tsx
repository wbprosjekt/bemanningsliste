'use client';

import { useAuth } from './useAuth';

/**
 * Hook for å sjekke tilgang til moduler basert på organisasjonens subscription
 * Brukes for å vise/skjule moduler i navigasjon og beskytte ruter
 */
export const useModuleAccess = () => {
  const { profile } = useAuth();

  /**
   * Sjekk om brukerens org har tilgang til en modul
   * Pro/Enterprise planer har tilgang til alt
   */
  const hasModule = (moduleName: string): boolean => {
    if (!profile?.org) return false;

    const org = profile.org as { 
      subscription_plan?: string; 
      modules?: string[];
    };

    // Pro og Enterprise har tilgang til alle moduler
    if (org.subscription_plan === 'pro' || org.subscription_plan === 'enterprise') {
      return true;
    }

    // Sjekk om modulen er i org's modules array
    return org.modules?.includes(moduleName) || false;
  };

  // Convenience properties for spesifikke moduler
  const canAccessBefaring = hasModule('befaring');
  const canAccessHMS = hasModule('hms');

  return {
    hasModule,
    canAccessBefaring,
    canAccessHMS,
  };
};

