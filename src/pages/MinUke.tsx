import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { ChevronLeft, ChevronRight, Calendar, Eye, Users } from 'lucide-react';
import { getDateFromWeek, getWeekNumber, getPersonDisplayName } from '@/lib/displayNames';
import DayCard from '@/components/DayCard';

import OnboardingDialog from '@/components/OnboardingDialog';

type PersonRow = Database['public']['Tables']['person']['Row'];

interface Profile {
  id: string;
  user_id: string;
  org_id: string;
  org?: {
    name: string;
  };
}

type Person = Pick<
  PersonRow,
  'id' | 'fornavn' | 'etternavn' | 'forventet_dagstimer' | 'epost' | 'aktiv' | 'person_type'
>;

const MinUke = () => {
  const { year, week } = useParams<{ year: string; week: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [showFullWeek, setShowFullWeek] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isSimulation, setIsSimulation] = useState(false);
  const [simulatedPersonName, setSimulatedPersonName] = useState<string | null>(null);

  const currentYear = parseInt(year || new Date().getFullYear().toString());
  const currentWeek = parseInt(week || getWeekNumber(new Date()).toString());
  const formattedWeek = currentWeek.toString().padStart(2, '0');
  const simulatePersonId = searchParams.get('simulatePersonId');

  const getWeeksInYear = (targetYear: number) => {
    // Use ISO week calculation to get the correct number of weeks
    const dec28 = new Date(targetYear, 11, 28); // December 28th is always in the last week
    return getWeekNumber(dec28);
  };

  const loadUserData = useCallback(async () => {
    if (!user) return;

    try {
      const toPerson = (data: PersonRow): Person => ({
        id: data.id,
        fornavn: data.fornavn,
        etternavn: data.etternavn,
        forventet_dagstimer: data.forventet_dagstimer ?? null,
        epost: data.epost ?? null,
        aktiv: data.aktiv ?? undefined,
        person_type: data.person_type ?? null
      });

      // Load user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*, org:org_id (name)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      if (!profileData) {
        console.warn('No profile found for user');
        setShowOnboarding(true);
        setLoading(false);
        return;
      }

      setProfile(profileData);

      setIsSimulation(false);
      setSimulatedPersonName(null);

      if (simulatePersonId) {
        if (!['admin', 'manager'].includes(profileData.role)) {
          toast({
            title: 'Manglende tilgang',
            description: 'Bare administratorer eller ledere kan simulere andre personer.',
            variant: 'destructive'
          });
        } else {
          const { data: simulatedPerson, error: simulatedPersonError } = await supabase
            .from('person')
            .select('*')
            .eq('id', simulatePersonId)
            .eq('org_id', profileData.org_id)
            .maybeSingle();

          if (simulatedPersonError && simulatedPersonError.code !== 'PGRST116') {
            console.warn('Error loading simulated person', simulatePersonId, simulatedPersonError);
          } else if (!simulatedPerson) {
            toast({
              title: 'Fant ikke ansatt',
              description: 'Kunne ikke finne personen du forsøker å simulere.',
              variant: 'destructive'
            });
          } else {
            setPerson(toPerson(simulatedPerson));
            setIsSimulation(true);
            setSimulatedPersonName(
              getPersonDisplayName(simulatedPerson.fornavn, simulatedPerson.etternavn)
            );
            return;
          }
        }
      }

      if (user.email) {
        const normalizedEmail = user.email.toLowerCase();

        const { data: personData, error: personError } = await supabase
          .from('person')
          .select('*')
          .eq('org_id', profileData.org_id)
          .ilike('epost', normalizedEmail)
          .maybeSingle();

        if (personError && personError.code !== 'PGRST116') {
          console.warn('Error loading person for email', normalizedEmail, personError);
        } else {
          setPerson(personData ? toPerson(personData) : null);
        }
      } else {
        setPerson(null);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setShowOnboarding(true);
    } finally {
      setLoading(false);
    }
  }, [user, simulatePersonId, toast]);

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user, loadUserData]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    loadUserData();
  };

  const navigateWeek = (delta: number) => {
    let newYear = currentYear;
    let newWeek = currentWeek + delta;
    let weeksInYear = getWeeksInYear(newYear);

    while (newWeek > weeksInYear) {
      newWeek -= weeksInYear;
      newYear += 1;
      weeksInYear = getWeeksInYear(newYear);
    }

    while (newWeek < 1) {
      newYear -= 1;
      weeksInYear = getWeeksInYear(newYear);
      newWeek += weeksInYear;
    }

    navigate(`/min/uke/${newYear}/${newWeek.toString().padStart(2, '0')}`);
  };

  const exitSimulation = () => {
    navigate(`/min/uke/${currentYear}/${formattedWeek}`, { replace: true });
  };

  const getWeekDays = useCallback(() => {
    const startDate = getDateFromWeek(currentYear, currentWeek);
    const days = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }
    
    return days;
  }, [currentYear, currentWeek]);

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Memoize weekDays to prevent infinite loops. Must be declared before any early return.
  const weekDays = useMemo(() => getWeekDays(), [getWeekDays]);

  if (showOnboarding) {
    return <OnboardingDialog onComplete={handleOnboardingComplete} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">Laster...</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="p-6 text-center space-y-4">
              <h2 className="text-xl font-semibold">Profil mangler</h2>
              <p className="text-muted-foreground">
                Du må opprette en profil og være tilknyttet en organisasjon for å bruke "Min uke".
              </p>
              <Button onClick={() => setShowOnboarding(true)}>
                Sett opp organisasjon
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  const missingPersonRecord = !person;

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="space-y-3">
          <div className="text-center sm:text-left">
            <h1 className="text-2xl sm:text-3xl font-bold">Min uke</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              {profile.org?.name}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Uke {currentWeek}, {currentYear}
              {person && ` - ${getPersonDisplayName(person.fornavn, person.etternavn)}`}
            </p>
            {isSimulation && simulatedPersonName && (
              <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:gap-2">
                <Badge className="w-fit bg-blue-100 text-blue-800" variant="secondary">
                  Simulerer {simulatedPersonName}
                </Badge>
                <Button 
                  variant="outline"
                  size="sm"
                  className="mt-2 sm:mt-0"
                  onClick={exitSimulation}
                >
                  Avslutt simulering
                </Button>
              </div>
            )}
          </div>

          {missingPersonRecord && (
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4 text-sm text-amber-900">
                <p className="font-medium">Ingen ansattprofil funnet</p>
                <p className="mt-1">
                  Vi fant ingen registrert ansatt med e-postadressen {user?.email}. Be administratoren knytte Tripletex-ansatte til brukere,
                  eller legg inn e-post på riktig person i bemanningssystemet.
                </p>
              </CardContent>
            </Card>
          )}
          
          {/* Mobile Action Buttons */}
          <div className="flex flex-col sm:hidden space-y-2">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                className="flex-1"
                onClick={() => setShowFullWeek(!showFullWeek)}
              >
                <Eye className="h-4 w-4 mr-1" />
                {showFullWeek ? 'Kompakt' : 'Hele uka'}
              </Button>
              {isSimulation && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={exitSimulation}
                >
                  Avslutt simulering
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm"
                className="flex-1"
                onClick={() => {
                  const currentYear = new Date().getFullYear();
                  const currentWeek = getWeekNumber(new Date());
                  navigate(`/admin/bemanningsliste/${currentYear}/${currentWeek.toString().padStart(2, '0')}`);
                }}
              >
                <Users className="h-4 w-4 mr-1" />
                Planlegg
              </Button>
            </div>
            <div className="flex justify-center">
              <Badge variant="outline" className="text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                {new Date().toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit' })}
              </Badge>
            </div>
          </div>

          {/* Desktop Action Buttons */}
          <div className="hidden sm:flex items-center justify-between">
            <div></div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowFullWeek(!showFullWeek)}
              >
                <Eye className="h-4 w-4 mr-1" />
                {showFullWeek ? 'Kompakt visning' : 'Vis hele uka'}
              </Button>
              {isSimulation && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={exitSimulation}
                >
                  Avslutt simulering
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  const currentYear = new Date().getFullYear();
                  const currentWeek = getWeekNumber(new Date());
                  navigate(`/admin/bemanningsliste/${currentYear}/${currentWeek.toString().padStart(2, '0')}`);
                }}
              >
                <Users className="h-4 w-4 mr-1" />
                Planlegg prosjekter
              </Button>
              <Badge variant="outline">
                <Calendar className="h-3 w-3 mr-1" />
                {new Date().toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </Badge>
            </div>
          </div>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigateWeek(-1)}
            className="flex-shrink-0"
          >
            <ChevronLeft className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Forrige uke</span>
          </Button>
          <div className="text-sm sm:text-lg font-medium text-center px-2">
            <div className="sm:hidden">Uke {currentWeek}</div>
            <div className="hidden sm:block">Uke {currentWeek}, {currentYear}</div>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigateWeek(1)}
            className="flex-shrink-0"
          >
            <span className="hidden sm:inline">Neste uke</span>
            <ChevronRight className="h-4 w-4 sm:ml-1" />
          </Button>
        </div>

        {/* Week View */}
        {!person ? (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Ingen ansatt-profil funnet</h3>
                <p className="text-sm mb-4">
                  Din brukerkonto er ikke koblet til en ansatt-profil i systemet.
                </p>
                <p className="text-xs text-muted-foreground">
                  Kontakt administrator for å få tilgang til timeføring.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : showFullWeek ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2 sm:gap-4">
            {weekDays.map((date, index) => (
              <div key={index} className={isToday(date) ? 'ring-2 ring-primary rounded-lg' : ''}>
                <DayCard
                  date={date}
                  orgId={profile.org_id}
                  personId={person?.id}
                  forventetTimer={person?.forventet_dagstimer || 8.0}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
            {weekDays
              .filter(date => {
                // Show today and upcoming days, plus previous 2 days
                const today = new Date();
                const daysDiff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                return daysDiff >= -2 && daysDiff <= 7;
              })
              .map((date, index) => (
                <div key={index} className={isToday(date) ? 'ring-2 ring-primary rounded-lg' : ''}>
                  <DayCard
                    date={date}
                    orgId={profile.org_id}
                    personId={person?.id}
                    forventetTimer={person?.forventet_dagstimer || 8.0}
                  />
                </div>
              ))}
          </div>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Hurtighandlinger</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
              <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                📊 Ukeoversikt
              </Button>
              <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                📋 Kopier uka
              </Button>
              <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                📤 Send til godkjenning
              </Button>
              <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                📄 Eksporter
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MinUke;
