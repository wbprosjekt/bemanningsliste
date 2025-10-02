import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date
    .getDate()
    .toString()
    .padStart(2, "0")}`;
}

export function toLocalDateTimeString(date: Date): string {
  return `${toLocalDateString(date)}T${date
    .getHours()
    .toString()
    .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date
    .getSeconds()
    .toString()
    .padStart(2, "0")}`;
}

/**
 * Get all dates for a given week (ISO 8601 week)
 * Returns array of 7 dates (Monday to Sunday)
 */
export function getWeekDates(year: number, week: number): string[] {
  // ISO 8601 week date calculation
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7; // Sunday = 7
  const weekStart = new Date(jan4);
  weekStart.setDate(jan4.getDate() - jan4Day + 1 + (week - 1) * 7);
  
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    dates.push(toLocalDateString(date));
  }
  
  return dates;
}

