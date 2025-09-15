import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Norwegian holidays helper
const norwegianHolidays = (year: number) => {
  const holidays: { date: string; name: string }[] = [];
  
  // Fixed dates
  holidays.push({ date: `${year}-01-01`, name: 'Nyttårsdag' });
  holidays.push({ date: `${year}-05-01`, name: 'Første mai' });
  holidays.push({ date: `${year}-05-17`, name: '17. mai' });
  holidays.push({ date: `${year}-12-25`, name: 'Første juledag' });
  holidays.push({ date: `${year}-12-26`, name: 'Andre juledag' });
  
  // Calculate Easter (simplified calculation)
  const easter = calculateEaster(year);
  holidays.push({ date: formatDate(easter), name: 'Første påskedag' });
  
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  holidays.push({ date: formatDate(easterMonday), name: 'Andre påskedag' });
  
  const maundyThursday = new Date(easter);
  maundyThursday.setDate(easter.getDate() - 3);
  holidays.push({ date: formatDate(maundyThursday), name: 'Skjærtorsdag' });
  
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  holidays.push({ date: formatDate(goodFriday), name: 'Langfredag' });
  
  const ascensionDay = new Date(easter);
  ascensionDay.setDate(easter.getDate() + 39);
  holidays.push({ date: formatDate(ascensionDay), name: 'Kristi himmelfartsdag' });
  
  const whitsun = new Date(easter);
  whitsun.setDate(easter.getDate() + 49);
  holidays.push({ date: formatDate(whitsun), name: 'Første pinsedag' });
  
  const whitMonday = new Date(easter);
  whitMonday.setDate(easter.getDate() + 50);
  holidays.push({ date: formatDate(whitMonday), name: 'Andre pinsedag' });
  
  return holidays;
};

const calculateEaster = (year: number): Date => {
  // Simple Easter calculation (Gregorian calendar)
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

const ensureCalendarWindow = async (supabase: any, monthsAhead: number = 12) => {
  console.log(`Starting calendar sync for ${monthsAhead} months ahead`);
  
  const today = new Date();
  const endDate = new Date(today);
  endDate.setMonth(today.getMonth() + monthsAhead);
  
  const currentDate = new Date(today);
  const calendarEntries = [];
  
  while (currentDate <= endDate) {
    const dateStr = formatDate(currentDate);
    
    // Calculate ISO week and year
    const tempDate = new Date(currentDate.getTime());
    tempDate.setDate(tempDate.getDate() + 4 - (tempDate.getDay() || 7));
    const isoYear = tempDate.getFullYear();
    const isoWeek = Math.ceil((((tempDate.getTime() - new Date(isoYear, 0, 1).getTime()) / 86400000) + 1) / 7);
    
    // Check if weekend
    const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
    
    // Check if holiday
    const holidays = norwegianHolidays(currentDate.getFullYear());
    const holiday = holidays.find(h => h.date === dateStr);
    
    calendarEntries.push({
      dato: dateStr,
      iso_uke: isoWeek,
      iso_ar: isoYear,
      is_weekend: isWeekend,
      is_holiday: !!holiday,
      holiday_name: holiday?.name || null
    });
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Batch insert with upsert
  const batchSize = 100;
  for (let i = 0; i < calendarEntries.length; i += batchSize) {
    const batch = calendarEntries.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('kalender_dag')
      .upsert(batch, { onConflict: 'dato' });
    
    if (error) {
      console.error('Error inserting calendar batch:', error);
      throw error;
    }
  }
  
  console.log(`Successfully synced ${calendarEntries.length} calendar entries`);
  return { success: true, entries: calendarEntries.length };
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