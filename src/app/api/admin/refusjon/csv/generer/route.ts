/**
 * API Route: Generate reimbursement report
 * POST /api/admin/refusjon/csv/generer
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/integrations/supabase/client';
import { buildReimbursementPdfBuffer } from '@/lib/refusjon/reimbursementPdf';
import { uploadReport } from '@/lib/refusjon/storageUtils';
import { generateCSVContent } from '@/lib/refusjon/refusjonCsv';
import type { ReimbursementPdfProps } from '@/lib/refusjon/reimbursementPdf';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 CSV Generer API called');
    
    // TODO: Fix authentication - skip for now
    console.log('⏭️ Skipping auth check for debugging');
    
    const body = await request.json();
    console.log('📦 Request body keys:', Object.keys(body));
    
    // Handle both field names
    const employeeId = body.employee_id || body.employeeId;
    const profileId = body.profile_id || body.profileId || null;
    const periodMonth = body.period_month || body.periodMonth;
    const reportData = body.analysis_data || body.reportData;
    
    console.log('📋 Parsed:', { employeeId, periodMonth, hasReportData: !!reportData });
    
    if (!employeeId || !periodMonth || !reportData) {
      return NextResponse.json(
        { error: 'Missing required fields', received: { employeeId, periodMonth, hasReportData: !!reportData } },
        { status: 400 }
      );
    }
    
    let profilesId: string | null = profileId;
    let orgId: string | null = null;
    let profileDisplayName: string | null = null;
    
    if (profilesId) {
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('id, org_id, display_name')
        .eq('id', profilesId)
        .maybeSingle();
      
      if (!profileRow) {
        console.warn('⚠️ Provided profile_id not found, falling back to name matching');
        profilesId = null;
      } else {
        orgId = profileRow.org_id;
        profileDisplayName = profileRow.display_name;
      }
    }
    
    // Get org_id and employee details from 'person' table (Tripletex employee)
    const { data: employee } = await supabase
      .from('person')
      .select('org_id, fornavn, etternavn, epost')
      .eq('id', employeeId)
      .single();
    
    if (!employee) {
      console.error('Employee not found:', employeeId);
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }
    
    console.log('✅ Employee found:', employee);
    
    if (!orgId) {
      orgId = employee.org_id;
    }
    
    if (!profilesId) {
      // Find matching profiles.id for this employee by name
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('org_id', orgId)
        .not('user_id', 'is', null);
    
      if (allProfiles && allProfiles.length > 0) {
        const employeeFullName = `${employee.fornavn} ${employee.etternavn}`;
        const matchingProfile = allProfiles.find(prof => 
          prof.display_name === employeeFullName ||
          prof.display_name?.includes(employee.fornavn || '') ||
          prof.display_name?.includes(employee.etternavn || '')
        );
        
        if (matchingProfile) {
          profilesId = matchingProfile.id;
          profileDisplayName = matchingProfile.display_name;
          console.log('🔗 Mapped by name:', employeeFullName, '-> profiles.id:', profilesId);
        } else {
          profilesId = allProfiles[0]?.id || null;
          profileDisplayName = allProfiles[0]?.display_name || null;
          console.warn('⚠️ No name match, using first profile as fallback:', profilesId);
        }
      }
    }
    
    if (!profilesId) {
      return NextResponse.json(
        { error: 'Fant ingen tilknyttet profil for denne ansatte' },
        { status: 404 }
      );
    }
    
    if (!orgId) {
      return NextResponse.json(
        { error: 'Fant ikke organisasjon for denne ansatte' },
        { status: 400 }
      );
    }
    
    console.log('📝 Using profiles.id for reimbursement:', profilesId);
    
    // Check for existing reimbursement for this period (using profilesId)
    const existingResponse = await supabase
      .from('ref_reimbursements' as any)
      .select('id')
      .eq('employee_id', profilesId)
      .eq('period_month', periodMonth + '-01')
      .maybeSingle();
    const existing = (existingResponse as any)?.data as { id: string } | null;
    
    if (existing) {
      console.log('⚠️ Reimbursement already exists for this period');
    }
    
    // Extract summary and analysis from reportData
    const summary = reportData.summary || {};
    const analysis = reportData.analysis || {};
    
    // Debug: Log analysis data structure
    console.log('📊 Report data from analysis:', {
      summary_total_kwh: summary.total_kwh,
      summary_total_refund: summary.total_refund,
      summary_total_energy_nok: summary.total_energy_nok,
      summary_total_nett_nok: summary.total_nett_nok,
      summary_total_support_nok: summary.total_support_nok,
      summary_total_effect_nok: summary.total_effect_nok,
      analysed_sessions_count: analysis.analysed_sessions?.length,
    });
    
    // Convert period_month (YYYY-MM) to first day of month for database
    const periodDate = `${periodMonth}-01`;
    
    // Get employee settings for policy and RFID (using profilesId already mapped earlier)
    const settingsResponse = await supabase
      .from('ref_employee_settings' as any)
      .select('*, ref_nett_profiles(*), ref_employee_keys(*)')
      .eq('profile_id', profilesId)
      .is('effective_to', null)
      .maybeSingle();
    const settings = (settingsResponse as any)?.data as any;
    
    // Calculate average NOK per kWh
    const avgNokPerKwh = summary.total_kwh > 0 
      ? summary.total_refund / summary.total_kwh 
      : 0;
    
    // Get RFID label
    const rfidLabel = (settings as any)?.ref_employee_keys?.[0]?.rfid_label || 'UNKNOWN';
    
    // Get policy label
    const policyLabel = (settings as any)?.policy === 'norgespris' 
      ? 'Norgespris' 
      : 'Spotpris + strømstøtte';
    
    const nettProfileLabel = (settings as any)?.ref_nett_profiles?.name || 'Standard TOU';
    
    // Get CSV hash from reportData metadata
    const sourceCsvSha256 = reportData.meta?.csv_hash || reportData.source_csv_sha256 || 'unknown';
    
    // Get price area from policy snapshot
    const priceArea = analysis.policy_snapshot?.priceArea || 'NO1';
    
    // Map analysed sessions to PDF details format
    const details = (analysis.analysed_sessions || []).slice(0, 10).map((session: any) => {
      // Parse start/end from session
      const startDate = session.start ? new Date(session.start) : null;
      const endDate = session.end ? new Date(session.end) : null;
      
      return {
        date: startDate ? startDate.toISOString().split('T')[0] : periodMonth + '-01',
        start: startDate ? startDate.toISOString().split('T')[1]?.slice(0, 5) : '00:00',
        end: endDate ? endDate.toISOString().split('T')[1]?.slice(0, 5) : '00:00',
        kwh: session.kwh || 0,
        price: {
          amountNok: (session.energy_nok || 0) + (session.nett_nok || 0) + (session.support_nok || 0),
        },
      };
    });

    const resolvedEmployeeName = profileDisplayName
      || (employee?.fornavn && employee?.etternavn
        ? `${employee.fornavn} ${employee.etternavn}` 
        : 'Unknown');
    
    const pdfProps: ReimbursementPdfProps = {
      orgName: 'FieldNote',
      periodLabel: periodMonth,
      employeeName: resolvedEmployeeName,
      employeeEmail: '', // Person table doesn't have email
      rfidLabel,
      priceArea,
      policyLabel,
      nettProfileLabel,
      generatedAtISO: new Date().toISOString(),
      sourceCsvSha256,
      summary: {
        monthLabel: periodMonth,
        totalKwh: summary.total_kwh || 0,
        avgNokPerKwh,
        energyAmountNok: summary.total_energy_nok || 0,
        effectChargeNok: summary.total_effect_nok || 0,
        totalRefundNok: summary.total_refund || 0,
      },
      details,
      notes: [
        'Rapport generert via Refusjon-modulen',
        ...(reportData.warnings || []),
      ],
    };
    
    // Generate PDF
    const pdfBuffer = await buildReimbursementPdfBuffer(pdfProps);
    
    // Upload PDF to Storage
    const pdfUrl = await uploadReport(
      supabase,
      orgId,
      employeeId,
      periodMonth,
      pdfBuffer,
      'pdf'
    );
    
    // Generate CSV with actual data - convert to row format
    // Note: We only have session-level data, not hourly, so we aggregate per session
    const csvRows = pdfProps.details.map(detail => ({
      date_hour: `${detail.date} 00:00`, // Use session start as hour
      rfid: rfidLabel,
      kwh_bit: detail.kwh || 0,
      energy_price_nok: detail.price?.amountNok || 0, // Simplification: use total as energy
      nett_price_nok: 0, // Not available at session level
      support_nok: 0, // Not available at session level
      total_nok: detail.price?.amountNok || 0,
      ordning: pdfProps.policyLabel?.includes('Norgespris') ? 'norgespris' : 'spot_med_stromstotte' as any,
      area: priceArea,
      notes: '',
    }));
    
    const csvContent = generateCSVContent(csvRows);
    const csvBuffer = Buffer.from(csvContent, 'utf-8');
    const csvUrl = await uploadReport(
      supabase,
      orgId,
      employeeId,
      periodMonth,
      csvBuffer,
      'csv'
    );
    
    // Create or update reimbursement record (UPSERT)
    const reimbursementData = {
      org_id: orgId,
      employee_id: profilesId, // Use profiles.id instead of person.id
      period_month: periodDate, // Use converted date (YYYY-MM-DD)
      total_kwh: summary.total_kwh || 0,
      total_energy_nok: summary.total_energy_nok || 0,
      total_nett_nok: summary.total_nett_nok || 0,
      total_support_nok: summary.total_support_nok || 0,
      total_effect_nok: summary.total_effect_nok || 0,
      total_amount_nok: summary.total_refund || 0,
      pdf_url: pdfUrl,
      csv_url: csvUrl,
      policy_snapshot: analysis.policy_snapshot || {},
      meta: {
        source: 'csv-easee-key-detailed',
        generated_at: new Date().toISOString(),
      },
    };
    
    const { data: reimbursement, error: upsertError } = await supabase
      .from('ref_reimbursements' as any)
      .upsert(reimbursementData, { onConflict: 'org_id,employee_id,period_month' })
      .select()
      .single();
    
    if (upsertError) {
      console.error('Error upserting reimbursement:', upsertError);
      return NextResponse.json(
        { error: 'Failed to create/update reimbursement record' },
        { status: 500 }
      );
    }
    
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
