"use client";

import { useEffect, useState } from "react";
import { codeToWeather } from "@/lib/weather";
import { useWeatherForecast, useCurrentTemperature } from "@/hooks/useWeather";

interface WeatherDay {
  date: string;
  code: number;
  tmax: number;
  tmin: number;
}

interface HistoricalWeather {
  icon: string;
  weathercode: number;
  lastUpdated: string;
}

interface WeatherHistory {
  [date: string]: HistoricalWeather;
}

interface WeatherDayPillsProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  weekDates: Date[];
}

export default function WeatherDayPills({
  selectedDate,
  onSelectDate,
  weekDates,
}: WeatherDayPillsProps) {
  const [loading, setLoading] = useState(true);
  const [coordinates, setCoordinates] = useState<{ lat: number; lon: number } | null>(null);

  // Get coordinates on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoordinates({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => setCoordinates({ lat: 60.0, lon: 10.85 }), // Nittedal fallback
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 600000 } // 10 min cache
      );
    } else {
      setCoordinates({ lat: 60.0, lon: 10.85 }); // Nittedal fallback
    }
  }, []);

  // Use React Query hooks for weather data
  const { data: forecastData, isLoading: forecastLoading } = useWeatherForecast(
    coordinates?.lat ?? 0, 
    coordinates?.lon ?? 0
  );
  
  const { data: currentTemp, isLoading: currentLoading } = useCurrentTemperature(
    coordinates?.lat ?? 0, 
    coordinates?.lon ?? 0
  );

  // Save today's weather to history when forecast data is available
  useEffect(() => {
    if (forecastData?.days && forecastData.days.length > 0) {
      saveDailyWeatherToHistory(forecastData.days[0]);
    }
  }, [forecastData]);

  // Clean up old historical data on mount
  useEffect(() => {
    cleanupOldWeatherHistory();
  }, []);

  // Determine overall loading state
  const isLoading = loading || forecastLoading || currentLoading;

  // Save today's weather to history
  function saveDailyWeatherToHistory(weatherDay: WeatherDay) {
    try {
      const historyKey = 'weather-history';
      const history: WeatherHistory = JSON.parse(localStorage.getItem(historyKey) || '{}');
      
      const weatherInfo = codeToWeather(weatherDay.code);
      if (!weatherInfo) return;

      history[weatherDay.date] = {
        icon: weatherInfo.emoji,
        weathercode: weatherDay.code,
        lastUpdated: new Date().toISOString()
      };

      localStorage.setItem(historyKey, JSON.stringify(history));
      console.log('Saved weather to history:', weatherDay.date, weatherInfo.emoji);
    } catch (error) {
      console.error('Failed to save weather history:', error);
    }
  }

  // Get historical weather for a date
  function getHistoricalWeather(date: Date): HistoricalWeather | null {
    try {
      const historyKey = 'weather-history';
      const history: WeatherHistory = JSON.parse(localStorage.getItem(historyKey) || '{}');
      const dateStr = date.toISOString().split('T')[0];
      return history[dateStr] || null;
    } catch (error) {
      console.error('Failed to get weather history:', error);
      return null;
    }
  }

  // Clean up old historical data (older than 7 days)
  function cleanupOldWeatherHistory() {
    try {
      const historyKey = 'weather-history';
      const history: WeatherHistory = JSON.parse(localStorage.getItem(historyKey) || '{}');
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      let cleaned = false;
      Object.keys(history).forEach(dateStr => {
        const date = new Date(dateStr);
        if (date < sevenDaysAgo) {
          delete history[dateStr];
          cleaned = true;
        }
      });

      if (cleaned) {
        localStorage.setItem(historyKey, JSON.stringify(history));
        console.log('Cleaned up old weather history');
      }
    } catch (error) {
      console.error('Failed to cleanup weather history:', error);
    }
  }

  // Get day label (Man, Tir, etc.)
  function getDayLabel(date: Date): string {
    return date
      .toLocaleDateString("no-NO", { weekday: "short" })
      .replace(".", "")
      .charAt(0).toUpperCase() + 
      date
      .toLocaleDateString("no-NO", { weekday: "short" })
      .replace(".", "")
      .slice(1);
  }

  // Get day type: past, today, or future
  function getDayType(date: Date): 'past' | 'today' | 'future' {
    const today = new Date();
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    
    if (date < dayStart) return 'past';
    if (date >= dayStart && date < dayEnd) return 'today';
    return 'future';
  }


  // Find weather for a specific date
  function getWeatherForDate(date: Date): WeatherDay | null {
    if (!forecastData?.days) return null;
    const dateStr = date.toISOString().split("T")[0];
    return forecastData.days.find((d) => d.date === dateStr) ?? null;
  }

  // Get display data for a date
  function getDisplayData(date: Date): { 
    weather: WeatherDay | null; 
    temperature: number | null; 
    icon: string; 
    showTemp: boolean;
  } {
    const dayType = getDayType(date);
    const weather = getWeatherForDate(date);
    const weatherInfo = weather ? codeToWeather(weather.code) : null;
    const historicalWeather = getHistoricalWeather(date);

    console.log('getDisplayData:', { 
      date: date.toISOString().split('T')[0], 
      dayType, 
      weather, 
      currentTemp,
      historicalWeather 
    });

    switch (dayType) {
      case 'past':
        // Use historical data if available, otherwise generic icon
        if (historicalWeather) {
          return {
            weather: null,
            temperature: null,
            icon: historicalWeather.icon,
            showTemp: false
          };
        }
        return {
          weather: null,
          temperature: null,
          icon: '🌡️', // Generic thermometer for past days without history
          showTemp: false
        };
      
      case 'today':
        // For today, use current weather if available, otherwise forecast
        const todayWeather = weather || (currentTemp ? { 
          date: date.toISOString().split('T')[0], 
          code: 1, // Default sunny weather
          tmax: currentTemp, 
          tmin: currentTemp 
        } : null);
        const todayWeatherInfo = todayWeather ? codeToWeather(todayWeather.code) : null;
        
        return {
          weather: todayWeather,
          temperature: currentTemp,
          icon: todayWeatherInfo?.emoji ?? '🌡️',
          showTemp: currentTemp !== null
        };
      
      case 'future':
        return {
          weather: weather,
          temperature: weather?.tmax ?? null,
          icon: weatherInfo?.emoji ?? '🌡️',
          showTemp: weather !== null
        };
      
      default:
        return {
          weather: null,
          temperature: null,
          icon: '🌡️',
          showTemp: false
        };
    }
  }

  return (
    <div className="sticky top-16 bg-white z-20 py-2 border-b shadow-sm">
      <div className="flex gap-1 justify-center px-1 sm:px-2">
        {weekDates.map((date, index) => {
          const isActive =
            date.toDateString() === selectedDate.toDateString();
          const displayData = getDisplayData(date);
          const dayNumber = date.getDate();

          return (
            <button
              key={index}
              onClick={() => onSelectDate(date)}
              className={`
                flex flex-col items-center gap-0.5 
                min-w-[44px] xs:min-w-[50px] sm:min-w-[60px] md:min-w-[70px]
                px-1.5 py-2
                rounded-xl
                border-2
                transition-all duration-300
                flex-shrink-0
                ${
                  isActive
                    ? "bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/30"
                    : "bg-white border-gray-200 text-gray-900 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5"
                }
              `}
              title={displayData.weather ? `${codeToWeather(displayData.weather.code)?.label} • ${Math.round(displayData.weather.tmax)}° / ${Math.round(displayData.weather.tmin)}°` : undefined}
            >
              {/* Weather emoji */}
              {!isLoading && displayData.icon && (
                <span className="text-lg sm:text-xl leading-none">
                  {displayData.icon}
                </span>
              )}
              {isLoading && (
                <span className="text-lg sm:text-xl leading-none opacity-30">⏳</span>
              )}

              {/* Temperature */}
              {!isLoading && displayData.showTemp && displayData.temperature && (
                <span
                  className={`text-[10px] sm:text-xs font-semibold leading-none ${
                    isActive ? "text-white/90" : "text-gray-600"
                  }`}
                >
                  {Math.round(displayData.temperature)}°
                </span>
              )}

              {/* Day name */}
              <span
                className={`text-[11px] sm:text-xs font-semibold leading-none ${
                  isActive ? "text-white" : "text-gray-700"
                }`}
              >
                {getDayLabel(date)}
              </span>

              {/* Day number */}
              <span
                className={`text-lg sm:text-xl font-bold leading-none ${
                  isActive ? "text-white" : "text-gray-900"
                }`}
              >
                {dayNumber}
              </span>

              {/* Active indicator dot */}
              {isActive && (
                <div className="w-1 h-1 bg-white rounded-full mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

