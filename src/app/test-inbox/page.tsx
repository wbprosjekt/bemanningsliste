'use client';

import React, { useState, useEffect } from 'react';
import PhotoInbox from '@/components/PhotoInbox';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export default function TestInboxPage() {
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

  if (!orgId) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <p>Laster...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Test Photo Inbox</h1>
        
        <PhotoInbox orgId={orgId} projectId={null} />
      </div>
    </div>
  );
}

