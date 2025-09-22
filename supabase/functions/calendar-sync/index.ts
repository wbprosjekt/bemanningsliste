import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Norwegian holidays for each year
const getNowaegianHolidays = (year: number) => {
  const holidays: { date: string; name: string }[] = [];
  
  // Calculate Easter (simplified calculation for Norwegian holidays)
  const easter = calculateEaster(year);
  
  // Fixed holidays
  holidays.push({ date: `${year}-01-01`, name: 'Nyttårsdag' });
  holidays.push({ date: `${year}-05-01`, name: 'Første mai' });
  holidays.push({ date: `${year}-05-17`, name: '17. mai' });
  holidays.push({ date: `${year}-12-25`, name: '1. juledag' });
  holidays.push({ date: `${year}-12-26`, name: '2. juledag' });
  
  // Easter-related holidays
  const easterStr = formatDate(easter);
  holidays.push({ date: easterStr, name: '1. påskedag' });
  
  const maundyThursday = new Date(easter.getTime() - 3 * 24 * 60 * 60 * 1000);
  holidays.push({ date: formatDate(maundyThursday), name: 'Skjærtorsdag' });
  
  const goodFriday = new Date(easter.getTime() - 2 * 24 * 60 * 60 * 1000);
  holidays.push({ date: formatDate(goodFriday), name: 'Langfredag' });
  
  const easterMonday = new Date(easter.getTime() + 1 * 24 * 60 * 60 * 1000);
  holidays.push({ date: formatDate(easterMonday), name: '2. påskedag' });
  
  const ascensionDay = new Date(easter.getTime() + 39 * 24 * 60 * 60 * 1000);
  holidays.push({ date: formatDate(ascensionDay), name: 'Kristi himmelfartsdag' });
  
  const whitsun = new Date(easter.getTime() + 49 * 24 * 60 * 60 * 1000);
  holidays.push({ date: formatDate(whitsun), name: '1. pinsedag' });
  
  const whitMonday = new Date(easter.getTime() + 50 * 24 * 60 * 60 * 1000);
  holidays.push({ date: formatDate(whitMonday), name: '2. pinsedag' });
  
  return holidays;
};

const calculateEaster = (year: number): Date => {
  // Calculation of Easter date using algorithm
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  
  return new Date(year, month - 1, day);
};

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const ensureCalendarWindow = async (supabase: SupabaseClient, monthsAhead: number = 12) => {
  console.log(`Starting calendar sync for ${monthsAhead} months ahead`);
  
  const today = new Date();
  const endDate = new Date(today);
  endDate.setMonth(today.getMonth() + monthsAhead);
  
  const currentDate = new Date(today);
  const calendarEntries = [];
  
  // Get holidays for all years in the range
  const holidayMap = new Map<string, string>();
  for (let year = today.getFullYear(); year <= endDate.getFullYear(); year++) {
    const holidays = getNowaegianHolidays(year);
    holidays.forEach(h => holidayMap.set(h.date, h.name));
  }
  
  while (currentDate <= endDate) {
    const dateStr = formatDate(currentDate);
    
    // Calculate ISO week and year using SQL formulas
    const tempDate = new Date(currentDate.getTime());
    tempDate.setDate(tempDate.getDate() + 4 - (tempDate.getDay() || 7));
    const isoYear = tempDate.getFullYear();
    const isoWeek = Math.ceil((((tempDate.getTime() - new Date(isoYear, 0, 1).getTime()) / 86400000) + 1) / 7);
    
    const dayOfWeek = currentDate.getDay();
    const isWeekend = dayOfWeek === 6 || dayOfWeek === 0; // Saturday or Sunday
    const holidayName = holidayMap.get(dateStr);
    
    calendarEntries.push({
      dato: dateStr,
      iso_uke: isoWeek,
      iso_ar: isoYear,
      is_weekend: isWeekend,
      is_holiday: !!holidayName,
      holiday_name: holidayName || null
    });
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Batch insert with upsert (conflict resolution on primary key)
  const batchSize = 100;
  let totalInserted = 0;
  
  for (let i = 0; i < calendarEntries.length; i += batchSize) {
    const batch = calendarEntries.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('kalender_dag')
      .upsert(batch, { onConflict: 'dato' });
    
    if (error) {
      console.error('Error inserting calendar batch:', error);
      throw error;
    }
    
    totalInserted += batch.length;
  }
  
  console.log(`Successfully synced ${totalInserted} calendar entries`);
  return { success: true, entries: totalInserted };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { monthsAhead = 12 } = await req.json().catch(() => ({}));
    
    const result = await ensureCalendarWindow(supabaseClient, monthsAhead);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Calendar sync error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});