'use client';

import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface OppgaveImageCountProps {
  oppgaveId: string;
}

export default function OppgaveImageCount({ oppgaveId }: OppgaveImageCountProps) {
  const [imageCount, setImageCount] = useState<number>(0);

  useEffect(() => {
    const loadImageCount = async () => {
      try {
        const { count, error } = await supabase
          .from('oppgave_bilder')
          .select('*', { count: 'exact', head: true })
          .eq('oppgave_id', oppgaveId);

        if (error) throw error;
        setImageCount(count || 0);
      } catch (error) {
        console.error('Error loading image count:', error);
      }
    };

    loadImageCount();
  }, [oppgaveId]);

  if (imageCount === 0) return null;

  return (
    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
      <ImageIcon className="h-3 w-3 mr-1" />
      {imageCount} {imageCount === 1 ? 'bilde' : 'bilder'}
    </Badge>
  );
}
