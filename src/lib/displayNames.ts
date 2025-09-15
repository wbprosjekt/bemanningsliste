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