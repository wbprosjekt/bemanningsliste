"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { 
  Search, 
  Star, 
  Plus,
  Filter,
  Building
} from 'lucide-react';
import TagPhotoDialog from '@/components/TagPhotoDialog';
import MoveToProjectDialog from '@/components/fri-befaring/MoveToProjectDialog';
import GlobalSearchBar from '@/components/GlobalSearchBar';

interface Project {
  id: string;
  tripletex_project_id: number;
  project_name: string;
  project_number: number;
  customer_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ProjectStats {
  total_projects: number;
  active_projects: number;
  recent_projects: number;
  untagged_photos: number;
  untagged_befaringer: number;
}

interface ProjectWithActivity extends Project {
  activity_score: number;
  recent_activities: number;
}

interface UntaggedPhoto {
  id: string;
  image_url: string;
  prosjekt_id: string | null;
  inbox_date: string;
  comment: string | null;
  project_name?: string;
  project_number?: string;
}

interface UntaggedBefaring {
  id: string;
  title: string;
  description: string | null;
  befaring_date: string | null;
  created_at: string;
  status: 'aktiv' | 'signert' | 'arkivert';
}

export default function ProjectDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  
  console.log('🔄 ProjectDashboard: Profile state:', { 
    profile: profile ? { 
      org_id: profile.org_id, 
      role: profile.role,
      fornavn: profile.fornavn 
    } : null 
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [mostActiveProjects, setMostActiveProjects] = useState<ProjectWithActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState<ProjectStats>({
    total_projects: 0,
    active_projects: 0,
    recent_projects: 0,
    untagged_photos: 0,
    untagged_befaringer: 0
  });
  const [untaggedPhotos, setUntaggedPhotos] = useState<UntaggedPhoto[]>([]);
  const [untaggedBefaringer, setUntaggedBefaringer] = useState<UntaggedBefaring[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [selectedBefaringer, setSelectedBefaringer] = useState<Set<string>>(new Set());
  const [showBulkTagDialog, setShowBulkTagDialog] = useState(false);
  const [showBulkMoveDialog, setShowBulkMoveDialog] = useState(false);

  // Load profile when user is available
  useEffect(() => {
    if (user) {
      loadProfileData();
    }
  }, [user]);

  const loadProfileData = async () => {
    if (!user) return;
    
    try {
      setProfileLoading(true);
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('❌ ProjectDashboard: Error loading profile:', error);
        setProfile(null);
      } else if (profileData) {
        console.log('✅ ProjectDashboard: Profile loaded:', {
          org_id: profileData.org_id,
          role: profileData.role
        });
        setProfile({
          ...profileData,
          role: profileData.role || 'user',
          org_id: profileData.org_id
        });
      }
    } catch (error) {
      console.error('❌ ProjectDashboard: Error loading profile:', error);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const loadMostActiveProjects = async (projects: Project[]) => {
    try {
      // Get activity data for each project from the last 7 days
      const projectIds = projects.map(p => p.id);
      
      // Query project_activity table for recent activities
      const { data: activities, error: activityError } = await supabase
        .from('project_activity')
        .select(`
          project_id,
          activity_type,
          created_at
        `)
        .in('project_id', projectIds)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .order('created_at', { ascending: false });

      if (activityError) {
        console.warn('Could not load project activities:', activityError);
        // Fallback: use projects as-is without activity data
        setMostActiveProjects(projects.slice(0, 3).map(p => ({
          ...p,
          activity_score: 0,
          recent_activities: 0
        })));
        return;
      }

      // Calculate activity scores
      const activityMap = new Map<string, number>();
      activities?.forEach(activity => {
        const current = activityMap.get(activity.project_id || '') || 0;
        // Weight different activity types
        const weight = activity.activity_type.includes('image') ? 1 : 
                      activity.activity_type.includes('befaring') ? 3 : 
                      activity.activity_type.includes('oppgave') ? 2 : 1;
        activityMap.set(activity.project_id || '', current + weight);
      });

      // Create project with activity data
      const projectsWithActivity: ProjectWithActivity[] = projects
        .map(project => ({
          ...project,
          activity_score: activityMap.get(project.id) || 0,
          recent_activities: activities?.filter(a => a.project_id === project.id).length || 0
        }))
        .sort((a, b) => b.activity_score - a.activity_score)
        .slice(0, 3); // Top 3 most active

      console.log('✅ Loaded most active projects:', projectsWithActivity.length);
      setMostActiveProjects(projectsWithActivity);

    } catch (error) {
      console.error('Error loading most active projects:', error);
      // Fallback: use first 3 projects
      setMostActiveProjects(projects.slice(0, 3).map(p => ({
        ...p,
        activity_score: 0,
        recent_activities: 0
      })));
    }
  };

  const loadProjects = async () => {
    if (!profile?.org_id) {
      console.log('❌ ProjectDashboard: No profile.org_id available, waiting...', { profile });
      return;
    }
    
    console.log('🔄 ProjectDashboard: Loading projects for org_id:', profile.org_id);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ttx_project_cache')
        .select('*')
        .eq('org_id', profile.org_id)
        .eq('is_active', true)
        .order('project_name');

      if (error) throw error;
      
      const sanitizedProjects: Project[] = (data || []).map((project: any) => ({
        id: project.id,
        tripletex_project_id: project.tripletex_project_id ?? 0,
        project_name: project.project_name ?? 'Uten navn',
        project_number: project.project_number ?? 0,
        customer_name: project.customer_name,
        is_active: project.is_active ?? false,
        created_at: project.created_at ?? new Date().toISOString(),
        updated_at: project.updated_at ?? new Date().toISOString(),
      }));
      
      console.log('✅ ProjectDashboard: Loaded projects:', sanitizedProjects.length);
      setProjects(sanitizedProjects);
      setFilteredProjects(sanitizedProjects);

      // Load most active projects with activity data
      await loadMostActiveProjects(sanitizedProjects);
      
      // Load untagged photos with project info
      const { data: untaggedPhotosData, error: countError } = await supabase
        .from('oppgave_bilder')
        .select(`
          id,
          image_url,
          prosjekt_id,
          inbox_date,
          comment,
          oppgave_id,
          befaring_punkt_id,
          ttx_project_cache:prosjekt_id(org_id, project_name, project_number)
        `)
        .is('is_tagged', false)
        .order('inbox_date', { ascending: false })
        .limit(12); // Top 12 for dashboard preview
      
      // Filter by org_id and check if photo is truly untagged
      const filteredUntaggedPhotos = (untaggedPhotosData || []).filter((photo: any) => {
        // A photo is untagged if BOTH oppgave_id AND befaring_punkt_id are NULL
        if (photo.oppgave_id || photo.befaring_punkt_id) {
          return false; // Skip photos that are already tagged to an oppgave or befaring punkt
        }
        
        // If photo has prosjekt_id, check if it matches org
        if (photo.prosjekt_id && photo.ttx_project_cache?.org_id) {
          return photo.ttx_project_cache.org_id === profile.org_id;
        }
        
        // Include photos without project
        return true;
      });

      // Transform data for display
      const transformedPhotos: UntaggedPhoto[] = filteredUntaggedPhotos.map((photo: any) => ({
        id: photo.id,
        image_url: photo.image_url,
        prosjekt_id: photo.prosjekt_id,
        inbox_date: photo.inbox_date,
        comment: photo.comment,
        project_name: photo.ttx_project_cache?.project_name || null,
        project_number: photo.ttx_project_cache?.project_number || null
      }));

      setUntaggedPhotos(transformedPhotos);
      const untaggedPhotosCount = filteredUntaggedPhotos.length;
      
      // Load untagged befaringer
      const { data: untaggedBefaringerData, error: befaringerError } = await supabase
        .from('fri_befaringer' as any)
        .select(`
          id,
          title,
          description,
          befaring_date,
          created_at,
          status
        `)
        .eq('org_id', profile.org_id)
        .is('tripletex_project_id', null)
        .eq('status', 'aktiv')
        .order('created_at', { ascending: false })
        .limit(6); // Top 6 for dashboard preview

      if (befaringerError) {
        console.warn('Could not load untagged befaringer:', befaringerError);
      } else {
        const transformedBefaringer: UntaggedBefaring[] = (untaggedBefaringerData || []).map((befaring: any) => ({
          id: befaring.id,
          title: befaring.title,
          description: befaring.description,
          befaring_date: befaring.befaring_date,
          created_at: befaring.created_at,
          status: befaring.status
        }));
        setUntaggedBefaringer(transformedBefaringer);
      }
      
      // Calculate stats
      setStats({
        total_projects: sanitizedProjects.length,
        active_projects: sanitizedProjects.filter(p => p.is_active).length,
        recent_projects: sanitizedProjects.filter(p => {
          const daysSinceUpdate = (Date.now() - new Date(p.updated_at).getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceUpdate <= 7;
        }).length,
        untagged_photos: untaggedPhotosCount || 0,
        untagged_befaringer: untaggedBefaringerData?.length || 0
      });
    } catch (error) {
      console.error('❌ ProjectDashboard: Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.org_id) {
      loadProjects();
    } else {
      console.log('🔄 ProjectDashboard: Waiting for profile.org_id...');
    }
  }, [profile?.org_id]);

  // Polling for project updates (free alternative to Realtime)
  useEffect(() => {
    if (!profile?.org_id) return;

    console.log('🔄 Setting up polling for project updates');
    
    const interval = setInterval(() => {
      console.log('🔄 Polling for project updates...');
      loadProjects();
    }, 60000); // Poll every 60 seconds (less frequent for dashboard)

    return () => {
      console.log('🔄 Cleaning up polling');
      clearInterval(interval);
    };
  }, [profile?.org_id]);

  // Also try to load when profile changes from null to having data
  useEffect(() => {
    if (profile && profile.org_id && projects.length === 0) {
      console.log('🔄 ProjectDashboard: Profile loaded, attempting to load projects...');
      loadProjects();
    }
  }, [profile]);

  useEffect(() => {
    const filtered = projects.filter(project =>
      project.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.project_number.toString().includes(searchTerm) ||
      project.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredProjects(filtered);
  }, [searchTerm, projects]);

  if (profileLoading || loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">
              {profileLoading ? 'Laster profil...' : 'Laster prosjekter...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header - Kondensert versjon */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">🏗️ FieldNote Dashboard</h1>
          <p className="text-muted-foreground">
            Oversikt over alle aktive prosjekter
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Ny befaring
          </Button>
        </div>
      </div>

      {/* 🔍 GLOBAL SEARCH - Supersøk */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col space-y-4 md:flex-row md:items-center md:space-y-0 md:space-x-4">
            <div className="flex-1">
              <GlobalSearchBar 
                className="w-full"
                placeholder="Søk i alle prosjekter, befaringer og brukere..."
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-1" />
                Filter
              </Button>
              <Button variant="outline" size="sm">
                <Star className="h-4 w-4 mr-1" />
                Favoritter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 🚨 KREVER HANDLING - Øverst som prioritert */}
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-700 flex items-center">
            🚨 KREVER HANDLING ({stats.untagged_photos + stats.untagged_befaringer} ting) 
            <Button variant="link" className="ml-auto text-red-600">
              Vis alle →
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-red-600">🔴</span>
            <span className="text-xs">Kritiske oppgaver som krever oppmerksomhet</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-yellow-600">🟡</span>
            <span className="text-xs">Befaringer som trenger planlegging</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-orange-600">📷</span>
            <span className="text-xs">{stats.untagged_photos} bilder venter på tagging</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-blue-600">📋</span>
            <span className="text-xs">{stats.untagged_befaringer} befaringer venter på prosjekt</span>
          </div>
        </CardContent>
      </Card>

      {/* 📷 FOTO-INNBOKS - Hybrid strategi */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="text-orange-700 flex items-center">
            📷 FOTO-INNBOKS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats.untagged_photos > 0 ? (
            <div className="space-y-3">
              
              {/* Show untagged photos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Uten prosjekt: {stats.untagged_photos} bilder</span>
                  <div className="flex items-center space-x-2">
                    {selectedPhotos.size > 0 && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs"
                        onClick={() => setShowBulkTagDialog(true)}
                      >
                        Tag {selectedPhotos.size} bilder
                      </Button>
                    )}
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="text-orange-600 text-xs"
                      onClick={() => router.push('/photo-inbox')}
                    >
                      Se alle →
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-6 gap-2">
                  {untaggedPhotos.slice(0, 6).map((photo) => (
                    <div
                      key={photo.id}
                      className={`aspect-square rounded border-2 overflow-hidden relative group cursor-pointer ${
                        selectedPhotos.has(photo.id) 
                          ? 'border-orange-500 bg-orange-100' 
                          : 'border-orange-200 hover:border-orange-300'
                      }`}
                      onClick={() => {
                        const newSelected = new Set(selectedPhotos);
                        if (newSelected.has(photo.id)) {
                          newSelected.delete(photo.id);
                        } else {
                          newSelected.add(photo.id);
                        }
                        setSelectedPhotos(newSelected);
                      }}
                    >
                      <img
                        src={photo.image_url}
                        alt="Untagged photo"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.backgroundColor = '#f3f4f6';
                          e.currentTarget.style.display = 'flex';
                          e.currentTarget.style.alignItems = 'center';
                          e.currentTarget.style.justifyContent = 'center';
                          e.currentTarget.innerHTML = '📷';
                        }}
                      />
                      
                      {/* Selection checkbox */}
                      <div className="absolute top-1 left-1">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                          selectedPhotos.has(photo.id)
                            ? 'bg-orange-500 border-orange-500 text-white'
                            : 'bg-white border-gray-300'
                        }`}>
                          {selectedPhotos.has(photo.id) && '✓'}
                        </div>
                      </div>
                      
                      {/* Quick actions - vises på hover */}
                      <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-1">
                        <button
                          className="w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-green-600 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPhotos(new Set([photo.id]));
                            setShowBulkTagDialog(true);
                          }}
                          title="Tag til prosjekt"
                        >
                          🏷️
                        </button>
                        <button
                          className="w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Delete photo
                            console.log('Delete photo:', photo.id);
                          }}
                          title="Slett bilde"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="text-xs text-muted-foreground">
                Klikk for å velge bilder, eller hover for hurtigtagging
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="text-sm text-muted-foreground">
                Ingen utaggede bilder - alt er organisert! 🎉
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 📋 UNTAGGED BEFARINGER - Tilsvarende foto-innboks */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-700 flex items-center">
            📋 UNTAGGED BEFARINGER
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats.untagged_befaringer > 0 ? (
            <div className="space-y-3">
              
              {/* Show untagged befaringer */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Uten prosjekt: {stats.untagged_befaringer} befaringer</span>
                  <div className="flex items-center space-x-2">
                    {selectedBefaringer.size > 0 && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs"
                        onClick={() => setShowBulkMoveDialog(true)}
                      >
                        Flytt {selectedBefaringer.size} til prosjekt
                      </Button>
                    )}
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="text-blue-600 text-xs"
                      onClick={() => router.push('/befaring?filter=uten_prosjekt')}
                    >
                      Se alle →
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {untaggedBefaringer.slice(0, 6).map((befaring) => (
                    <div
                      key={befaring.id}
                      className={`p-3 rounded border-2 cursor-pointer transition-colors group ${
                        selectedBefaringer.has(befaring.id) 
                          ? 'border-blue-500 bg-blue-100' 
                          : 'border-blue-200 hover:border-blue-300 bg-white'
                      }`}
                      onClick={() => {
                        const newSelected = new Set(selectedBefaringer);
                        if (newSelected.has(befaring.id)) {
                          newSelected.delete(befaring.id);
                        } else {
                          newSelected.add(befaring.id);
                        }
                        setSelectedBefaringer(newSelected);
                      }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-sm line-clamp-1">{befaring.title}</h4>
                        <div className={`w-3 h-3 rounded-full flex items-center justify-center text-xs ${
                          selectedBefaringer.has(befaring.id)
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200'
                        }`}>
                          {selectedBefaringer.has(befaring.id) && '✓'}
                        </div>
                      </div>
                      
                      {befaring.description && (
                        <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                          {befaring.description}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{befaring.befaring_date ? new Date(befaring.befaring_date).toLocaleDateString('no-NO') : 'Ikke satt'}</span>
                        <span className="capitalize">{befaring.status}</span>
                      </div>
                      
                      {/* Quick actions - vises på hover */}
                      <div className="mt-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoveToProjectDialog
                          befaringId={befaring.id}
                          befaringTitle={befaring.title}
                          currentProjectId={null}
                          onSuccess={() => {
                            // Reload data after successful move
                            if (profile?.org_id) {
                              loadProjects();
                            }
                          }}
                        >
                          <button
                            className="flex-1 px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            🏷️ Flytt til prosjekt
                          </button>
                        </MoveToProjectDialog>
                        <button
                          className="px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/fri-befaring/${befaring.id}`);
                          }}
                        >
                          👁️ Se
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="text-xs text-muted-foreground">
                Klikk for å velge befaringer, eller hover for hurtigflytting
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="text-sm text-muted-foreground">
                Ingen untaggede befaringer - alt er organisert! 🎉
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 📊 KPI OVERVIEW - Kondensert versjon */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📊 KPI OVERVIEW</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.active_projects}</div>
              <div className="text-sm text-muted-foreground">Aktive</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">-</div>
              <div className="text-sm text-muted-foreground">Oppgaver</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">-</div>
              <div className="text-sm text-muted-foreground">Befaringer</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.untagged_photos}</div>
              <div className="text-sm text-muted-foreground">Bilder</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.untagged_befaringer}</div>
              <div className="text-sm text-muted-foreground">Untagged</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ⭐ FAVORITTER & MEST AKTIVE */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">⭐ FAVORITTER & MEST AKTIVE</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Favoritter chips */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">⭐ Favoritter</div>
            <div className="flex flex-wrap gap-2">
              {projects.slice(0, 4).map((project) => (
                  <Button 
                    key={project.id}
                    variant="outline" 
                    size="sm" 
                    className="bg-blue-50 border-blue-200"
                    onClick={() => router.push(`/prosjekt/${project.id}`)}
                  >
                    <Star className="h-4 w-4 mr-1 text-blue-600" />
                    {project.project_name}
                  </Button>
              ))}
              {projects.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  Ingen favoritter satt ennå
                </div>
              )}
            </div>
          </div>
          
          {/* Mest aktive prosjekter */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">🔥 Mest aktive prosjekter (7 dager)</div>
            <div className="space-y-1">
              {mostActiveProjects.map((project, index) => (
                <div 
                  key={project.id} 
                  className="flex items-center justify-between p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => router.push(`/prosjekt/${project.id}`)}
                >
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{index + 1}. {project.project_name}</span>
                    {project.activity_score > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {project.recent_activities} aktiviteter
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {project.activity_score > 0 ? `${project.activity_score} pts` : 'Ingen aktivitet'}
                  </span>
                  <Button 
                    variant="link" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/prosjekt/${project.id}`);
                    }}
                  >
                    Velg →
                  </Button>
                </div>
              ))}
              {mostActiveProjects.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  Ingen aktivitet de siste 7 dagene
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 📋 ALLE PROSJEKTER - Kondensert versjon */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">📋 ALLE PROSJEKTER ({stats.total_projects})</h2>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Søk..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-48"
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-1" />
              Filter
            </Button>
            <Button variant="outline" size="sm">
              Sorter: Aktivitet
            </Button>
          </div>
        </div>
      </div>

      {/* Projects */}
      {filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Ingen prosjekter funnet</h3>
            <p className="text-muted-foreground text-center">
              {searchTerm 
                ? `Ingen prosjekter matcher "${searchTerm}"`
                : "Ingen aktive prosjekter funnet"
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredProjects.slice(0, 10).map((project) => (
            <Card 
              key={project.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/prosjekt/${project.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <Star className="h-4 w-4 text-blue-600" />
                      <span className="font-medium">{project.project_name}</span>
                    </div>
                    <Badge variant="outline">#{project.project_number}</Badge>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <span>📊 Aktivt prosjekt</span>
                    <span>📷 {stats.untagged_photos} bilder</span>
                    <Button 
                      variant="link" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/prosjekt/${project.id}`);
                      }}
                    >
                      Se detaljer →
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {filteredProjects.length > 10 && (
            <Card>
              <CardContent className="p-4 text-center">
                <Button variant="outline">
                  Vis {filteredProjects.length - 10} flere...
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Bulk Tag Dialog */}
      {showBulkTagDialog && selectedPhotos.size > 0 && (
        <TagPhotoDialog
          open={showBulkTagDialog}
          onOpenChange={(open) => {
            setShowBulkTagDialog(open);
            if (!open) {
              setSelectedPhotos(new Set());
            }
          }}
          photo={untaggedPhotos.find(p => selectedPhotos.has(p.id)) || untaggedPhotos[0]}
          orgId={profile?.org_id}
          photoIds={Array.from(selectedPhotos)}
          onSuccess={() => {
            setSelectedPhotos(new Set());
            setShowBulkTagDialog(false);
            loadProjects(); // Reload photos after tagging
          }}
        />
      )}

      {/* Bulk Move Dialog for Befaringer */}
      {showBulkMoveDialog && selectedBefaringer.size > 0 && (
        <MoveToProjectDialog
          befaringId={Array.from(selectedBefaringer)[0]} // Use first selected for dialog
          befaringTitle={`${selectedBefaringer.size} befaringer`}
          currentProjectId={null}
          onSuccess={() => {
            setSelectedBefaringer(new Set());
            setShowBulkMoveDialog(false);
            loadProjects(); // Reload befaringer after moving
          }}
        >
          <div /> {/* Hidden trigger */}
        </MoveToProjectDialog>
      )}
    </div>
  );
}
