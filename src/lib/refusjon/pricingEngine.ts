/**
 * Pricing Engine for Reimbursement Calculation
 * Supports Norgespris (fixed price) and Spot + strømstøtte (90% over 0.75 kr/kWh ex. MVA)
 * Handles MVA normalization and TOU nettariff
 */

// Removed unused import: TimeBits

export type PricePolicy = 'norgespris' | 'spot_med_stromstotte';

export interface PriceBreakdown {
  // Energy pricing
  spot_incl_nok_per_kwh?: number; // Price including MVA
  nett_incl_nok_per_kwh?: number;
  support_nok_per_kwh?: number; // Støtte (positive value for display, marked with minus)
  effective_energy_nok_per_kwh: number;
  
  // Amounts
  amount_nok: number;
  
  // Metadata
  area?: string; // NO1-NO5
  policy?: PricePolicy;
}

export interface PricingContext {
  // Employee policy
  policy: PricePolicy;
  default_area: string; // NO1-NO5
  fastpris_nok_per_kwh?: number; // Norgespris fixed price
  manedlig_tak_kwh?: number; // Monthly limit for Norgespris
  terskel_nok_per_kwh: number; // Default 0.75 ex. MVA
  stotte_andel: number; // Default 0.9 (90%)
  
  // Energy prices (time-series)
  getSpotPrice: (timestamp: Date) => Promise<number>; // Returns NOK/kWh incl. MVA
  
  // TOU nettariff
  getNettPrice: (timestamp: Date) => Promise<number>; // Returns NOK/kWh incl. MVA
}

/**
 * Calculate reimbursement for a session (time-split into bits)
 */
/**
 * Simplified reimbursement calculation for a single time bit
 * Returns NOK amounts (excluding kWh breakdown)
 */
export function calculateReimbursementForBit(params: {
  policy: 'norgespris' | 'spot_med_stromstotte';
  policyParams: Record<string, any>;
  kwh: number;
  tsHour: string;
  spotPricePerKwhExVat: number;
  touWindow?: any;
  nettProfile?: any;
}): {
  energy_nok: number;
  nett_nok: number;
  support_nok: number;
} {
  const { policy, policyParams, kwh, spotPricePerKwhExVat, touWindow, nettProfile } = params;
  
  let energyNok = 0;
  let nettNok = 0;
  let supportNok = 0;
  
  // TOU nettariff
  if (touWindow && nettProfile) {
    const nettEnergyPerKwh = touWindow.nett_energy_nok_per_kwh || 0;
    const nettTimePerKwh = touWindow.nett_time_nok_per_kwh || 0;
    nettNok = kwh * (nettEnergyPerKwh + nettTimePerKwh);
  }
  
  // Energy pricing based on policy
  if (policy === 'norgespris') {
    // Fixed price per kWh
    const fastpris = parseFloat(policyParams.fastpris_nok_per_kwh || 0);
    energyNok = kwh * fastpris;
  } else {
    // Spot + strømstøtte (spot_med_stromstotte)
    // Calculate strømstøtte (90% of amount over 0.75 NOK/kWh ex. MVA)
    const terskel = parseFloat(policyParams.terskel_nok_per_kwh || 0.75);
    const stotteAndel = parseFloat(policyParams.stotte_andel || 0.9);
    
    const overTerskel = Math.max(0, spotPricePerKwhExVat - terskel);
    const stottePerKwh = overTerskel * stotteAndel;
    
    // Energy cost = spot - støtte (converted to incl. MVA)
    const energyCostExVat = spotPricePerKwhExVat - stottePerKwh;
    const energyCostInclVat = energyCostExVat * 1.25;
    
    energyNok = kwh * energyCostInclVat;
    supportNok = kwh * stottePerKwh * 1.25; // Støtte incl. MVA
  }
  
  return {
    energy_nok: energyNok,
    nett_nok: nettNok,
    support_nok: supportNok,
  };
}

/**
 * Legacy async function for backward compatibility
 * @deprecated Use calculateReimbursementForBit instead
 */
export async function calculateSessionReimbursement(
  session: {
    kwh: number;
    start: string;
    end: string;
  },
  context: PricingContext
): Promise<PriceBreakdown[]> {
  // Split into hourly bits
  const bits = timeSplitIntoHourlyBits(session.start, session.end, session.kwh);
  
  // Calculate price for each bit
  const results: PriceBreakdown[] = [];
  
  for (const bit of bits) {
    const timestamp = bit.local_hour;
    
    // Get spot price for this hour (incl. MVA)
    const spotIncl = await context.getSpotPrice(timestamp);
    
    // Get nett price for this hour (incl. MVA)
    const nettIncl = await context.getNettPrice(timestamp);
    
    // Calculate energy price based on policy
    let energyIncl = 0;
    let support = 0;
    
    if (context.policy === 'norgespris') {
      // Norgespris: use fixed price (already incl. MVA)
      energyIncl = context.fastpris_nok_per_kwh || spotIncl;
    } else {
      // Spot + strømstøtte
      // Convert to ex. MVA for støtte calculation
      const spotEx = spotIncl / 1.25;
      
      // Calculate støtte
      const overTerskel = Math.max(0, spotEx - context.terskel_nok_per_kwh);
      support = overTerskel * context.stotte_andel;
      
      // Calculate effective price (ex. støtte), then re-add MVA
      energyIncl = (spotEx - support) * 1.25;
    }
    
    // Total amount for this bit
    const amount = bit.kwh * (energyIncl + nettIncl);
    
    results.push({
      spot_incl_nok_per_kwh: spotIncl,
      nett_incl_nok_per_kwh: nettIncl,
      support_nok_per_kwh: support * 1.25, // Convert to incl. MVA for display
      effective_energy_nok_per_kwh: energyIncl,
      amount_nok: amount,
      area: context.default_area,
      policy: context.policy,
    });
  }
  
  return results;
}

/**
 * Helper: Split session into hourly bits (simplified, should use timeSplitter)
 */
function timeSplitIntoHourlyBits(
  start: string,
  end: string,
  totalKwh: number
): Array<{ local_hour: Date; kwh: number }> {
  // For now, simple implementation
  // TODO: Use actual timeSplitter logic
  const startDate = new Date(start);
  const endDate = new Date(end);
  const totalMs = endDate.getTime() - startDate.getTime();
  
  const bits: Array<{ local_hour: Date; kwh: number }> = [];
  let current = new Date(startDate);
  
  while (current < endDate) {
    let next = new Date(current);
    next.setHours(next.getHours() + 1, 0, 0, 0);
    if (next > endDate) next = endDate;
    
    const ms = next.getTime() - current.getTime();
    const fraction = ms / totalMs;
    const kwh = totalKwh * fraction;
    
    bits.push({
      local_hour: new Date(current),
      kwh,
    });
    
    current = next;
  }
  
  return bits;
}

// Removed unused import: splitIntoTimeBits

