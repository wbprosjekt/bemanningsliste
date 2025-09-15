// Utility functions for display names

export const getPersonDisplayName = (fornavn: string, etternavn: string): string => {
  if (!fornavn || !etternavn) return '';
  const etternavnInitial = etternavn.charAt(0).toUpperCase();
  return `${fornavn} ${etternavnInitial}`;
};

export const formatTimeValue = (timer: number): string => {
  return timer.toFixed(2).replace('.', ',');
};

export const parseTimeValue = (value: string): number => {
  const parsed = parseFloat(value.replace(',', '.'));
  return isNaN(parsed) ? 0 : Math.round(parsed * 4) / 4; // Round to nearest 0.25
};

export const validateTimeStep = (timer: number): boolean => {
  return (timer * 4) % 1 === 0; // Must be divisible by 0.25
};

export const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

export const getDateFromWeek = (year: number, week: number): Date => {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = simple;
  if (dow <= 4) {
    ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  } else {
    ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  }
  return ISOweekStart;
};

// Holiday and calendar utilities
export const isHoliday = async (date: Date, orgId?: string): Promise<{ isHoliday: boolean; name?: string }> => {
  // This would connect to kalender_dag table
  // For now, return basic weekend check
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  return {
    isHoliday: isWeekend,
    name: isWeekend ? (dayOfWeek === 0 ? 'Søndag' : 'Lørdag') : undefined
  };
};

// Project color utilities
export const generateProjectColor = (projectId: number): string => {
  // Generate deterministic color from project ID
  const colors = [
    '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444',
    '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
  ];
  
  return colors[projectId % colors.length];
};

export const getContrastColor = (hexColor: string): string => {
  // Convert hex to RGB
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return black or white based on luminance
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
};

// Expected hours calculation with holiday support
export const getExpectedHoursForDate = (
  date: Date, 
  defaultHours: number = 8.0, 
  holidayHours: number = 0,
  isHoliday: boolean = false
): number => {
  if (isHoliday) {
    return holidayHours;
  }
  
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) { // Weekend
    return 0;
  }
  
  return defaultHours;
};