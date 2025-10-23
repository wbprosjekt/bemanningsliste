'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import WeekCalendar from '@/components/uke-v2/WeekCalendar';
import DayView from '@/components/uke-v2/DayView';
import TimeEntrySheet from '@/components/uke-v2/TimeEntrySheet';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText } from 'lucide-react';
import FriBefaringDialog from '@/components/fri-befaring/FriBefaringDialog';

export default function UkeV2Page() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [showBefaringDialog, setShowBefaringDialog] = useState(false);

  const year = parseInt(params.year as string);
  const week = parseInt(params.week as string);

  // Load profile
  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    
    try {
      // Get profile to find org_id
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (profileError) throw profileError;
      if (!profileData) return;
      
      // Find person by email matching user email
      const { data: personData, error: personError } = await supabase
        .from('person')
        .select('*')
        .eq('epost', user.email || '')
        .eq('org_id', profileData.org_id)
        .single();
      
      if (personError) {
        console.error('Error loading person:', personError);
        return;
      }
      
      // Combine profile and person data
      setProfile({
        ...profileData,
        ...personData,
        person_id: personData.id
      });
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!user) {
      router.push('/auth');
    }
  }, [user, router]);

  if (!user || !profile) {
    return null;
  }

  const handleDayClick = (date: string) => {
    setSelectedDate(date);
    setIsSheetOpen(true);
  };

  const handleCloseSheet = () => {
    setIsSheetOpen(false);
    setSelectedDate(null);
  };

  const handleBefaringSuccess = () => {
    setShowBefaringDialog(false);
    // Optionally refresh data or show success message
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold">
              Uke: {week}
            </h1>
            <div className="w-10" /> {/* Spacer for centering */}
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('week')}
              className={`
                flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors
                ${viewMode === 'week' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
                }
              `}
            >
              Uke
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`
                flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors
                ${viewMode === 'day' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
                }
              `}
            >
              Dag
            </button>
          </div>
        </div>
      </div>

      {/* Content - Week or Day View */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {viewMode === 'week' ? (
          <WeekCalendar
            year={year}
            week={week}
            personId={profile.person_id || profile.id}
            orgId={profile.org_id}
            onDayClick={handleDayClick}
          />
        ) : (
          <DayView
            year={year}
            week={week}
            personId={profile.person_id || profile.id}
            orgId={profile.org_id}
            onAddEntry={handleDayClick}
          />
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 safe-area-pb">
        <div className="max-w-7xl mx-auto space-y-3">
          {/* Ny befaring knapp */}
          <Button 
            className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-full text-lg font-medium"
            onClick={() => setShowBefaringDialog(true)}
          >
            <FileText className="mr-2 h-5 w-5" />
            Ny befaring
          </Button>
          
          {/* Ferdig knapp */}
          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-full text-lg font-medium"
            onClick={() => router.push('/min/uke')}
          >
            <span className="mr-2">☑</span> Ferdig
          </Button>
        </div>
      </div>

      {/* Time Entry Sheet */}
      {selectedDate && (
        <TimeEntrySheet
          open={isSheetOpen}
          onClose={handleCloseSheet}
          date={selectedDate}
          personId={profile.person_id || profile.id}
          orgId={profile.org_id}
        />
      )}

      {/* Fri Befaring Dialog */}
      {showBefaringDialog && (
        <FriBefaringDialog
          orgId={profile.org_id}
          userId={profile.user_id}
          onSuccess={handleBefaringSuccess}
          onClose={() => setShowBefaringDialog(false)}
        />
      )}
    </div>

