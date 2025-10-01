"use client";

import { useAuth } from "@/hooks/useAuth";
import AdminNavigation from "./AdminNavigation";
import EmployeeNavigation from "./EmployeeNavigation";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  user_id: string;
  fornavn: string;
  etternavn: string;
  role: string;
  org_id: string;
}

export default function NavigationWrapper() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
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
        .single();

      if (error) {
        console.error('Error loading profile:', error);
        setProfile(null);
      } else {
        setProfile(profileData);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  // Don't show navigation on auth page
  if (pathname === "/auth") {
    return null;
  }

  // Show loading state while auth or profile is loading
  if (loading || profileLoading) {
    return (
      <nav className="bg-gray-800 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="text-xl font-bold">Bemanningsliste</div>
            <div className="text-sm text-gray-300">Laster...</div>
          </div>
        </div>
      </nav>
    );
  }

  // If not authenticated, don't show navigation
  if (!user || !profile) {
    return null;
  }

  // Determine if user is admin based on profile role or access to admin pages
  const isAdmin = profile.role === "admin" || profile.role === "manager";

  // Render appropriate navigation based on role
  if (isAdmin) {
    return <AdminNavigation profile={profile} />;
  } else {
    return <EmployeeNavigation profile={profile} />;
  }
}
