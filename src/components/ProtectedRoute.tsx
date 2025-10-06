"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "admin" | "leder" | "manager" | "any-admin";
}

/**
 * ProtectedRoute Component
 * 
 * Beskytter admin-sider mot uautorisert tilgang.
 * 
 * @param requiredRole - Påkrevd rolle for tilgang:
 *   - "admin": Kun admin
 *   - "leder" eller "manager": Kun leder/manager
 *   - "any-admin": Admin, leder eller manager (default)
 * 
 * Hvis bruker har rolle "user" → redirect til /min/uke
 */
export default function ProtectedRoute({ 
  children, 
  requiredRole = "any-admin" 
}: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<{ role: string } | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [checking, setChecking] = useState(true);

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

  const loadProfileAndCheck = async () => {
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
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error loading profile:', error);
        setChecking(false);
        setProfileLoading(false);
        router.replace('/auth');
        return;
      }

      const userRole = profileData?.role || 'user';
      setProfile({ role: userRole });

      // Sjekk tilgang basert på rolle
      const hasAccess = checkAccess(userRole, requiredRole);

      console.log('🔒 ProtectedRoute check:', {
        pathname,
        userRole,
        requiredRole,
        hasAccess
      });

      if (!hasAccess) {
        console.log(`🚫 Access denied for role "${userRole}" on ${pathname}`);
        router.replace('/min/uke');
      } else {
        console.log(`✅ Access granted for role "${userRole}" on ${pathname}`);
      }
    } catch (error) {
      console.error('Error in ProtectedRoute:', error);
      setChecking(false);
      setProfileLoading(false);
      router.replace('/auth');
    } finally {
      setProfileLoading(false);
      setChecking(false);
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

  // Vis loading mens vi sjekker
  if (authLoading || profileLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verifiserer tilgang...</p>
        </div>
      </div>
    );
  }

  // Hvis vi kom hit, har brukeren tilgang
  return <>{children}</>;
}

