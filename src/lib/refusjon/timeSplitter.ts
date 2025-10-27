/**
 * DST-safe time splitting for charging sessions
 * Splits sessions into hourly bits in Europe/Oslo timezone
 */

export interface TimeBits {
  local_hour: Date; // Europe/Oslo time
  kwh: number;
  minutes_in_hour: number;
  is_dst_transition: boolean; // Warning flag if crosses DST boundary
}

export interface SplitResult {
  bits: TimeBits[];
  warnings: string[];
}

/**
 * Split session into hourly bits (DST-safe)
 */
export function splitIntoTimeBits(
  startTime: string,
  endTime: string,
  totalKwh: number
): SplitResult {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const totalMs = end.getTime() - start.getTime();
  const totalMinutes = totalMs / (1000 * 60);

  const bits: TimeBits[] = [];
  const warnings: string[] = [];

  // Get timezone offset for Europe/Oslo at start of session
  const timezone = 'Europe/Oslo';
  let current = new Date(start);

  // Check for DST transition
  const startOffset = getTimezoneOffset(current, timezone);
  const endOffset = getTimezoneOffset(end, timezone);
  if (startOffset !== endOffset) {
    warnings.push(
      `Session crosses DST boundary (+${startOffset}min → +${endOffset}min at ${timezone})`
    );
  }

  while (current < end) {
    // Get start of this hour in Europe/Oslo
    const hourStart = new Date(current);
    hourStart.setMinutes(0, 0, 0);

    // Get end of this hour
    const hourEnd = new Date(hourStart);
    hourEnd.setHours(hourEnd.getHours() + 1);

    // Actual start/end for this bit
    const bitStart = new Date(Math.max(current.getTime(), hourStart.getTime()));
    const bitEnd = new Date(Math.min(end.getTime(), hourEnd.getTime()));

    // Minutes in this bit
    const minutesInBit = (bitEnd.getTime() - bitStart.getTime()) / (1000 * 60);

    // Calculate kWh for this bit (proportional)
    const kwhInBit = (totalKwh * minutesInBit) / totalMinutes;

    // Add bit
    bits.push({
      local_hour: hourStart,
      kwh: kwhInBit,
      minutes_in_hour: minutesInBit,
      is_dst_transition: startOffset !== endOffset && bitStart < end && bitEnd > start,
    });

    // Move to next hour
    current = new Date(hourEnd);
  }

  return { bits, warnings };
}

/**
 * Get timezone offset in minutes (handles DST)
 */
function getTimezoneOffset(date: Date, timezone: string): number {
  // Use Intl to get offset
  const utc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tz = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  return (utc.getTime() - tz.getTime()) / (1000 * 60);
}

/**
 * Format duration (e.g. "1t 28m")
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours}t`);
  if (mins > 0) parts.push(`${mins}m`);
  return parts.join(' ') || '0m';
}

/**
 * Get ISO week from date
 */
export function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

