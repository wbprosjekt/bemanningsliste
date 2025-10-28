/**
 * Spot Price Provider
 * Fetches spot prices from Hva Koster Strømmen API (NO1-NO5)
 */

export interface SpotPrice {
  timestamp: Date;
  area: string; // NO1, NO2, NO3, NO4, NO5
  nok_per_kwh: number; // NOK/kWh incl. MVA
}

/**
 * Fetch spot prices from Hva Koster Strømmen API
 */
export async function fetchSpotPrices(
  area: string,
  date: Date
): Promise<number | null> {
  const dateStr = formatDate(date);
  const url = `https://www.hvakosterstrommen.no/api/v1/prices/${dateStr}_${area}.json`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch spot prices: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    // Find price for this hour
    const hour = date.getHours();
    const price = data[hour];
    
    if (price == null) {
      console.error(`No price found for hour ${hour}`);
      return null;
    }
    
    // Prices are typically in øre/kWh ex. MVA, convert to NOK/kWh incl. MVA
    // Check if API returns incl. or ex. MVA (may need adjustment based on API docs)
    const nokPerKwh = price / 100; // Convert øre to NOK
    
    // If API returns ex. MVA, add 25%
    // If API returns incl. MVA, use as is
    // For now, assuming API returns incl. MVA
    return nokPerKwh;
  } catch (error) {
    console.error('Error fetching spot prices:', error);
    return null;
  }
}

/**
 * Batch fetch spot prices for a date range
 */
export async function fetchSpotPricesRange(
  area: string,
  startDate: Date,
  endDate: Date
): Promise<SpotPrice[]> {
  const prices: SpotPrice[] = [];
  let current = new Date(startDate);
  
  while (current <= endDate) {
    const hourlyPrices = await fetchDailySpotPrices(area, current);
    prices.push(...hourlyPrices);
    current.setDate(current.getDate() + 1);
  }
  
  return prices;
}

/**
 * Fetch all hourly prices for a day
 */
async function fetchDailySpotPrices(
  area: string,
  date: Date
): Promise<SpotPrice[]> {
  // Correct format: 2025/10-25_NO1.json (not 2025-10-25_NO1.json)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const url = `https://www.hvakosterstrommen.no/api/v1/prices/${year}/${month}-${day}_${area}.json`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch spot prices for ${url}: ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    
    // Debug: Log first few entries to see structure
    const entries = Object.entries(data).slice(0, 5);
    console.log('Sample API response:', entries);
    
    return Object.entries(data)
      .map(([hour, priceData]) => {
        // priceData is an object like: { NOK_per_kWh: 0.62, EUR_per_kWh: 0.05, ... }
        const price = (priceData as any)?.NOK_per_kWh;
        
        // Skip if price is null/undefined or NaN
        if (price == null || isNaN(price)) {
          return null;
        }
        
        const timestamp = new Date(date);
        timestamp.setHours(parseInt(hour), 0, 0, 0);
        
        // Price is already in NOK/kWh, no conversion needed!
        
        return {
          timestamp,
          area,
          nok_per_kwh: price,
        };
      })
      .filter((p): p is SpotPrice => p !== null); // Remove null values
  } catch (error) {
    console.error('Error fetching daily spot prices:', error);
    return [];
  }
}

/**
 * Format date as YYYY/MM-DD for API
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}-${day}`;
}

/**
 * Get spot price for a specific hour from Supabase
 */
export async function getSpotPriceForHour(
  supabase: any,
  area: string,
  tsHour: string
): Promise<{ price_per_kwh: number } | null> {
  try {
    const { data, error } = await supabase
      .from('ref_energy_prices')
      .select('nok_per_kwh') // Correct column name
      .eq('area', area)
      .eq('ts_hour', tsHour)
      .eq('provider', 'spot')
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return { price_per_kwh: data.nok_per_kwh };
  } catch (error) {
    console.error('Error getting spot price:', error);
    return null;
  }
}

/**
 * Cache spot prices in Supabase (implement in API route)
 */
export interface SpotPriceCache {
  org_id: string;
  provider: 'spot';
  area: string;
  ts_hour: Date;
  nok_per_kwh: number;
  meta?: any;
}

