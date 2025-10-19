'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook for å sjekke tilgang til moduler basert på organisasjonens subscription
 * Brukes for å vise/skjule moduler i navigasjon og beskytte ruter
 */
interface OrgModuleInfo {
  subscription_plan?: string | null;
  modules?: string[] | null;
}

export const useModuleAccess = () => {
  const { user } = useAuth();
  const [orgInfo, setOrgInfo] = useState<OrgModuleInfo | null>(null);

  useEffect(() => {
    const loadOrgInfo = async () => {
      if (!user) {
        setOrgInfo(null);
        return;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profileData?.org_id) {
        setOrgInfo(null);
        return;
      }

      const { data: orgData } = await supabase
        .from('org')
        .select('subscription_plan, modules')
        .eq('id', profileData.org_id)
        .maybeSingle();

      setOrgInfo(orgData ?? null);
    };

    loadOrgInfo();
  }, [user]);

  /**
   * Sjekk om brukerens org har tilgang til en modul
   * Pro/Enterprise planer har tilgang til alt
   */
  const hasModule = (moduleName: string): boolean => {
    if (!orgInfo) return false;

    // Pro og Enterprise har tilgang til alle moduler
    if (orgInfo.subscription_plan === 'pro' || orgInfo.subscription_plan === 'enterprise') {
      return true;
    }

    // Sjekk om modulen er i org's modules array
    return orgInfo.modules?.includes(moduleName) || false;
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
