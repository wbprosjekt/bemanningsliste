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
  Trash2
} from 'lucide-react';

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
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<ProjectStats>({
    total_befaringer: 0,
    total_oppgaver: 0,
    total_bilder: 0,
    untagged_bilder: 0
  });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [projectPhotos, setProjectPhotos] = useState<ProjectPhoto[]>([]);
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);

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

  const loadProjectStats = async (projectId: string) => {
    try {
      // Count befaringer
      const { count: befaringerCount, error: befaringerError } = await supabase
        .from('befaringer')
        .select('*', { count: 'exact', head: true })
        .eq('tripletex_project_id', project?.tripletex_project_id || 0);

      // Count oppgaver (via plantegninger -> befaringer)
      const { count: oppgaverCount, error: oppgaverError } = await supabase
        .from('oppgaver')
        .select(`
          id,
          plantegninger:plantegning_id(
            befaringer:befaring_id(tripletex_project_id)
          )
        `, { count: 'exact', head: true })
        .eq('plantegninger.befaringer.tripletex_project_id', project?.tripletex_project_id || 0);

      // Count all project images
      const { count: totalBilderCount, error: totalBilderError } = await supabase
        .from('oppgave_bilder')
        .select('*', { count: 'exact', head: true })
        .eq('prosjekt_id', projectId);

      // Count untagged project images
      const { count: untaggedBilderCount, error: untaggedBilderError } = await supabase
        .from('oppgave_bilder')
        .select('*', { count: 'exact', head: true })
        .eq('prosjekt_id', projectId)
        .is('oppgave_id', null);

      setStats({
        total_befaringer: befaringerCount || 0,
        total_oppgaver: oppgaverCount || 0,
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

      // Load project stats with real data
      await loadProjectStats(projectId);

      // Load project photos (tagged to project but not to specific oppgave)
      const { data: photosData, error: photosError } = await supabase
        .from('oppgave_bilder')
        .select(`
          id,
          image_url,
          uploaded_by,
          uploaded_by_email,
          created_at,
          oppgave_id,
          prosjekt_id
        `)
        .eq('prosjekt_id', projectId)
        .is('oppgave_id', null) // Photos tagged to project but not to specific task
        .order('created_at', { ascending: false });

      if (photosError) {
        console.warn('Could not load project photos:', photosError);
      } else {
        setProjectPhotos(photosData || []);
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
                Foto-bibliotek ({projectPhotos.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {projectPhotos.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {projectPhotos.map((photo) => (
                    <div key={photo.id} className="relative group">
                      <img
                        src={photo.image_url}
                        alt="Project photo"
                        className="w-full h-24 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => {/* TODO: Open full-size view */}}
                      />
                      {/* Comment removed - not available in current schema */}
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
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Status:</span>
                <Badge variant={project.is_active ? "default" : "secondary"}>
                  {project.is_active ? "Aktivt" : "Inaktivt"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Opprettet:</span>
                <span className="text-xs">{new Date(project.created_at).toLocaleDateString('no-NO')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Sist oppdatert:</span>
                <span className="text-xs">{new Date(project.updated_at).toLocaleDateString('no-NO')}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
