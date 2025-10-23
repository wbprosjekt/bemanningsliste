'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { OfflineBanner } from '@/components/OfflineBanner';
import BefaringList from '@/components/befaring/BefaringList';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  user_id: string;
  role: string | null;
  org_id: string;
  org?: {
    id: string;
    subscription_plan?: string | null;
    modules?: string[] | null;
  } | null;
}

/**
 * Hovedside for Befaringsverktøyet
 * Viser liste over befaringer hvis bruker har tilgang
 */
export default function BefaringPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Load profile data when user changes
  useEffect(() => {
    if (user) {
      loadProfile();
    } else {
      setProfile(null);
      setProfileLoading(false);
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    
    try {
      setProfileLoading(true);
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading profile:', error);
        setProfile(null);
      } else if (profileData) {
        // Fetch org data separately
        const { data: orgData } = await supabase
          .from('org')
          .select('id')
          .eq('id', profileData.org_id)
          .single();

        setProfile({
          ...profileData,
          org: orgData || { id: profileData.org_id }
        });
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  // Redirect til login hvis ikke innlogget
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth');
    }
  }, [user, loading, router]);

  // Loading state
  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-sm text-gray-600">Laster...</p>
        </div>
      </div>
    );
  }

  // Ikke innlogget
  if (!user || !profile) {
    return null;
  }

  // Sjekk tilgang til befaring-modul
  // MIDLERTIDIG: Alle brukere har tilgang for testing
  // TODO: Legg til modul-basert tilgang når subscription_plan og modules er implementert
  const canAccessBefaring = true; // profile.role === 'admin' || profile.role === 'manager' || profile.role === 'leder';

  // Ingen tilgang til befaring-modul
  if (!canAccessBefaring) {
    return (
      <>
        <OfflineBanner />
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                <Lock className="h-8 w-8 text-amber-600" />
              </div>
              <CardTitle className="text-2xl font-bold">
                Befaringsverktøy
              </CardTitle>
              <CardDescription className="text-base">
                Dette er en premiumfunksjon
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 text-center">
              <div className="space-y-3">
                <p className="text-sm text-gray-700">
                  Oppgrader til <span className="font-semibold">Starter + Befaring</span> eller{' '}
                  <span className="font-semibold">Pro</span> for å få tilgang til:
                </p>
                <ul className="space-y-2 text-left mx-auto max-w-sm">
                  <li className="flex items-start gap-2">
                    <Sparkles className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Ubegrenset antall befaringer</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Sparkles className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Multiple plantegninger per befaring</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Sparkles className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Oppgaver med markører på plantegning</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Sparkles className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Kanban board for oppgavehåndtering</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Sparkles className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">E-post til underleverandører</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Sparkles className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">PDF-rapport med digital signatur</span>
                  </li>
                </ul>
              </div>

              <div className="pt-4 space-y-3">
                <div className="bg-white rounded-lg p-4 border-2 border-amber-300">
                  <p className="text-xs text-gray-600 mb-1">Pris</p>
                  <p className="text-2xl font-bold text-gray-900">
                    +499 kr<span className="text-base font-normal text-gray-600">/måned</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Legges til Starter-abonnement</p>
                </div>

                <Button 
                  size="lg" 
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                  onClick={() => {
                    // TODO: Implementer oppgraderingsdialog
                    alert('Kontakt support for oppgradering: support@bemanningsliste.no');
                  }}
                >
                  Oppgrader nå
                </Button>

                <p className="text-xs text-gray-500">
                  Har du spørsmål? Kontakt oss på{' '}
                  <a href="mailto:support@bemanningsliste.no" className="text-amber-600 hover:underline">
                    support@bemanningsliste.no
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  // Har tilgang - vis befaringsliste
  return (
    <>
      <OfflineBanner />
      <div className="min-h-screen bg-gray-50">
        <BefaringList orgId={profile.org_id} userId={user.id} />
      </div>
    </>
  );
}
