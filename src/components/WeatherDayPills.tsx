"use client";

import { useEffect, useState } from "react";
import { codeToWeather } from "@/lib/weather";

interface WeatherDay {
  date: string;
  code: number;
  tmax: number;
  tmin: number;
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
  const [weatherDays, setWeatherDays] = useState<WeatherDay[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadWeather(lat: number, lon: number) {
      try {
        const res = await fetch(`/api/forecast?lat=${lat}&lon=${lon}`);
        if (!res.ok) {
          console.error("Weather API failed:", res.status);
          setWeatherDays(null);
          return;
        }
        const data = await res.json();
        setWeatherDays(data?.days ?? null);
      } catch (error) {
        console.error("Weather fetch error:", error);
        setWeatherDays(null);
      } finally {
        setLoading(false);
      }
    }

    // Try geolocation, fallback to Nittedal
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => loadWeather(pos.coords.latitude, pos.coords.longitude),
        () => loadWeather(60.0, 10.85), // Nittedal fallback
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 600000 } // 10 min cache
      );
    } else {
      loadWeather(60.0, 10.85); // Nittedal fallback
    }
  }, []);

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

  // Find weather for a specific date
  function getWeatherForDate(date: Date): WeatherDay | null {
    if (!weatherDays) return null;
    const dateStr = date.toISOString().split("T")[0];
    return weatherDays.find((d) => d.date === dateStr) ?? null;
  }

  return (
    <div className="sticky top-16 bg-white z-20 py-2 border-b shadow-sm">
      <div className="flex gap-1 justify-center px-1 sm:px-2">
        {weekDates.map((date, index) => {
          const isActive =
            date.toDateString() === selectedDate.toDateString();
          const weather = getWeatherForDate(date);
          const weatherInfo = weather ? codeToWeather(weather.code) : null;
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
              title={weatherInfo ? `${weatherInfo.label} • ${Math.round(weather!.tmax)}° / ${Math.round(weather!.tmin)}°` : undefined}
            >
              {/* Weather emoji */}
              {!loading && weatherInfo && (
                <span className="text-lg sm:text-xl leading-none">
                  {weatherInfo.emoji}
                </span>
              )}
              {loading && (
                <span className="text-lg sm:text-xl leading-none opacity-30">⏳</span>
              )}
              {!loading && !weatherInfo && (
                <span className="text-lg sm:text-xl leading-none opacity-30">🌡️</span>
              )}

              {/* Temperature */}
              {!loading && weather && (
                <span
                  className={`text-[10px] sm:text-xs font-semibold leading-none ${
                    isActive ? "text-white/90" : "text-gray-600"
                  }`}
                >
                  {Math.round(weather.tmax)}°
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

