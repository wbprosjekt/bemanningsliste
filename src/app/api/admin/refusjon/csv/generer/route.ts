/**
 * API Route: Generate reimbursement report
 * POST /api/admin/refusjon/csv/generer
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
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const body = await request.json();
    const { employeeId, periodMonth, reportData } = body;
    
    if (!employeeId || !periodMonth || !reportData) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Check for existing reimbursement for this period
    const { data: existing } = await supabase
      .from('ref_reimbursements')
      .select('id')
      .eq('employee_id', employeeId)
      .eq('period_month', periodMonth)
      .single();
    
    if (existing) {
      return NextResponse.json(
        {
          error: 'Reimbursement already exists for this period',
          existing_reimbursement_id: existing.id,
        },
        { status: 409 }
      );
    }
    
    // Get org_id from employee
    const { data: employee } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', employeeId)
      .single();
    
    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }
    
    // TODO: Generate PDF and CSV
    // TODO: Upload to Supabase Storage
    // TODO: Create reimbursement record
    
    // For now, return placeholder
    const reimbursement = {
      id: 'placeholder',
      org_id: employee.org_id,
      employee_id: employeeId,
      period_month: periodMonth,
      total_kwh: reportData.total_kwh || 0,
      total_energy_nok: reportData.total_energy_nok || 0,
      total_nett_nok: reportData.total_nett_nok || 0,
      total_support_nok: reportData.total_support_nok || 0,
      total_effect_nok: reportData.total_effect_nok || 0,
      total_amount_nok: reportData.total_amount_nok || 0,
      pdf_url: null,
      csv_url: null,
      meta: {
        source: 'csv-easee-key-detailed',
        generated_at: new Date().toISOString(),
      },
    };
    
    return NextResponse.json({
      success: true,
      reimbursement,
    });
    
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

