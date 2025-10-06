"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  BarChart3,
  Users,
} from "lucide-react";
import { getDateFromWeek, getWeekNumber, getPersonDisplayName, formatTimeValue } from "@/lib/displayNames";
import { toLocalDateString } from "@/lib/utils";
import DayCard from "@/components/DayCard";
import OnboardingDialog from "@/components/OnboardingDialog";
import WeatherDayPills from "@/components/WeatherDayPills";

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

interface WeeklySummary {
  totalHours: number;
  totalOvertime: number;
  totalExpected: number;
  completionPercentage: number;
  daysCompleted: number;
  daysWithEntries: number;
  totalDays: number;
  status: 'complete' | 'partial' | 'missing' | 'empty';
  projects: Array<{
    project_name: string;
    project_number: number;
    totalHours: number;
    days: number;
  }>;
}

// Day Navigator replaced by WeatherDayPills component

const MinUke = () => {
  const params = useParams<{ year: string; week: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isSimulation, setIsSimulation] = useState(false);
  const [simulatedPersonName, setSimulatedPersonName] = useState<string | null>(null);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [calendarDays, setCalendarDays] = useState<Array<{
    dato: string;
    is_holiday: boolean;
    is_weekend: boolean;
    holiday_name: string | null;
  }>>([]);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);

  const currentYear = parseInt(params?.year || new Date().getFullYear().toString(), 10);
  const currentWeek = parseInt(params?.week || getWeekNumber(new Date()).toString(), 10);
  const formattedWeek = currentWeek.toString().padStart(2, '0');
  const simulatePersonId = searchParams?.get('simulatePersonId') || null;

  const getWeeksInYear = (targetYear: number) => {
    // Use ISO week calculation to get the correct number of weeks
    const dec28 = new Date(targetYear, 11, 28); // December 28th is always in the last week
    return getWeekNumber(dec28);
  };

  // Define getWeekDays early to avoid initialization issues
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

  // Auto-select today's day on mount
  useEffect(() => {
    const today = new Date();
    const weekDays = getWeekDays();
    const todayIndex = weekDays.findIndex(d => 
      toLocalDateString(d) === toLocalDateString(today)
    );
    
    if (todayIndex !== -1) {
      setSelectedDayIndex(todayIndex);
    }
  }, [currentYear, currentWeek, getWeekDays]);

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
        if (!['admin', 'manager'].includes(profileData.role || '')) {
          console.warn('User lacks permission to simulate other persons');
          // Toast will be handled by UI if needed
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
            console.warn('Could not find simulated person:', simulatePersonId);
            // Toast will be handled by UI if needed
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
  }, [user, simulatePersonId]);

  const loadWeeklySummary = useCallback(async () => {
    if (!person?.id || !profile?.org_id) {
      setWeeklySummary(null);
      return;
    }

    try {
      const startDate = getDateFromWeek(currentYear, currentWeek);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);

      // Load all vakt entries for the week
      const { data: vakter, error } = await supabase
        .from('vakt')
        .select(`
          id,
          dato,
          project_id,
          ttx_project_cache:project_id (
            project_name,
            project_number,
            tripletex_project_id
          ),
          vakt_timer (
            id,
            timer,
            status,
            is_overtime,
            lonnstype
          )
        `)
        .eq('org_id', profile.org_id)
        .eq('person_id', person.id)
        .gte('dato', toLocalDateString(startDate))
        .lte('dato', toLocalDateString(endDate));

      if (error) throw error;

      // Calculate summary
      let totalHours = 0;
      let totalOvertime = 0;
      let totalExpected = 0;
      let daysCompleted = 0;
      let daysWithEntries = 0;
      const projectMap = new Map<string, { project_name: string; project_number: number; totalHours: number; days: number }>();

      // Generate week days directly to avoid initialization issues
      const weekDays = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        weekDays.push(date);
      }
      
      const workingDays = weekDays.filter(day => {
        const dayOfWeek = day.getDay();
        return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
      });

      // Calculate totalExpected for the entire week (not just days with entries)
      // Use 7.5 hours per day for a 37.5 hour work week
      weekDays.forEach(day => {
        const dayOfWeek = day.getDay();
        let dayExpected = 7.5; // Standard 37.5 hour work week
        
        // Check if it's a weekend or holiday
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          dayExpected = 0; // Weekend
        }
        
        totalExpected += dayExpected;
      });

      weekDays.forEach(day => {
        const dayStr = toLocalDateString(day);
        const dayVakter = vakter?.filter(v => v.dato === dayStr) || [];
        
        if (dayVakter.length > 0) {
          daysWithEntries++;
          
          let dayHours = 0;
          let dayOvertime = 0;
          let dayExpected = 7.5; // Standard 37.5 hour work week
          
          // Check if it's a weekend or holiday
          const dayOfWeek = day.getDay();
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            dayExpected = 0; // Weekend
          }
          
      dayVakter.forEach((vakt) => {
        vakt.vakt_timer.forEach((timer) => {
              dayHours += timer.timer;
              if (timer.is_overtime) {
                dayOvertime += timer.timer;
              }
              
              // Track project hours
              if (vakt.ttx_project_cache) {
                const projectKey = vakt.ttx_project_cache.tripletex_project_id?.toString() || 'unknown';
                const existing = projectMap.get(projectKey) || {
                  project_name: vakt.ttx_project_cache.project_name || 'Ukjent prosjekt',
                  project_number: vakt.ttx_project_cache.project_number || 0,
                  totalHours: 0,
                  days: 0
                };
                existing.totalHours += timer.timer;
                if (!projectMap.has(projectKey)) {
                  existing.days = 1;
                  projectMap.set(projectKey, existing);
                }
              }
            });
          });
          
          totalHours += dayHours;
          totalOvertime += dayOvertime;
          // totalExpected is already calculated above for the entire week
          
          if (dayHours >= dayExpected && dayExpected > 0) {
            daysCompleted++;
          }
        }
      });

      const completionPercentage = totalExpected > 0 ? Math.round((totalHours / totalExpected) * 100) : 0;
      
      let status: WeeklySummary['status'] = 'empty';
      if (daysWithEntries === 0) {
        status = 'empty';
      } else if (completionPercentage >= 100) {
        status = 'complete';
      } else if (completionPercentage >= 50) {
        status = 'partial';
      } else {
        status = 'missing';
      }

      setWeeklySummary({
        totalHours,
        totalOvertime,
        totalExpected,
        completionPercentage,
        daysCompleted,
        daysWithEntries,
        totalDays: workingDays.length,
        status,
        projects: Array.from(projectMap.values()).sort((a, b) => b.totalHours - a.totalHours)
      });
    } catch (error) {
      console.error('Error loading weekly summary:', error);
      // Toast will be handled by higher-level error boundary if needed
    } finally {
      // setLoadingSummary(false); // This line is removed
    }
  }, [currentYear, currentWeek, person?.id, profile?.org_id]);

  const loadCalendarDays = useCallback(async () => {
    if (!profile?.org_id) return;

    try {
      const startDate = getDateFromWeek(currentYear, currentWeek);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);

      const { data, error } = await supabase
        .from('kalender_dag')
        .select('dato, is_holiday, is_weekend, holiday_name')
        .gte('dato', toLocalDateString(startDate))
        .lte('dato', toLocalDateString(endDate));

      if (error) throw error;
      setCalendarDays(data || []);
    } catch (error) {
      console.error('Error loading calendar days:', error);
      // Don't show error toast for calendar days as it's not critical
    }
  }, [profile?.org_id, currentYear, currentWeek]);

  // Realtime subscription for auto-updating weekly summary
  useEffect(() => {
    if (!person?.id || !profile?.org_id) return;

    console.log('🔄 Setting up Realtime subscription for vakt_timer');

    const channel = supabase
      .channel(`vakt_timer_changes_${person.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vakt_timer',
          filter: `org_id=eq.${profile.org_id}`
        },
        (payload) => {
          console.log('🔔 Realtime update received:', payload);
          // Reload weekly summary when timer changes
          loadWeeklySummary();
        }
      )
      .subscribe();

    return () => {
      console.log('🔌 Unsubscribing from Realtime');
      supabase.removeChannel(channel);
    };
  }, [person?.id, profile?.org_id, loadWeeklySummary]);

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user, loadUserData]);

  useEffect(() => {
    if (person && profile) {
      loadWeeklySummary();
    }
  }, [person, profile, loadWeeklySummary]);

  useEffect(() => {
    if (profile) {
      loadCalendarDays();
    }
  }, [profile, loadCalendarDays]);

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

    router.push(`/min/uke/${newYear}/${newWeek.toString().padStart(2, "0")}`);
  };

  const exitSimulation = () => {
    router.replace(`/min/uke/${currentYear}/${formattedWeek}`);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Auto-scroll to today's date when the component loads
  useEffect(() => {
    if (!loading && person && weeklySummary) {
      const today = new Date();
      const todayElement = document.getElementById(`day-${today.toISOString().split('T')[0]}`);
      
      if (todayElement) {
        // Small delay to ensure the page is fully rendered
        setTimeout(() => {
          todayElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'nearest'
          });
        }, 100);
      }
    }
  }, [loading, person, weeklySummary]);

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
                Du må opprette en profil og være tilknyttet en organisasjon for å bruke &quot;Min uke&quot;.
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
    <div className="min-h-screen bg-background px-2 py-2 sm:px-4 sm:py-4">
      <div className="max-w-md mx-auto space-y-3">
        {/* Simulation Badge */}
        {isSimulation && simulatedPersonName && (
          <div className="text-center">
            <Badge className="bg-blue-100 text-blue-800" variant="secondary">
              Simulerer {simulatedPersonName}
            </Badge>
            <Button 
              variant="outline"
              size="sm"
              className="ml-2"
              onClick={exitSimulation}
            >
              Avslutt
            </Button>
          </div>
        )}

        {/* Missing Person Warning */}
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

        {/* Compact Week Navigation & Summary */}
        {person && weeklySummary && (
          <Card>
            <CardContent className="p-3 space-y-3">
              {/* Week Navigation with Large Buttons */}
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigateWeek(-1)}
                  className="h-14 w-16 flex-shrink-0"
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <div className="text-lg font-semibold text-center">
                  Uke {currentWeek}, {currentYear}
                </div>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigateWeek(1)}
                  className="h-14 w-16 flex-shrink-0"
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </div>

              {/* Compact Summary Line */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Timer:</span>
                <span className="font-semibold text-gray-900">
                  {formatTimeValue(weeklySummary.totalHours)}/{formatTimeValue(weeklySummary.totalExpected)}t
                </span>
                <span className="text-muted-foreground text-xs">
                  {weeklySummary.completionPercentage}%
                </span>
                <div className="h-2 flex-1 rounded-full overflow-hidden bg-gray-200">
                  <div 
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${Math.min(weeklySummary.completionPercentage, 100)}%`,
                      background: weeklySummary.totalHours >= weeklySummary.totalExpected
                        ? 'linear-gradient(to right, #34d399, #22d3ee, #3b82f6)'
                        : 'linear-gradient(to right, #f87171, #fb923c, #fbbf24)'
                    }}
                  />
                </div>
                {weeklySummary.totalOvertime > 0 && (
                  <span className="text-yellow-600 text-xs font-medium whitespace-nowrap">
                    +{formatTimeValue(weeklySummary.totalOvertime)}t OT
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Weather Day Pills Navigator */}
        {person && (
          <div className="mb-4">
            <WeatherDayPills
              selectedDate={getWeekDays()[selectedDayIndex]}
              onSelectDate={(date) => {
                const index = getWeekDays().findIndex(
                  (d) => toLocalDateString(d) === toLocalDateString(date)
                );
                if (index !== -1) setSelectedDayIndex(index);
              }}
              weekDates={getWeekDays()}
            />
          </div>
        )}

        {/* Single Day View with Fade-in */}
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
        ) : (
          <div 
            key={selectedDayIndex}
            className="transition-opacity duration-150 ease-in-out"
            style={{ animation: 'fadeIn 150ms ease-in-out' }}
          >
            <style jsx>{`
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
            `}</style>
            <DayCard
              date={getWeekDays()[selectedDayIndex]}
              orgId={profile.org_id}
              personId={person?.id}
              forventetTimer={person?.forventet_dagstimer || 8.0}
              calendarDays={calendarDays}
            />
          </div>
        )}

        {/* Quick Actions */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="text-sm md:text-xs h-12 md:h-10"
                onClick={() => {
                  const today = new Date();
                  const weekDays = getWeekDays();
                  const todayIndex = weekDays.findIndex(d => 
                    toLocalDateString(d) === toLocalDateString(today)
                  );
                  if (todayIndex !== -1) {
                    setSelectedDayIndex(todayIndex);
                  }
                }}
              >
                <Calendar className="h-4 w-4 md:h-3 md:w-3 mr-1" />
                Gå til i dag
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="text-sm md:text-xs h-12 md:h-10"
                onClick={() => router.push(`/min/uke/${currentYear}/${currentWeek}/oversikt`)}
              >
                <BarChart3 className="h-4 w-4 md:h-3 md:w-3 mr-1" />
                Ukeoversikt
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MinUke;
