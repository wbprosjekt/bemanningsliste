'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, 
  Calendar, 
  Users, 
  Image as ImageIcon, 
  FileText, 
  MapPin,
  Star,
  Settings,
  Plus,
  Trash2,
  Building,
  User,
  Phone,
  Mail
} from 'lucide-react';
import ImageGallery from '@/components/ImageGallery';

interface Project {
  id: string;
  project_name: string | null;
  project_number: number | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
  org_id: string;
  customer_name: string | null;
  tripletex_project_id: number | null;
  last_synced: string | null;
}

interface TripletexProjectDetails {
  id: number;
  name: string;
  number: string;
  customer: {
    id: number;
    name: string;
    email?: string;
    phoneNumber?: string;
  };
  projectManager: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber?: string;
  };
  startDate: string;
  endDate?: string;
  status: string;
  isActive: boolean;
  isClosed: boolean;
  displayName: string;
  description?: string;
}

interface ProjectStats {
  total_befaringer: number;
  total_oppgaver: number;
  total_bilder: number;
  untagged_bilder: number;
}

interface Activity {
  id: string;
  type: 'befaring' | 'oppgaver' | 'bilde';
  title: string;
  description?: string | null;
  status?: string;
  created_at: string | null;
  updated_at: string | null;
}

interface ProjectPhoto {
  id: string;
  image_url: string;
  uploaded_by: string | null;
  uploaded_by_email: string | null;
  created_at: string | null;
  oppgave_id: string | null;
  prosjekt_id: string | null;
  oppgave_info?: {
    id: string;
    title: string | null;
    fag: string | null;
    status: string | null;
    oppgave_nummer: number | null;
  };
}

