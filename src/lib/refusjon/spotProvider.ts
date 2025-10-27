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
  const dateStr = formatDate(date);
  const url = `https://www.hvakosterstrommen.no/api/v1/prices/${dateStr}_${area}.json`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch spot prices for ${dateStr}: ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    
    return Object.entries(data).map(([hour, price]) => {
      const timestamp = new Date(date);
      timestamp.setHours(parseInt(hour), 0, 0, 0);
      
      return {
        timestamp,
        area,
        nok_per_kwh: (price as number) / 100, // Convert øre to NOK
      };
    });
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

