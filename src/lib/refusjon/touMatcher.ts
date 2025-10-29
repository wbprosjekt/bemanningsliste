/**
 * TOU (Time-of-Use) Nettariff Matcher
 * Supports versioning and holiday detection
 */

export interface NettWindow {
  profile_id: string;
  dow: number; // 0=Mon, 6=Sun
  start_time: string; // "HH:mm"
  end_time: string;
  energy_ore_per_kwh: number;
  time_ore_per_kwh?: number;
}

export interface NettProfile {
  id: string;
  org_id: string;
  name: string;
  timezone: string;
  meta?: {
    effective_from?: string; // ISO date
    effective_to?: string;
    holidays?: string[]; // ["YYYY-MM-DD", ...]
    includes_vat?: boolean; // Default: false (øre/kWh ex. MVA)
  };
  windows: NettWindow[];
}

/**
 * Get nett price for a specific hour (with versioning and holiday handling)
 */
export async function getNettPrice(
  timestamp: Date,
  profiles: NettProfile[],
  defaultOrePerKwh: number = 0 // Fallback if no profile matches
): Promise<number> {
  // Find active profile for this date (versioning)
  const dateStr = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
  
  const activeProfile = profiles.find(profile => {
    const { effective_from, effective_to } = profile.meta || {};
    
    if (effective_from && dateStr < effective_from) return false;
    if (effective_to && dateStr > effective_to) return false;
    
    return true;
  });
  
  if (!activeProfile || activeProfile.windows.length === 0) {
    // No active profile, use default
    return defaultOrePerKwh / 100; // Convert øre to NOK
  }
  
  // Check if holiday (use helgesats)
  const isHoliday = activeProfile.meta?.holidays?.includes(dateStr);
  
  // Get day of week (0=Mon, 6=Sun) or treat as Sunday if holiday
  const dow = isHoliday ? 6 : timestamp.getUTCDay();
  
  // Get local time (HH:mm)
  const localHour = timestamp.getUTCHours();
  const localMinute = timestamp.getUTCMinutes();
  const timeStr = `${String(localHour).padStart(2, '0')}:${String(localMinute).padStart(2, '0')}`;
  
  // Find matching window
  const window = activeProfile.windows.find(w => {
    if (isHoliday) {
      // On holidays, use Sunday window if available, otherwise any
      return w.dow === 6 || w.dow === dow;
    }
    return w.dow === dow && timeInRange(timeStr, w.start_time, w.end_time);
  });
  
  if (!window) {
    // No matching window, use default
    return defaultOrePerKwh / 100;
  }
  
  // Get price in øre/kWh
  const orePerKwh = window.energy_ore_per_kwh + (window.time_ore_per_kwh || 0);
  
  // Convert to NOK/kWh incl. MVA
  const includesVat = activeProfile.meta?.includes_vat ?? false;
  
  if (includesVat) {
    // Already incl. MVA, just convert øre to NOK
    return orePerKwh / 100;
  } else {
    // Add MVA
    return (orePerKwh / 100) * 1.25;
  }
}

/**
 * Check if time is within range
 */
function timeInRange(time: string, start: string, end: string): boolean {
  const [timeH, timeM] = time.split(':').map(Number);
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  
  const timeMinutes = timeH * 60 + timeM;
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  // Handle overnight ranges (e.g., 22:00 - 06:00)
  if (endMinutes < startMinutes) {
    return timeMinutes >= startMinutes || timeMinutes < endMinutes;
  } else {
    return timeMinutes >= startMinutes && timeMinutes < endMinutes;
  }
}

/**
 * Get holidays from profile metadata
 */
export function getProfileHolidays(profile: NettProfile): string[] {
  return profile.meta?.holidays || [];
}

/**
 * Check if date is a holiday
 */
export function isHoliday(date: Date, profiles: NettProfile[]): boolean {
  const dateStr = date.toISOString().split('T')[0];
  
  for (const profile of profiles) {
    const holidays = getProfileHolidays(profile);
    if (holidays.includes(dateStr)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Match timestamp to TOU time window (from database)
 * This is a simplified helper that fetches the matching window from Supabase
 */
export async function matchToUTimeWindow(
  supabase: any,
  netProfileId: string,
  timestamp: Date
): Promise<any> {
  try {
    // Get holidays for the profile
    const { data: profile } = await supabase
      .from('ref_nett_profiles')
      .select('meta, timezone')
      .eq('id', netProfileId)
      .single();
    
    const timezone = profile?.timezone || 'Europe/Oslo';
    const parts = getLocalTimeParts(timestamp, timezone);
    
    const isHolidayFlag = profile?.meta?.holidays?.includes(parts.date) ?? false;
    
    // Get day of week (0=Mon, 6=Sun) or treat as Sunday if holiday
    const dow = isHolidayFlag ? 6 : parts.dow;
    
    // Get local time (HH:mm)
    const timeStr = `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
    
    // Query matching window from database
    const { data: windows } = await supabase
      .from('ref_nett_windows')
      .select('*')
      .eq('profile_id', netProfileId)
      .eq('dow', dow);
    
    if (!windows || windows.length === 0) {
      return null;
    }
    
    // Find window that matches the time range
    const matchingWindow = windows.find((w: any) => {
      return isTimeInRange(timeStr, w.start_time, w.end_time);
    });
    
    return matchingWindow || null;
  } catch (error) {
    console.error('Error matching TOU window:', error);
    return null;
  }
}

/**
 * Helper: Check if time is within range
 */
function isTimeInRange(time: string, start: string, end: string): boolean {
  const [timeH, timeM] = time.split(':').map(Number);
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  
  const timeMinutes = timeH * 60 + timeM;
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  // Handle overnight ranges (e.g., 22:00 - 06:00)
  if (endMinutes < startMinutes) {
    return timeMinutes >= startMinutes || timeMinutes < endMinutes;
  } else {
    return timeMinutes >= startMinutes && timeMinutes < endMinutes;
  }
}

function getLocalTimeParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  });

  const parts = formatter.formatToParts(date);
  const toMap = (type: string) => parts.find((p) => p.type === type)?.value || '';

  const year = toMap('year');
  const month = toMap('month');
  const day = toMap('day');
  const hour = parseInt(toMap('hour'), 10) || 0;
  const minute = parseInt(toMap('minute'), 10) || 0;
  const weekday = toMap('weekday').toLowerCase();

  const weekdayMap: Record<string, number> = {
    mon: 0,
    tue: 1,
    wed: 2,
    thu: 3,
    fri: 4,
    sat: 5,
    sun: 6,
  };

  const dow = weekdayMap[weekday.slice(0, 3)] ?? 0;

  return {
    date: `${year}-${month}-${day}`,
    hour,
    minute,
    dow,
  };
}
