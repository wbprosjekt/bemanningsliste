/**
 * React Query hooks for weather data
 * Provides optimized caching and request deduplication for weather APIs
 */

import { useQuery } from '@tanstack/react-query';

interface WeatherData {
  days: Array<{
    date: string;
    code: number;
    tmax: number;
    tmin: number;
  }>;
}

interface CurrentWeatherData {
  currentWeather: {
    temperature: number;
    weathercode: number;
  };
}

/**
 * Hook for fetching weather forecast data
 */
export function useWeatherForecast(lat: number, lon: number) {
  return useQuery({
    queryKey: ['weather', 'forecast', lat, lon],
    queryFn: async (): Promise<WeatherData> => {
      const res = await fetch(`/api/forecast?lat=${lat}&lon=${lon}`);
      if (!res.ok) {
        throw new Error(`Weather forecast API failed: ${res.status}`);
      }
      return res.json();
    },
    enabled: !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0,
    staleTime: 60 * 60 * 1000, // 1 hour - forecast doesn't change often
    gcTime: 2 * 60 * 60 * 1000, // 2 hours garbage collection
    retry: 2,
    retryDelay: 1000,
  });
}

/**
 * Hook for fetching current weather data
 */
export function useCurrentWeather(lat: number, lon: number) {
  return useQuery({
    queryKey: ['weather', 'current', lat, lon],
    queryFn: async (): Promise<CurrentWeatherData> => {
      const res = await fetch(`/api/current-weather?lat=${lat}&lon=${lon}`);
      if (!res.ok) {
        throw new Error(`Current weather API failed: ${res.status}`);
      }
      return res.json();
    },
    enabled: !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0,
    staleTime: 15 * 60 * 1000, // 15 minutes - current weather updates more frequently
    gcTime: 60 * 60 * 1000, // 1 hour garbage collection
    retry: 2,
    retryDelay: 1000,
  });
}

/**
 * Hook for getting current temperature (extracted from current weather)
 */
export function useCurrentTemperature(lat: number, lon: number) {
  const { data, ...rest } = useCurrentWeather(lat, lon);
  
  return {
    ...rest,
    data: data?.currentWeather?.temperature ?? null,
  };
}
