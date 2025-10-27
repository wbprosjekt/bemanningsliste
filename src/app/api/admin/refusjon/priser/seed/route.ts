/**
 * API Route: Seed spot prices
 * POST /api/admin/refusjon/priser/seed
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
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
    const { area, rows } = body;
    
    if (!area || !rows || !Array.isArray(rows)) {
      return NextResponse.json(
        { error: 'Missing area or rows' },
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
    
    // Prepare data for upsert
    const energyPrices = rows.map((row: any) => ({
      org_id: profile.org_id,
      provider: 'spot',
      area,
      ts_hour: row.ts_hour,
      nok_per_kwh: row.nok_per_kwh,
      meta: { estimated: false, source: 'manual' },
    }));
    
    // Upsert to database
    const { error } = await supabase
      .from('ref_energy_prices')
      .upsert(energyPrices, {
        onConflict: 'org_id,provider,area,ts_hour',
      });
    
    if (error) {
      console.error('Error seeding spot prices:', error);
      return NextResponse.json(
        { error: 'Failed to seed prices' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      count: energyPrices.length,
    });
    
  } catch (error) {
    console.error('Error in seed route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

