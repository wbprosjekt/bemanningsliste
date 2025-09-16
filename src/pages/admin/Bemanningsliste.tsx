import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import StaffingList from '@/components/StaffingList';
import { getWeekNumber } from '@/lib/displayNames';

const Bemanningsliste = () => {
  const { year, week } = useParams<{ year: string; week: string }>();
  const navigate = useNavigate();
  
  const now = new Date();
  const defaultYear = now.getFullYear();
  const defaultWeek = getWeekNumber(now);
  const parsedYear = parseInt(year ?? '');
  const parsedWeek = parseInt(week ?? '');
  const currentYear = Number.isNaN(parsedYear) ? defaultYear : parsedYear;
  const currentWeek = Number.isNaN(parsedWeek) ? defaultWeek : Math.max(1, Math.min(53, parsedWeek));

  // Redirect away from invalid URL params like NaN/NaN
  useEffect(() => {
    const invalid = Number.isNaN(parsedYear) || Number.isNaN(parsedWeek);
    if (invalid) {
      navigate(`/admin/bemanningsliste/${currentYear}/${String(currentWeek).padStart(2,'0')}`, { replace: true });
    }
  }, [parsedYear, parsedWeek, navigate, currentYear, currentWeek]);

  const navigateWeeks = (delta: number) => {
    let newYear = currentYear;
    let newWeek = currentWeek + delta;

    // Handle year transitions properly for ISO weeks
    if (newWeek > 52) {
      const lastWeekOfYear = getWeekNumber(new Date(currentYear, 11, 31));
      if (newWeek > lastWeekOfYear) {
        newYear++;
        newWeek = 1;
      }
    } else if (newWeek < 1) {
      newYear--;
      newWeek = 52;
    }

    navigate(`/admin/bemanningsliste/${newYear}/${newWeek.toString().padStart(2, '0')}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Multi-Week Navigation */}
      <div className="bg-card border-b p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-4">
          <Button variant="outline" onClick={() => navigateWeeks(-6)}>
            <ChevronLeft className="h-4 w-4" />
            Forrige 6 uker
          </Button>
          <div className="text-lg font-medium">
            Fra uke {currentWeek}, {currentYear}
          </div>
          <Button variant="outline" onClick={() => navigateWeeks(6)}>
            Neste 6 uker
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Multi-Week Staffing List */}
      <StaffingList startWeek={currentWeek} startYear={currentYear} weeksToShow={6} />
    </div>
  );
};

export default Bemanningsliste;