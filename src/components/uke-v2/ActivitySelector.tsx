'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Search } from 'lucide-react';

interface ActivitySelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (activity: any) => void;
  projectId: string;
}

export default function ActivitySelector({ open, onClose, onSelect, projectId }: ActivitySelectorProps) {
  const [activities, setActivities] = useState<any[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadActivities();
    }
  }, [open, projectId]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = activities.filter(activity =>
        activity.navn.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredActivities(filtered);
    } else {
      setFilteredActivities(activities);
    }
  }, [searchQuery, activities]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ttx_activity_cache')
        .select('*')
        .order('navn');

      if (error) throw error;
      setActivities(data || []);
      setFilteredActivities(data || []);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>Velg aktivitet</SheetTitle>
        </SheetHeader>

        {/* Search */}
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Søk etter aktivitet..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Activities List */}
        <div className="mt-4 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {loading ? (
            <div className="text-center py-8 text-gray-400">Laster aktiviteter...</div>
          ) : filteredActivities.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              {searchQuery ? 'Ingen aktiviteter funnet' : 'Ingen aktiviteter tilgjengelig'}
            </div>
          ) : (
            filteredActivities.map((activity) => (
              <button
                key={activity.id}
                onClick={() => onSelect(activity)}
                className="w-full p-4 bg-gray-50 hover:bg-gray-100 rounded-lg text-left transition-colors flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-purple-600 flex-shrink-0"></div>
                <div className="font-medium text-gray-900">
                  {activity.navn}
                </div>
              </button>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

