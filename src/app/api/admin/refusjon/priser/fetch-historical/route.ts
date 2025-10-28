/**
 * API Route: Fetch historical spot prices from Hva Koster Strømmen
 * POST /api/admin/refusjon/priser/fetch-historical
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/integrations/supabase/client';
import { fetchSpotPricesRange } from '@/lib/refusjon/spotProvider';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Fetch Historical API called');
    
    // TODO: Fix authentication - skip for now
    console.log('⏭️ Skipping auth check for debugging');
    
    const body = await request.json();
    const { area, from, to, orgId } = body;
    
    console.log('📋 Request:', { area, from, to, orgId });
    
    if (!area || !from || !to || !orgId) {
      return NextResponse.json(
        { error: 'Missing area, from, to, or orgId' },
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
    
    console.log('📅 Fetching prices from', fromDate, 'to', toDate);
    
    // Don't fetch future dates (today + 1 is max)
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 1); // Tomorrow is published today
    
    const actualEndDate = toDate > maxDate ? maxDate : toDate;
    
    if (fromDate > maxDate) {
      return NextResponse.json(
        { error: 'Cannot fetch future prices beyond tomorrow' },
        { status: 400 }
      );
    }
    
    // Fetch spot prices from external API
    const spotPrices = await fetchSpotPricesRange(area, fromDate, actualEndDate);
    
    console.log('✅ Fetched', spotPrices.length, 'price points (requested range:', from, 'to', actualEndDate.toISOString(), ')');
    
    if (spotPrices.length === 0) {
      return NextResponse.json(
        { error: 'No prices fetched', details: 'The selected date range may contain no data or all prices were null' },
        { status: 424 }
      );
    }
    
    // Prepare data for upsert
    const energyPrices = spotPrices.map(price => ({
      org_id: orgId,
      provider: 'spot' as const,
      area,
      ts_hour: price.timestamp.toISOString(),
      nok_per_kwh: price.nok_per_kwh,
      meta: { source: 'hvakosterstrommen', fetched_at: new Date().toISOString() },
    }));
    
    console.log('💾 Inserting', energyPrices.length, 'prices into database');
    
    // Upsert to database - use the unique index
    const { error } = await supabase
      .from('ref_energy_prices' as any)
      .upsert(energyPrices, {
        onConflict: 'org_id,provider,area,ts_hour',
        ignoreDuplicates: false,
      });
    
    if (error) {
      console.error('Error upserting spot prices:', error);
      return NextResponse.json(
        { error: 'Failed to store prices', details: error.message },
        { status: 500 }
      );
    }
    
    // Delete data older than 3 months (cleanup)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    await supabase
      .from('ref_energy_prices' as any)
      .delete()
      .eq('org_id', orgId)
      .eq('provider', 'spot')
      .lt('ts_hour', threeMonthsAgo.toISOString());
    
    console.log('🧹 Cleaned up old data');
    
    return NextResponse.json({
      success: true,
      count: energyPrices.length,
      from,
      to,
      area,
      oldest_stored: from,
      newest_stored: to,
    });
    
  } catch (error) {
    console.error('Error in fetch historical route:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