interface ProjectComment {
  id: string;
  comment: string;
  created_by: string | null;
  created_by_name: string;
  created_at: string | null;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [tripletexDetails, setTripletexDetails] = useState<TripletexProjectDetails | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<ProjectStats>({
    total_befaringer: 0,
    total_oppgaver: 0,
    total_bilder: 0,
    untagged_bilder: 0
  });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [projectPhotos, setProjectPhotos] = useState<ProjectPhoto[]>([]);
  const [photosByCategory, setPhotosByCategory] = useState<{
    untagged: ProjectPhoto[];
    befaringer: { [key: string]: ProjectPhoto[] };
    oppgaver: { [key: string]: ProjectPhoto[] };
  }>({
    untagged: [],
    befaringer: {},
    oppgaver: {}
  });
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Image Gallery state
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState<ProjectPhoto[]>([]);
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);
  const [galleryOppgaveInfo, setGalleryOppgaveInfo] = useState<any>(null);

  const projectId = params.projectId as string;

  useEffect(() => {
    if (user && projectId) {
      loadProjectData();
      loadProfile();
    }
  }, [user, projectId]);

  const loadProfile = async () => {
    if (!user) return;
    
    try {
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading profile:', error);
      } else if (profileData) {
        setProfile(profileData);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadComments = async () => {
    try {
      console.log('🔍 Loading comments for project:', projectId);
      
      const { data: commentsData, error: commentsError } = await supabase
        .from('project_activity')
        .select(`
          id,
          description,
          created_by,
          created_at
        `)
        .eq('project_id', projectId)
        .eq('activity_type', 'comment')
        .order('created_at', { ascending: false });

      if (commentsError) {
        console.error('❌ Could not load project comments:', commentsError);
      } else {
        console.log('✅ Comments loaded:', commentsData);
        // Get user names separately since we can't join with profiles directly
        const userIds = [...new Set((commentsData || []).map(c => c.created_by).filter(id => id !== null))] as string[];
        console.log('🔍 User IDs to lookup:', userIds);
        
        const { data: usersData } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', userIds);

        console.log('✅ User data loaded:', usersData);
        const userMap = new Map(usersData?.map(u => [u.user_id, u.display_name || 'Ukjent bruker']) || []);

        const formattedComments: ProjectComment[] = (commentsData || []).map(comment => {
          let userName = comment.created_by ? userMap.get(comment.created_by) : null;
          
          return {
            id: comment.id,
            comment: comment.description || '',
            created_by: comment.created_by,
            created_by_name: userName || 'Ukjent bruker',
            created_at: comment.created_at
          };
        });
        console.log('🗑️ Setting comments state:', formattedComments.length, 'comments');
        setComments(formattedComments);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const loadProjectStatsWithData = async (projectData: Project) => {
    try {
      // Count befaringer (both regular and fri befaring)
      const [befaringerResult, friBefaringerResult] = await Promise.all([
        supabase
          .from('befaringer')
          .select('*', { count: 'exact', head: true })
          .eq('tripletex_project_id', projectData.tripletex_project_id!),
        
        supabase
          .from('fri_befaringer')
          .select('*', { count: 'exact', head: true })
          .eq('tripletex_project_id', projectData.tripletex_project_id!)
      ]);

      const totalBefaringer = (befaringerResult.count || 0) + (friBefaringerResult.count || 0);

      // Count oppgaver from both regular befaringer and fri befaringer
      const [regularOppgaverResult, friOppgaverResult] = await Promise.all([
        // Oppgaver from regular befaringer (step-by-step approach)
        (async () => {
          // First get befaringer for this project
          const { data: befaringerData } = await supabase
            .from('befaringer')
            .select('id')
            .eq('tripletex_project_id', projectData.tripletex_project_id!);
          
          if (!befaringerData || befaringerData.length === 0) {
            return { count: 0 };
          }
          
          // Then get plantegninger for these befaringer
          const befaringIds = befaringerData.map(b => b.id);
          const { data: plantegningerData } = await supabase
            .from('plantegninger')
            .select('id')
            .in('befaring_id', befaringIds);
          
          if (!plantegningerData || plantegningerData.length === 0) {
            return { count: 0 };
          }
          
          // Finally count oppgaver for these plantegninger
          const plantegningIds = plantegningerData.map(p => p.id);
          const { count } = await supabase
            .from('oppgaver')
            .select('*', { count: 'exact', head: true })
            .in('plantegning_id', plantegningIds);
          
          return { count: count || 0 };
        })(),
        
        // Oppgaver from fri befaringer (via befaring_punkter -> fri_befaringer)
        supabase
          .from('befaring_oppgaver')
          .select(`
            id,
            befaring_punkter!inner(
              fri_befaringer:befaring_punkter.fri_befaring_id(
                tripletex_project_id
              )
            )
          `, { count: 'exact', head: true })
          .eq('befaring_punkter.fri_befaringer.tripletex_project_id', projectData.tripletex_project_id!)
      ]);

      const totalOppgaver = (regularOppgaverResult.count || 0) + (friOppgaverResult.count || 0);

      // Count all project images
      const { count: totalBilderCount, error: totalBilderError } = await supabase
        .from('oppgave_bilder')
        .select('*', { count: 'exact', head: true })
        .eq('prosjekt_id', projectData.id);

      // Count untagged project images
      const { count: untaggedBilderCount, error: untaggedBilderError } = await supabase
        .from('oppgave_bilder')
        .select('*', { count: 'exact', head: true })
        .eq('prosjekt_id', projectData.id)
        .is('oppgave_id', null);

      setStats({
        total_befaringer: totalBefaringer,
        total_oppgaver: totalOppgaver,
        total_bilder: totalBilderCount || 0,
        untagged_bilder: untaggedBilderCount || 0
      });

    } catch (error) {
      console.error('Error loading project stats:', error);
      // Fallback to placeholder data
      setStats({
        total_befaringer: 0,
        total_oppgaver: 0,
        total_bilder: 0,
        untagged_bilder: 0
      });
    }
  };

  const loadProjectData = async () => {
    try {
      setLoading(true);

      // Load project details
      const { data: projectData, error: projectError } = await supabase
        .from('ttx_project_cache')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);

      // Load Tripletex project details if we have a tripletex_project_id
      if (projectData.tripletex_project_id) {
        try {
          const { data: tripletexData, error: tripletexError } = await supabase.functions.invoke('tripletex-api', {
            body: {
              action: 'get_project_details',
              project_id: projectData.tripletex_project_id,
              orgId: projectData.org_id
            }
          });

          if (!tripletexError && tripletexData?.success) {
            setTripletexDetails(tripletexData.data);
          }
        } catch (error) {
          console.error('Error loading Tripletex details:', error);
          // Don't throw - this is not critical
        }
      }

      // Load project stats with real data (pass projectData directly)
      await loadProjectStatsWithData(projectData);

      // Load ALL project photos from multiple sources:
      // 1. Direct project photos (prosjekt_id)
      // 2. Befaring photos (via oppgave -> plantegning -> befaring -> tripletex_project_id)
      
      // First: Direct project photos with oppgave info
      const { data: directPhotosData, error: directPhotosError } = await supabase
        .from('oppgave_bilder')
        .select(`
          id,
          image_url,
          uploaded_by,
          uploaded_by_email,
          created_at,
          oppgave_id,
          prosjekt_id,
          oppgaver(
            id,
            title,
            fag,
            status,
            oppgave_nummer
          )
        `)
        .eq('prosjekt_id', projectData.id)
        .order('created_at', { ascending: false });

      // Second: Get befaring photos via RPC function or simpler approach
      // For now, let's get all photos that have oppgave_id and check if they belong to this project
      const { data: befaringPhotosData, error: befaringPhotosError } = await supabase
        .from('oppgave_bilder')
        .select(`
          id,
          image_url,
          uploaded_by,
          uploaded_by_email,
          created_at,
          oppgave_id,
          prosjekt_id,
          oppgaver!inner(
            id,
            title,
            fag,
            status,
            oppgave_nummer,
            plantegning_id,
            plantegninger!inner(
              id,
              befaring_id,
              befaringer!inner(
                id,
                tripletex_project_id
              )
            )
          )
        `)
        .not('oppgave_id', 'is', null)
        .eq('oppgaver.plantegninger.befaringer.tripletex_project_id', projectData.tripletex_project_id!)
        .order('created_at', { ascending: false });

      // Combine both results
      const allPhotosData = [
        ...(directPhotosData || []),
        ...(befaringPhotosData || [])
      ];
      
      const photosError = directPhotosError || befaringPhotosError;

      if (photosError) {
        console.warn('Could not load project photos:', photosError);
      } else {
        setProjectPhotos(allPhotosData);
        
        // Organize photos by category
        const organizedPhotos = {
          untagged: [] as ProjectPhoto[],
          befaringer: {} as { [key: string]: ProjectPhoto[] },
          oppgaver: {} as { [key: string]: ProjectPhoto[] }
        };

        allPhotosData.forEach(photo => {
          if (photo.oppgave_id) {
            // Photo belongs to an oppgave - add oppgave info
            const photoWithInfo = {
              ...photo,
              oppgave_info: photo.oppgaver ? {
                id: photo.oppgaver.id,
                title: photo.oppgaver.title,
                fag: photo.oppgaver.fag,
                status: photo.oppgaver.status,
                oppgave_nummer: photo.oppgaver.oppgave_nummer
              } : undefined
            };
            
            if (!organizedPhotos.oppgaver[photo.oppgave_id]) {
              organizedPhotos.oppgaver[photo.oppgave_id] = [];
            }
            organizedPhotos.oppgaver[photo.oppgave_id].push(photoWithInfo);
          } else {
            // Photo is untagged (belongs to project but not to specific task)
            // NOTE: For now, we don't have befaring_id in oppgave_bilder table
            // When befaringer are implemented, we'll need to add that column
            organizedPhotos.untagged.push(photo);
          }
        });

        setPhotosByCategory(organizedPhotos);
      }

      // Load project comments
      await loadComments();

      // Load recent activities from project_activity table
      const { data: activitiesData, error: activitiesError } = await supabase
        .from('project_activity')
        .select(`
          id,
          activity_type,
          description,
          created_at
        `)
        .eq('project_id', projectId)
        .neq('activity_type', 'comment') // Exclude comments from activity feed
        .order('created_at', { ascending: false })
        .limit(10);

      if (activitiesError) {
        console.warn('Could not load activities:', activitiesError);
        setActivities([]);
      } else {
        const formattedActivities: Activity[] = (activitiesData || []).map(activity => ({
          id: activity.id,
          type: activity.activity_type.includes('image') ? 'bilde' :
                activity.activity_type.includes('oppgave') ? 'oppgaver' :
                activity.activity_type.includes('befaring') ? 'befaring' : 'bilde',
          title: getActivityTitle(activity.activity_type),
          description: activity.description,
          created_at: activity.created_at,
          updated_at: activity.created_at // Use created_at since updated_at doesn't exist
        }));
        setActivities(formattedActivities);
      }

    } catch (error) {
      console.error('Error loading project data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityTitle = (activityType: string): string => {
    switch (activityType) {
      case 'image_uploaded':
        return 'Nytt bilde lagt til';
      case 'befaring_created':
        return 'Ny befaring opprettet';
      case 'befaring_completed':
        return 'Befaring fullført';
      case 'oppgave_created':
        return 'Ny oppgave opprettet';
      case 'oppgave_completed':
        return 'Oppgave fullført';
      case 'oppgave_updated':
        return 'Oppgave oppdatert';
      default:
        return 'Aktivitet';
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !user) return;

    try {
      console.log('🔍 Attempting to insert comment:', {
        project_id: projectId,
        org_id: project?.org_id,
        activity_type: 'comment',
        description: newComment.trim(),
        created_by: user.id
      });

      const { data, error } = await supabase
        .from('project_activity')
        .insert({
          project_id: projectId,
          org_id: project?.org_id,
          activity_type: 'comment',
          description: newComment.trim(),
          created_by: user.id
        })
        .select();

      if (error) {
        console.error('❌ Error inserting comment:', error);
        throw error;
      }

      console.log('✅ Comment inserted successfully:', data);

      // Refresh only comments, not entire page
      await loadComments();
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
      // Show user-friendly error message
      alert('Kunne ikke legge til kommentar. Sjekk konsollen for detaljer.');
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Er du sikker på at du vil slette dette bildet?')) return;

    try {
      const { error } = await supabase
        .from('oppgave_bilder')
        .delete()
        .eq('id', photoId);

      if (error) throw error;

      // Refresh photos
      await loadProjectData();
    } catch (error) {
      console.error('Error deleting photo:', error);
    }
  };

  const openImageGallery = (photos: ProjectPhoto[], initialIndex: number, oppgaveInfo?: any) => {
    setGalleryPhotos(photos);
    setGalleryInitialIndex(initialIndex);
    setGalleryOppgaveInfo(oppgaveInfo);
    setGalleryOpen(true);
  };

  const closeImageGallery = () => {
    setGalleryOpen(false);
    setGalleryPhotos([]);
    setGalleryInitialIndex(0);
    setGalleryOppgaveInfo(null);
  };

  const handleDeleteComment = async (commentId: string) => {
    console.log('🗑️ Attempting to delete comment:', commentId);
    console.log('🗑️ Current user:', user?.id);
    console.log('🗑️ Profile role:', profile?.role);
    
    if (!confirm('Er du sikker på at du vil slette denne kommentaren?')) {
      console.log('🗑️ Delete cancelled by user');
      return;
    }

    try {
      console.log('🗑️ Deleting comment from database...');
      
      // First, let's try to get the comment to see if it exists and who created it
      const { data: commentData, error: fetchError } = await supabase
        .from('project_activity')
        .select('id, created_by, project_id')
        .eq('id', commentId)
        .single();

      console.log('🗑️ Comment data:', commentData);
      console.log('🗑️ Fetch error:', fetchError);

      if (fetchError) {
        console.error('🗑️ Could not fetch comment:', fetchError);
        alert('Kunne ikke finne kommentaren.');
        return;
      }

      // Check if user is admin or if they created the comment
      const canDelete = profile?.role === 'admin' || commentData.created_by === user?.id;
      console.log('🗑️ Can delete?', canDelete, 'Admin:', profile?.role === 'admin', 'Owner:', commentData.created_by === user?.id);

      if (!canDelete) {
        alert('Du har ikke tilgang til å slette denne kommentaren. Kun admin eller kommentarens forfatter kan slette.');
        return;
      }

      // Try direct delete - RLS is likely blocking this
      const { data, error } = await supabase
        .from('project_activity')
        .delete()
        .eq('id', commentId)
        .select();

      console.log('🗑️ Delete result:', { data, error });

      if (error) {
        console.error('🗑️ Error deleting comment:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.warn('🗑️ No rows were deleted - RLS may be blocking the delete');
        alert('Kunne ikke slette kommentaren. RLS-policies blokkerer sletting.');
        return;
      }

      console.log('🗑️ Comment deleted successfully, reloading comments...');
      
      // Clear comments state first to force refresh
      setComments([]);
      
      // Reload comments
      await loadComments();
      
      console.log('🗑️ Comments reloaded after deletion');
    } catch (error) {
      console.error('🗑️ Error deleting comment:', error);
      alert('Kunne ikke slette kommentaren. Sjekk konsollen for detaljer.');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Prosjekt ikke funnet</h1>
          <Button onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Tilbake til dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div className="flex items-center space-x-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Tilbake
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {project.project_name || 'Unnamed Project'} #{project.project_number || 'N/A'}
            </h1>
            <div className="flex items-center space-x-2 mt-1">
              <Badge variant={project.is_active ? "default" : "secondary"}>
                {project.is_active ? "Aktivt" : "Inaktivt"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Opprettet {new Date(project.created_at).toLocaleDateString('no-NO')}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Star className="h-4 w-4 mr-2" />
            Favoritt
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Innstillinger
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Ny befaring
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground">Befaringer</p>
                <p className="text-lg font-semibold">{stats.total_befaringer}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">Oppgaver</p>
                <p className="text-lg font-semibold">{stats.total_oppgaver}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <ImageIcon className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-xs text-muted-foreground">Bilder</p>
                <p className="text-lg font-semibold">{stats.total_bilder}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <ImageIcon className="h-4 w-4 text-red-600" />
              <div>
                <p className="text-xs text-muted-foreground">Utaggede</p>
                <p className="text-lg font-semibold">{stats.untagged_bilder}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content - Stacked Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Activity Feed, Photo Library & Chat */}
        <div className="lg:col-span-2 space-y-6">
          {/* Aktivitetsfeed */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Aktivitetsfeed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activities.length > 0 ? (
                activities.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                    <div className="flex-shrink-0">
                      {activity.type === 'bilde' && <ImageIcon className="h-5 w-5 text-orange-600" />}
                      {activity.type === 'oppgaver' && <Calendar className="h-5 w-5 text-green-600" />}
                      {activity.type === 'befaring' && <FileText className="h-5 w-5 text-blue-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.title}</p>
                      {activity.description && (
                        <p className="text-xs text-muted-foreground mt-1">{activity.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {activity.created_at ? new Date(activity.created_at).toLocaleString('no-NO') : 'Ukjent dato'}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">Ingen aktivitet ennå</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Foto-bibliotek */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <ImageIcon className="h-5 w-5 mr-2 text-orange-600" />
                Foto-bibliotek ({projectPhotos.length} bilder)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {projectPhotos.length > 0 ? (
                <>
                  {/* Uten tilknytning */}
                  {photosByCategory.untagged.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-medium text-muted-foreground">📁 Uten tilknytning</h3>
                        <Badge variant="secondary">{photosByCategory.untagged.length} bilder</Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {photosByCategory.untagged.map((photo, index) => (
                          <div key={photo.id} className="relative group">
                            <img
                              src={photo.image_url}
                              alt="Project photo"
                              className="w-full h-24 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => openImageGallery(photosByCategory.untagged, index)}
                              title={`Uten tilknytning - ${photo.uploaded_by_email || 'Ukjent bruker'}`}
                            />
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button 
                                size="sm" 
                                variant="destructive" 
                                className="h-6 w-6 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePhoto(photo.id);
                                }}
                              >
                                🗑️
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Befaringer */}
                  {Object.keys(photosByCategory.befaringer).length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-medium text-muted-foreground">🏗️ Befaringer</h3>
                        <Badge variant="secondary">
                          {Object.values(photosByCategory.befaringer).reduce((sum, photos) => sum + photos.length, 0)} bilder
                        </Badge>
                      </div>
                      {Object.entries(photosByCategory.befaringer).map(([befaringId, photos]) => (
                        <div key={befaringId} className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-xs font-medium text-muted-foreground">
                              Befaring {befaringId.substring(0, 8)}...
                            </h4>
                            <Badge variant="outline" className="text-xs">{photos.length} bilder</Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {photos.map((photo) => (
                              <div key={photo.id} className="relative group">
                                <img
                                  src={photo.image_url}
                                  alt="Befaring photo"
                                  className="w-full h-24 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => {/* TODO: Open full-size view */}}
                                />
                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button 
                                    size="sm" 
                                    variant="destructive" 
                                    className="h-6 w-6 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeletePhoto(photo.id);
                                    }}
                                  >
                                    🗑️
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Oppgaver */}
                  {Object.keys(photosByCategory.oppgaver).length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-medium text-muted-foreground">✅ Oppgaver</h3>
                        <Badge variant="secondary">
                          {Object.values(photosByCategory.oppgaver).reduce((sum, photos) => sum + photos.length, 0)} bilder
                        </Badge>
                      </div>
                      {Object.entries(photosByCategory.oppgaver).map(([oppgaveId, photos]) => {
                        const firstPhoto = photos[0];
                        const oppgaveInfo = firstPhoto?.oppgave_info;
                        
                        return (
                          <div key={oppgaveId} className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <h4 className="text-xs font-medium text-muted-foreground">
                                {oppgaveInfo?.title || `Oppgave ${oppgaveId.substring(0, 8)}...`}
                              </h4>
                              {oppgaveInfo?.fag && (
                                <Badge variant="outline" className="text-xs">
                                  {oppgaveInfo.fag}
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs">{photos.length} bilder</Badge>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {photos.map((photo, index) => (
                                <div key={photo.id} className="relative group">
                                  <img
                                    src={photo.image_url}
                                    alt="Oppgave photo"
                                    className="w-full h-24 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => openImageGallery(photos, index, oppgaveInfo)}
                                    title={`${oppgaveInfo?.title || 'Oppgave'} - ${oppgaveInfo?.fag || 'Ukjent fag'} - ${photo.uploaded_by_email || 'Ukjent bruker'}`}
                                  />
                                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button 
                                      size="sm" 
                                      variant="destructive" 
                                      className="h-6 w-6 p-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeletePhoto(photo.id);
                                      }}
                                    >
                                      🗑️
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Ingen bilder i prosjektbiblioteket</p>
                  <p className="text-xs mt-1">Bilder tagget til prosjektet vises her</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Prosjekt-chat */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                💬 Prosjektkommentarer ({comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add new comment */}
              <div className="flex space-x-2">
                <Input
                  placeholder="Legg til kommentar..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                  className="flex-1"
                />
                <Button onClick={handleAddComment} disabled={!newComment.trim()}>
                  Legg til
                </Button>
              </div>

              {/* Comments list */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {comments.length > 0 ? (
                  comments.map((comment) => (
                    <div key={comment.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">
                        {comment.created_by_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium">{comment.created_by_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {comment.created_at ? new Date(comment.created_at).toLocaleString('no-NO') : 'Ukjent dato'}
                          </span>
                          </div>
                          {profile?.role === 'admin' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteComment(comment.id)}
                              title="Slett kommentar"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <p className="text-sm mt-1 break-words overflow-wrap-anywhere">{comment.comment}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <p className="text-sm">Ingen kommentarer ennå</p>
                    <p className="text-xs mt-1">Legg til kommentarer for dette prosjektet</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Quick Actions & Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Hurtighandlinger</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => router.push(`/befaring?project=${projectId}`)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Ny befaring
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => {/* TODO: Navigate to create oppgave */}}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Ny oppgave
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => router.push(`/photo-inbox?project=${projectId}`)}
              >
                <ImageIcon className="h-4 w-4 mr-2" />
                Last opp bilder
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => {/* TODO: Show on map */}}
              >
                <MapPin className="h-4 w-4 mr-2" />
                Vis på kart
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Prosjektinfo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Project Overview */}
              {tripletexDetails && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Prosjektnavn:</span>
                    <span className="text-sm break-words text-right">{tripletexDetails.displayName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Prosjektnummer:</span>
                    <span className="text-sm">{tripletexDetails.number}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Prosjekt-ID:</span>
                    <span className="text-sm">{tripletexDetails.id}</span>
                  </div>
                  
                  {tripletexDetails.description && (
                    <div className="w-full">
                      <span className="font-medium text-sm">Beskrivelse:</span>
                      <p className="text-sm text-muted-foreground mt-1 break-all overflow-wrap-anywhere word-break-break-all leading-relaxed whitespace-pre-wrap">{tripletexDetails.description}</p>
                    </div>
                  )}

                  {(tripletexDetails.startDate || tripletexDetails.endDate) && (
                    <div className="flex items-center gap-4 text-sm">
                      <Calendar className="h-4 w-4" />
                      <div className="flex gap-4">
                        {tripletexDetails.startDate && (
                          <div>
                            <span className="font-medium">Start:</span>
                            <span className="ml-1">{new Date(tripletexDetails.startDate).toLocaleDateString('no-NO')}</span>
                          </div>
                        )}
                        {tripletexDetails.endDate && (
                          <div>
                            <span className="font-medium">Slutt:</span>
                            <span className="ml-1">{new Date(tripletexDetails.endDate).toLocaleDateString('no-NO')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Customer Information */}
              {tripletexDetails?.customer && (
                <div className="space-y-3 pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    <span className="font-medium text-sm">Kundeinformasjon</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Kunde:</span>
                    <span className="text-sm">{tripletexDetails.customer.name}</span>
                  </div>
                  
                  {tripletexDetails.customer.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 flex-shrink-0" />
                      <a 
                        href={`mailto:${tripletexDetails.customer.email}`}
                        className="text-blue-600 hover:text-blue-800 underline break-all text-sm"
                      >
                        {tripletexDetails.customer.email}
                      </a>
                    </div>
                  )}
                  
                  {tripletexDetails.customer.phoneNumber && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 flex-shrink-0" />
                      <a 
                        href={`tel:${tripletexDetails.customer.phoneNumber}`}
                        className="text-blue-600 hover:text-blue-800 underline text-sm"
                      >
                        {tripletexDetails.customer.phoneNumber}
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Project Manager */}
              {tripletexDetails?.projectManager && (
                <div className="space-y-3 pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="font-medium text-sm">Prosjektleder</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Navn:</span>
                    <span className="text-sm">{tripletexDetails.projectManager.firstName} {tripletexDetails.projectManager.lastName}</span>
                  </div>
                  
                  {tripletexDetails.projectManager.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 flex-shrink-0" />
                      <a 
                        href={`mailto:${tripletexDetails.projectManager.email}`}
                        className="text-blue-600 hover:text-blue-800 underline break-all text-sm"
                      >
                        {tripletexDetails.projectManager.email}
                      </a>
                    </div>
                  )}
                  
                  {tripletexDetails.projectManager.phoneNumber && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 flex-shrink-0" />
                      <a 
                        href={`tel:${tripletexDetails.projectManager.phoneNumber}`}
                        className="text-blue-600 hover:text-blue-800 underline text-sm"
                      >
                        {tripletexDetails.projectManager.phoneNumber}
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* System Info */}
              <div className="space-y-3 pt-3 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Status:</span>
                  <Badge variant={project.is_active ? "default" : "secondary"}>
                    {project.is_active ? "Aktivt" : "Inaktivt"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Opprettet:</span>
                  <span className="text-xs">{new Date(project.created_at).toLocaleDateString('no-NO')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Sist oppdatert:</span>
                  <span className="text-xs">{new Date(project.updated_at).toLocaleDateString('no-NO')}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Image Gallery Modal */}
      <ImageGallery
        photos={galleryPhotos}
        isOpen={galleryOpen}
        onClose={closeImageGallery}
        initialIndex={galleryInitialIndex}
        oppgaveInfo={galleryOppgaveInfo}
      />
    </div>
  );
}
