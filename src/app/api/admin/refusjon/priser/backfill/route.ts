/**
 * API Route: Backfill spot prices from Hva Koster Strømmen
 * POST /api/admin/refusjon/priser/backfill
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/integrations/supabase/client';
import { fetchSpotPricesRange } from '@/lib/refusjon/spotProvider';

export async function POST(request: NextRequest) {
  try {
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, org_id')
      .eq('id', user.id)
      .single();
      
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const body = await request.json();
    const { area, from, to } = body;
    
    if (!area || !from || !to) {
      return NextResponse.json(
        { error: 'Missing area, from, or to' },
        { status: 400 }
      );
    }
    
    // Validate area
    if (!['NO1', 'NO2', 'NO3', 'NO4', 'NO5'].includes(area)) {
      return NextResponse.json(
        { error: 'Invalid area' },
        { status: 400 }
      );
    }
    
    const fromDate = new Date(from);
    const toDate = new Date(to);
    
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }
    
    // Fetch spot prices from external API
    const spotPrices = await fetchSpotPricesRange(area, fromDate, toDate);
    
    if (spotPrices.length === 0) {
      return NextResponse.json(
        { error: 'No prices fetched', missing_hours: [] },
        { status: 424 }
      );
    }
    
    // Prepare data for upsert
    const energyPrices = spotPrices.map(price => ({
      org_id: profile.org_id,
      provider: 'spot' as const,
      area,
      ts_hour: price.timestamp.toISOString(),
      nok_per_kwh: price.nok_per_kwh,
      meta: { estimated: false, source: 'hvakosterstrommen' },
    }));
    
    // Upsert to database
    const { error } = await supabase
      .from('ref_energy_prices' as any)
      .upsert(energyPrices, {
        onConflict: 'org_id,provider,area,ts_hour',
      });
    
    if (error) {
      console.error('Error backfilling spot prices:', error);
      return NextResponse.json(
        { error: 'Failed to backfill prices' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      count: energyPrices.length,
      from,
      to,
      area,
    });
    
  } catch (error) {
    console.error('Error in backfill route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

