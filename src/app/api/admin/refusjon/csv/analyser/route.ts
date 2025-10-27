/**
 * API Route: Analyse CSV and calculate prices
 * POST /api/admin/refusjon/csv/analyser
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { splitIntoTimeBits } from '@/lib/refusjon/timeSplitter';
import { calculateSessionReimbursement } from '@/lib/refusjon/pricingEngine';

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
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const body = await request.json();
    const { employeeId, periodMonth, sessionData } = body;
    
    if (!employeeId || !periodMonth || !sessionData) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Get employee settings
    const { data: settings } = await supabase
      .from('ref_employee_settings')
      .select('*')
      .eq('profile_id', employeeId)
      .single();
    
    if (!settings) {
      return NextResponse.json(
        { error: 'Employee has no pricing policy configured' },
        { status: 400 }
      );
    }
    
    // Get org_id from employee profile
    const { data: employee } = await supabase
      .from('profiles')
      .select('org_id, default_area')
      .eq('id', employeeId)
      .single();
    
    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }
    
    // Get spot prices for the period
    const missingHours: Array<{ area: string; ts_hour: string }> = [];
    
    // TODO: Implement actual price fetching
    // For now, return structure with dummy data
    
    return NextResponse.json({
      success: true,
      analysis: {
        total_sessions: sessionData.length,
        estimated_total_kwh: sessionData.reduce((sum: number, s: any) => sum + s.kwh, 0),
        estimated_total_nok: 0, // Calculate from pricing engine
        pricing_breakdown: [],
        missing_hours: missingHours,
      },
      warnings: [],
    });
    
  } catch (error) {
    console.error('Error analysing CSV:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

