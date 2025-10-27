/**
 * API Route: Parse and validate CSV
 * POST /api/admin/refusjon/csv/parse
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseCSV } from '@/lib/refusjon/csvParser';
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
    
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const employeeId = formData.get('employee_id') as string;
    const periodMonth = formData.get('period_month') as string;
    
    if (!file || !employeeId || !periodMonth) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Parse CSV
    const result = await parseCSV(file);
    
    if (result.error) {
      return NextResponse.json(
        {
          error: result.error.message,
          error_code: result.error.code,
          missing_columns: result.error.missing_columns,
        },
        { status: 422 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: result.data,
    });
    
  } catch (error) {
    console.error('Error parsing CSV:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

