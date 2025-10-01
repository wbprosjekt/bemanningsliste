// Utility functions for display names

export const getPersonDisplayName = (fornavn: string, etternavn: string): string => {
  if (!fornavn || !etternavn) return "";
  const etternavnInitial = etternavn.charAt(0).toUpperCase();
  return `${fornavn} ${etternavnInitial}`;
};

export const formatTimeValue = (timer?: number): string => {
  if (typeof timer !== "number" || Number.isNaN(timer)) return "0,00";
  return timer.toFixed(2).replace(".", ",");
};

export const parseTimeValue = (value: string): number => {
  const parsed = parseFloat(value.replace(",", "."));
  return Number.isNaN(parsed) ? 0 : Math.round(parsed * 4) / 4;
};

export const validateTimeStep = (timer: number): boolean => {
  return (timer * 4) % 1 === 0;
};

export const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  if (weekNumber === 0) {
    return 53;
  }

  return weekNumber;
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

export const isHoliday = async (date: Date): Promise<{ isHoliday: boolean; name?: string }> => {
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  return {
    isHoliday: isWeekend,
    name: isWeekend ? (dayOfWeek === 0 ? "Søndag" : "Lørdag") : undefined,
  };
};

export const generateProjectColor = (projectId: number): string => {
  const colors = [
    "#3B82F6",
    "#8B5CF6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#06B6D4",
    "#84CC16",
    "#F97316",
    "#EC4899",
    "#6366F1",
  ];

  return colors[projectId % colors.length];
};

export const getContrastColor = (hexColor: string): string => {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? "#000000" : "#FFFFFF";
};

export const getExpectedHoursForDate = (
  date: Date,
  defaultHours: number = 8,
  holidayHours: number = 0,
  isHoliday: boolean = false
): number => {
  if (isHoliday) {
    return holidayHours;
  }

  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return 0;
  }

  return defaultHours;
};
