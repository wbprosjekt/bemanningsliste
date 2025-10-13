'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import BefaringDetail from '@/components/befaring/BefaringDetail';
import { supabase } from '@/integrations/supabase/client';

export default function BefaringDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          router.push('/auth');
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('*, org(*)')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        setProfile(data);
      } catch (error) {
        console.error('Error loading profile:', error);
        router.push('/befaring');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [router]);

  const handleBack = () => {
    router.push('/befaring');
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!profile || !profile.org_id) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <p className="text-muted-foreground">Kunne ikke laste profil.</p>
          <button onClick={handleBack} className="mt-4 text-blue-600 hover:underline">
            Tilbake til befaringer
          </button>
        </div>
      </div>
    );
  }

  return (
    <BefaringDetail
      befaringId={id as string}
      orgId={profile.org_id}
      userId={profile.user_id}
      onBack={handleBack}
    />
  );
}