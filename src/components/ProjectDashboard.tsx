"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { 
  Search, 
  Star, 
  Clock, 
  Building, 
  Plus,
  Filter,
  Grid3X3,
  List,
  Calendar,
  Image as ImageIcon,
  AlertCircle
} from 'lucide-react';
import PhotoInboxMini from '@/components/PhotoInboxMini';

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
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [stats, setStats] = useState<ProjectStats>({
    total_projects: 0,
    active_projects: 0,
    recent_projects: 0,
    untagged_photos: 0
  });
  const [showPhotoInbox, setShowPhotoInbox] = useState(false);

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
      
      // Load untagged photos count
      // Note: oppgave_bilder doesn't have org_id, so we need to count via join
      const { data: untaggedPhotos, error: countError } = await supabase
        .from('oppgave_bilder')
        .select(`
          id,
          oppgave_id,
          ttx_project_cache:prosjekt_id(org_id)
        `)
        .is('is_tagged', false);  // Use .is() for boolean false
      
      // Filter by org_id and check if photo is truly untagged
      const untaggedCount = (untaggedPhotos || []).filter((photo: any) => {
        // A photo is untagged if oppgave_id is NULL
        if (photo.oppgave_id) {
          return false; // Skip photos that are already tagged to an oppgave
        }
        
        // If photo has prosjekt_id, check if it matches org
        if (photo.prosjekt_id && photo.ttx_project_cache?.org_id) {
          return photo.ttx_project_cache.org_id === profile.org_id;
        }
        
        // Include photos without project
        return true;
      }).length;
      
      // Calculate stats
      setStats({
        total_projects: sanitizedProjects.length,
        active_projects: sanitizedProjects.filter(p => p.is_active).length,
        recent_projects: sanitizedProjects.filter(p => {
          const daysSinceUpdate = (Date.now() - new Date(p.updated_at).getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceUpdate <= 7;
        }).length,
        untagged_photos: untaggedCount || 0
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
      {/* Header */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Prosjekt Dashboard</h1>
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

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totalt prosjekter</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_projects}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktive prosjekter</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active_projects}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nylig oppdatert</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recent_projects}</div>
          </CardContent>
        </Card>
        
        <Card 
          className={`cursor-pointer hover:shadow-md transition-shadow ${stats.untagged_photos > 0 ? 'border-orange-500 bg-orange-50' : ''}`}
          onClick={() => setShowPhotoInbox(!showPhotoInbox)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utaggede bilder</CardTitle>
            <ImageIcon className={`h-4 w-4 ${stats.untagged_photos > 0 ? 'text-orange-600' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{stats.untagged_photos}</div>
              {stats.untagged_photos > 0 && (
                <AlertCircle className="h-4 w-4 text-orange-600" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Photo Inbox Section */}
      {showPhotoInbox && profile && (
        <PhotoInboxMini 
          orgId={profile.org_id} 
          projectId={null}
          maxPhotos={6}
          onViewAll={() => router.push('/photo-inbox')}
        />
      )}

      {/* Search and Filters */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søk prosjekter..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
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
        <div className={viewMode === 'grid' 
          ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" 
          : "space-y-4"
        }>
          {filteredProjects.map((project) => (
            <Card key={project.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">
                      {project.project_name}
                    </CardTitle>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Badge variant="outline">
                        #{project.project_number}
                      </Badge>
                      {project.customer_name && (
                        <span>• {project.customer_name}</span>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary">
                    Aktiv
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Oppdatert {new Date(project.updated_at).toLocaleDateString('no-NO')}
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm">
                      <Calendar className="h-4 w-4 mr-2" />
                      Befaringer
                    </Button>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Oppgaver
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
