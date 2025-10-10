"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import OnboardingDialog from "@/components/OnboardingDialog";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "admin" | "leder" | "manager" | "any-admin";
  requireProfile?: boolean; // New: require profile check
}

/**
 * ProtectedRoute Component
 * 
 * Beskytter sider mot uautorisert tilgang og manglende profil.
 * 
 * @param requiredRole - Påkrevd rolle for tilgang:
 *   - "admin": Kun admin
 *   - "leder" eller "manager": Kun leder/manager
 *   - "any-admin": Admin, leder eller manager (default)
 * @param requireProfile - Krever at bruker har profil (default: true)
 * 
 * Hvis bruker mangler profil → vis onboarding
 * Hvis bruker har rolle "user" → redirect til /min/uke
 */
export default function ProtectedRoute({ 
  children, 
  requiredRole = "any-admin",
  requireProfile = true
}: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<{ role: string; org_id: string } | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [checking, setChecking] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [timeoutReached, setTimeoutReached] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      // If user just logged out, immediately redirect without checking profile
      if (!user) {
        console.log('🔒 ProtectedRoute: User logged out, redirecting to /auth');
        router.replace('/auth');
        setChecking(false);
        setProfileLoading(false);
        return;
      }
      loadProfileAndCheck();
    }
  }, [user, authLoading]);

  // Timeout to prevent infinite loading
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (authLoading || profileLoading || checking) {
        console.warn('⚠️ ProtectedRoute: Timeout reached, forcing completion');
        setTimeoutReached(true);
        setChecking(false);
        setProfileLoading(false);
        
        // Force redirect to prevent infinite loop
        if (!user) {
          router.replace('/auth');
        } else {
          router.replace('/min/uke');
        }
      }
    }, 8000); // Reduced to 8 seconds for faster recovery

    return () => clearTimeout(timeoutId);
  }, [authLoading, profileLoading, checking, user, router]);

  const loadProfileAndCheck = async () => {
    console.log('🔒 ProtectedRoute: Starting loadProfileAndCheck for user:', user?.email);
    
    if (!user) {
      // Ikke innlogget → redirect til auth
      console.log('🔒 ProtectedRoute: No user, redirecting to /auth');
      setChecking(false);
      setProfileLoading(false);
      router.replace('/auth');
      return;
    }

    try {
      setProfileLoading(true);
      console.log('🔒 ProtectedRoute: Loading profile for user:', user.id);
      
      // Add timeout to prevent hanging
      const profilePromise = supabase
        .from('profiles')
        .select('role, org_id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile loading timeout')), 5000)
      );
      
      const { data: profileData, error } = await Promise.race([profilePromise, timeoutPromise]) as any;

      console.log('🔒 ProtectedRoute: Profile loaded:', { profileData, error });

      // CRITICAL: Check if profile exists
      if (error && error.code !== 'PGRST116') {
        console.error('🔒 Error loading profile:', error);
        setChecking(false);
        setProfileLoading(false);
        router.replace('/auth');
        return;
      }

      if (!profileData) {
        // NO PROFILE FOUND - Show onboarding if required
        console.warn('🔒 ProtectedRoute: No profile found for user', user.email);
        
        if (requireProfile) {
          console.log('🔒 Showing onboarding dialog');
          setShowOnboarding(true);
          setChecking(false);
          setProfileLoading(false);
          return;
        } else {
          // If profile not required, redirect to auth
          console.log('🔒 Profile not required, redirecting to auth');
          setChecking(false);
          setProfileLoading(false);
          router.replace('/auth');
          return;
        }
      }

      const userRole = profileData.role || 'user';
      setProfile({ role: userRole, org_id: profileData.org_id });

      // Sjekk tilgang basert på rolle
      const hasAccess = checkAccess(userRole, requiredRole);

      console.log('🔒 ProtectedRoute check:', {
        pathname,
        userRole,
        requiredRole,
        hasAccess,
        hasProfile: true
      });

      if (!hasAccess) {
        console.log(`🚫 Access denied for role "${userRole}" on ${pathname}`);
        setChecking(false);
        setProfileLoading(false);
        router.replace('/min/uke');
      } else {
        console.log(`✅ Access granted for role "${userRole}" on ${pathname}`);
        setChecking(false);
        setProfileLoading(false);
      }
    } catch (error) {
      console.error('Error in ProtectedRoute:', error);
      setChecking(false);
      setProfileLoading(false);
      router.replace('/auth');
    }
  };

  /**
   * Sjekker om brukerens rolle har tilgang
   */
  const checkAccess = (userRole: string, required: string): boolean => {
    // Admin har alltid full tilgang
    if (userRole === 'admin') return true;

    // Manager/leder har tilgang til "any-admin" sider
    if (required === 'any-admin' && (userRole === 'manager' || userRole === 'leder')) {
      return true;
    }

    // Spesifikk rolle-sjekk
    if (required === 'admin' && userRole !== 'admin') return false;
    if ((required === 'leder' || required === 'manager') && userRole !== 'admin' && userRole !== 'manager' && userRole !== 'leder') {
      return false;
    }

    // User har IKKE tilgang til admin-sider
    if (userRole === 'user') return false;

    return true;
  };

  // Handle onboarding if no profile
  const handleOnboardingComplete = async () => {
    console.log('🔒 Onboarding completed, reloading profile');
    setShowOnboarding(false);
    setChecking(true);
    // Reload profile after onboarding
    await loadProfileAndCheck();
  };

  // Show onboarding dialog if profile is missing
  if (showOnboarding) {
    return <OnboardingDialog onComplete={handleOnboardingComplete} />;
  }

  // Vis loading mens vi sjekker
  if (authLoading || profileLoading || checking) {
    console.log('🔒 ProtectedRoute: Loading state', { authLoading, profileLoading, checking });
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verifiserer tilgang...</p>
          <p className="text-xs text-muted-foreground mt-2">
            Auth: {authLoading ? 'Loading' : 'Done'} | 
            Profile: {profileLoading ? 'Loading' : 'Done'} | 
            Check: {checking ? 'Checking' : 'Done'}
            {timeoutReached && ' | ⚠️ Timeout'}
          </p>
        </div>
      </div>
    );
  }

  // Hvis vi kom hit, har brukeren tilgang
  return <>{children}</>;
}

