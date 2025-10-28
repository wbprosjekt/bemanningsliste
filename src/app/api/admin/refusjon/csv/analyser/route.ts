/**
 * API Route: Analyse CSV and calculate prices
 * POST /api/admin/refusjon/csv/analyser
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/integrations/supabase/client';
import { splitIntoTimeBits } from '@/lib/refusjon/timeSplitter';
import { calculateReimbursementForBit } from '@/lib/refusjon/pricingEngine';
import { getSpotPriceForHour } from '@/lib/refusjon/spotProvider';
import { matchToUTimeWindow } from '@/lib/refusjon/touMatcher';

export type PolicySnapshot = {
  policy: string;
  policyParams: Record<string, any>;
  netProfileId?: string | null;
  netProfileVersion?: string | null;
  effectTierId?: string | null;
  effectTierFee: number;
  estimatedPeakKw: number;
  priceArea: string;
};

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 CSV Analyser API called');
    
    // TODO: Fix authentication - skip for now
    console.log('⏭️ Skipping auth check for debugging');
    
    const body = await request.json();
    console.log('📦 Request body:', { 
      hasEmployeeId: !!body.employee_id, 
      hasPeriodMonth: !!body.period_month,
      hasParsedData: !!body.parsed_data 
    });
    
    const employeeId = body.employee_id;
    const profileId = body.profile_id || body.profileId || null;
    const periodMonth = body.period_month;
    const rawSessionData = body.parsed_data?.rows || [];
    
    // Map CSV parser format to analyser format
    const sessionData = rawSessionData.map((row: any) => ({
      id: `${row.start_time}_${row.end_time}`,
      start: row.start_time,
      end: row.end_time,
      kwh: row.kwh,
      rfid: row.rfid_or_user,
      charger: row.charger_name,
      address: row.address,
    }));
    
    console.log('📋 Session data received:', {
      rawCount: rawSessionData.length,
      mappedCount: sessionData.length,
      firstRaw: rawSessionData[0],
      firstMapped: sessionData[0]
    });
    
    if (!employeeId || !periodMonth || !sessionData || sessionData.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Get employee (Tripletex person) for org_id and name
    const { data: employee } = await supabase
      .from('person')
      .select('org_id, fornavn, etternavn')
      .eq('id', employeeId)
      .single();
    
    if (!employee) {
      console.error('Employee not found:', employeeId);
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }
    
    console.log('✅ Employee found, org_id:', employee.org_id);
    
    let orgId: string | null = employee.org_id;
    let profilesId: string | null = profileId;
    
    if (profilesId) {
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('id, org_id')
        .eq('id', profilesId)
        .maybeSingle();
      
      if (!profileRow) {
        console.warn('⚠️ Provided profile_id not found, falling back to name matching');
        profilesId = null;
      } else {
        if (!orgId) {
          orgId = profileRow.org_id;
        } else if (orgId !== profileRow.org_id) {
          console.warn('⚠️ Provided profile belongs to different org, ignoring profileId');
          profilesId = null;
        }
      }
    }
    
    // Map person.id to profiles.id for settings lookup
    // person.id is from Tripletex, profiles.id is for auth users
    if (!profilesId) {
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('org_id', orgId)
        .not('user_id', 'is', null);
      
      const employeeFullName = `${employee.fornavn} ${employee.etternavn}`;
      if (employeeFullName && allProfiles && allProfiles.length > 0) {
        const matchingProfile = allProfiles.find(prof => 
          prof.display_name === employeeFullName ||
          prof.display_name?.includes(employee.fornavn || '') ||
          prof.display_name?.includes(employee.etternavn || '')
        );
        if (matchingProfile) {
          profilesId = matchingProfile.id;
          console.log('🔗 Mapped person.id to profiles.id:', employeeFullName, '->', profilesId);
        } else {
          console.warn('⚠️ No matching profile found for', employeeFullName);
          profilesId = allProfiles[0]?.id || null;
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
    
    // Get employee settings with pricing policy using profiles.id
    let { data: settings } = await supabase
      .from('ref_employee_settings' as any)
      .select('*')
      .eq('profile_id', profilesId)
      .is('effective_to', null)
      .maybeSingle();
    
    // Create default settings if missing (using profiles.id)
    if (!settings) {
      console.log('⚠️ No settings found, creating defaults for profiles.id:', profilesId);
      
      const defaultSettings = {
        org_id: orgId,
        profile_id: profilesId, // Use profiles.id, not person.id
        policy: 'spot_med_stromstotte', // Default to spot + strømstøtte
        default_area: 'NO1',
        terskel_nok_per_kwh: 0.75,
        stotte_andel: 0.9,
      };
      
      const { data: newSettings, error: insertError } = await supabase
        .from('ref_employee_settings' as any)
        .insert(defaultSettings)
        .select()
        .single();
      
      if (insertError) {
        console.error('Error creating settings:', insertError);
        // Use fallback settings object
        settings = {
          profile_id: profilesId,
          org_id: orgId,
          policy: 'spot_med_stromstotte',
          default_area: 'NO1',
          terskel_nok_per_kwh: 0.75,
          stotte_andel: 0.9,
        } as any;
      } else {
        settings = newSettings;
        console.log('✅ Created default settings:', settings);
      }
    }
    
    console.log('🧾 Active settings', {
      profile_id: profilesId,
      policy: (settings as any)?.policy,
      net_profile_id: (settings as any)?.net_profile_id,
      effect_tier_id: (settings as any)?.effect_tier_id,
      default_area: (settings as any)?.default_area,
      fastpris: (settings as any)?.fastpris_nok_per_kwh,
    });
    
    const priceArea = (settings as any)?.default_area || 'NO1';
    
    // Fetch net profile and effect tiers separately to avoid type issues
    let nettProfile = null;
    let effectTiers: any[] = [];
    
    let netProfileId: string | null = (settings as any)?.net_profile_id ?? null;

    if (!netProfileId) {
      const { data: availableNetProfiles } = await supabase
        .from('ref_nett_profiles' as any)
        .select('id, name')
        .eq('org_id', orgId);

      const list = availableNetProfiles || [];
      if (list.length === 1) {
        netProfileId = list[0].id;
        console.log('ℹ️ Ingen nettprofil var satt – bruker standard:', list[0].id, list[0].name);
        const { error: updateError } = await supabase
          .from('ref_employee_settings' as any)
          .update({ net_profile_id: netProfileId })
          .eq('profile_id', profilesId)
          .is('effective_to', null);
        if (updateError) {
          console.warn('⚠️ Klarte ikke å lagre standard nettprofil:', updateError);
        } else {
          (settings as any).net_profile_id = netProfileId;
        }
      } else {
        console.log('⚠️ Ingen nettprofil valgt og kunde har', list.length, 'profiler tilgjengelig');
      }
    }

    if (netProfileId) {
      const { data: npData } = await supabase
        .from('ref_nett_profiles' as any)
        .select('*')
        .eq('id', netProfileId)
        .single();
      nettProfile = npData;
      console.log('🔌 Nettprofil funnet', {
        id: netProfileId,
        name: (npData as any)?.name,
        timezone: (npData as any)?.timezone,
        includes_vat: (npData as any)?.meta?.includes_vat,
      });
    }
    
    if ((settings as any)?.effect_tier_id) {
      const { data: etData } = await supabase
        .from('ref_effect_tiers' as any)
        .select('*')
        .eq('id', (settings as any).effect_tier_id)
        .single();
      effectTiers = etData ? [etData] : [];
    }
    
    const policyType = (settings as any)?.policy || 'spot_med_stromstotte';
    const policyParams = {
      fastpris_nok_per_kwh: (settings as any)?.fastpris_nok_per_kwh,
      terskel_nok_per_kwh: (settings as any)?.terskel_nok_per_kwh ?? 0.75,
      stotte_andel: (settings as any)?.stotte_andel ?? 0.9,
    };
    
    // Process each session: split into hours and calculate prices
    const analysedSessions: any[] = [];
    const missingHours = new Set<string>();
    let totalKwh = 0;
    let totalEnergyNok = 0;
    let totalNettNok = 0;
    let totalSupportNok = 0;
    
    const warnings: string[] = [];
    
    console.log('📊 Processing sessions:', sessionData.length);
    
    for (const session of sessionData) {
      if (!session.start || !session.end || !session.kwh) {
        warnings.push(`Invalid session data: ${session.id || 'unknown'}`);
        continue;
      }
      
      console.log(`📝 Processing session: ${session.start} to ${session.end}, ${session.kwh} kWh`);
      
      // Split session into hourly time bits
      const splitResult = splitIntoTimeBits(
        typeof session.start === 'string' ? session.start : session.start,
        typeof session.end === 'string' ? session.end : session.end,
        session.kwh
      );
      
      console.log(`✅ Split into ${splitResult.bits.length} time bits`);
      console.log(`   First bit: ${splitResult.bits[0]?.local_hour} (${splitResult.bits[0]?.kwh} kWh)`);
      console.log(`   Last bit: ${splitResult.bits[splitResult.bits.length - 1]?.local_hour} (${splitResult.bits[splitResult.bits.length - 1]?.kwh} kWh)`);
      
      const timeBits = splitResult.bits;
      if (splitResult.warnings.length > 0) {
        warnings.push(...splitResult.warnings.map(w => `${session.id}: ${w}`));
      }
      
      let sessionEnergyNok = 0;
      let sessionNettNok = 0;
      let sessionSupportNok = 0;
      
      // Process each hour
      for (const bit of timeBits) {
        // Format hour for database query (YYYY-MM-DDTHH:mm)
        const tsHourStr = bit.local_hour.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
        
        // Get spot price for this hour
        const spotPrice = await getSpotPriceForHour(
          supabase,
          priceArea,
          tsHourStr
        );
        
        console.log(`Price lookup for ${tsHourStr}:`, spotPrice ? `Found: ${spotPrice.price_per_kwh}` : 'Not found');
        
        if (!spotPrice) {
          missingHours.add(`${priceArea}:${tsHourStr}`);
          warnings.push(`Missing spot price for ${tsHourStr} in ${priceArea}`);
        }
        
        // Match to TOU window if net profile exists
        let timeWindow = null;
        if (nettProfile) {
          const rawWindow = await matchToUTimeWindow(
            supabase,
            (settings as any).net_profile_id,
            bit.local_hour
          );
          
          if (rawWindow) {
            const includesVat = (nettProfile as any)?.meta?.includes_vat ?? false;
            const vatMultiplier = includesVat ? 1 : 1.25;
            const energyOre = Number(rawWindow.energy_ore_per_kwh || 0);
            const timeOre = Number(rawWindow.time_ore_per_kwh || 0);
            
            timeWindow = {
              ...rawWindow,
              nett_energy_nok_per_kwh: (energyOre / 100) * vatMultiplier,
              nett_time_nok_per_kwh: (timeOre / 100) * vatMultiplier,
            };
            
            console.log('⏱️ Nettvindu', {
              tsHour: tsHourStr,
              energy_ore: rawWindow.energy_ore_per_kwh,
              time_ore: rawWindow.time_ore_per_kwh,
              includesVat,
              nett_energy_nok_per_kwh: timeWindow.nett_energy_nok_per_kwh,
              nett_time_nok_per_kwh: timeWindow.nett_time_nok_per_kwh,
            });
          } else {
            console.log('⚠️ Ingen nettvindu treff for', tsHourStr);
          }
        }
        
        // Calculate reimbursement for this hour
        const result = calculateReimbursementForBit({
          policy: policyType,
          policyParams,
          kwh: bit.kwh,
          tsHour: tsHourStr,
          spotPricePerKwhExVat: spotPrice?.price_per_kwh || 0,
          touWindow: timeWindow || undefined,
          nettProfile: nettProfile || undefined,
        });
        
        sessionEnergyNok += result.energy_nok || 0;
        sessionNettNok += result.nett_nok || 0;
        sessionSupportNok += result.support_nok || 0;
        
        console.log('💡 Bit resultat', {
          tsHour: tsHourStr,
          kwh: bit.kwh,
          energy_nok: result.energy_nok,
          nett_nok: result.nett_nok,
          support_nok: result.support_nok,
        });
      }
      
      totalKwh += session.kwh;
      totalEnergyNok += sessionEnergyNok;
      totalNettNok += sessionNettNok;
      totalSupportNok += sessionSupportNok;
      
      console.log(`💰 Session totals: ${session.kwh.toFixed(1)} kWh, energy: ${sessionEnergyNok.toFixed(2)} kr, nett: ${sessionNettNok.toFixed(2)} kr, støtte: ${sessionSupportNok.toFixed(2)} kr`);
      
      analysedSessions.push({
        ...session,
        hourly_bits: timeBits,
        energy_nok: sessionEnergyNok,
        nett_nok: sessionNettNok,
        support_nok: sessionSupportNok,
      });
    }
    
    console.log(`🔢 FINAL TOTALS: ${totalKwh.toFixed(1)} kWh, ${totalEnergyNok.toFixed(2)} kr, nett: ${totalNettNok.toFixed(2)} kr, støtte: ${totalSupportNok.toFixed(2)} kr`);
    
    // Calculate effect charge estimate
    const maxKwh = Math.max(...analysedSessions.map(s => s.kwh || 0), 0);
    const estimatedPeakKw = maxKwh / 0.5; // Rough estimate: max kWh in any 0.5h window
    
    let totalEffectNok = 0;
    for (const tier of effectTiers) {
      if (estimatedPeakKw >= tier.kw_from && (!tier.kw_to || estimatedPeakKw <= tier.kw_to)) {
        totalEffectNok = tier.monthly_fee_nok || 0;
        break;
      }
    }
    
    // Build policy snapshot for the reimbursement record
    const policySnapshot: PolicySnapshot = {
      policy: policyType,
      policyParams,
      netProfileId,
      netProfileVersion: (nettProfile as any)?.version || null,
      effectTierId: (settings as any).effect_tier_id,
      effectTierFee: totalEffectNok,
      estimatedPeakKw,
      priceArea,
    };
    
    return NextResponse.json({
      success: true,
      summary: {
        total_sessions: analysedSessions.length,
        total_kwh: totalKwh,
        total_refund: totalEnergyNok + totalNettNok + totalSupportNok + totalEffectNok,
        total_energy_nok: totalEnergyNok,
        total_nett_nok: totalNettNok,
        total_support_nok: totalSupportNok,
        total_effect_nok: totalEffectNok,
      },
      analysis: {
        analysed_sessions: analysedSessions,
        policy_snapshot: policySnapshot,
        missing_hours: Array.from(missingHours),
      },
      warnings,
    });
    
  } catch (error) {
    console.error('Error analysing CSV:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
