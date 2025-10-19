'use client';

import React, { useState, useEffect } from 'react';
import ProjectPhotoUpload from '@/components/ProjectPhotoUpload';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export default function TestUploadPage() {
  const [showUpload, setShowUpload] = useState(false);
  const [orgId, setOrgId] = useState<string>('');
  const { user } = useAuth();

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('user_id', user.id)
        .single();
      
      if (data) {
        setOrgId(data.org_id);
      }
    };
    
    loadProfile();
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Test Photo Upload</h1>
        
        {!orgId ? (
          <p>Laster...</p>
        ) : (
          <>
            <Button onClick={() => setShowUpload(true)}>
              Åpne Photo Upload
            </Button>

            {showUpload && (
              <ProjectPhotoUpload
                open={showUpload}
                onOpenChange={setShowUpload}
                orgId={orgId}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

