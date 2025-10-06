/**
 * Weather code mapping from Open-Meteo to emoji and labels
 * Based on WMO Weather interpretation codes
 * https://open-meteo.com/en/docs
 */

export interface WeatherInfo {
  emoji: string;
  label: string;
}

export function codeToWeather(code: number): WeatherInfo {
  // Clear sky
  if (code === 0) {
    return { emoji: "☀️", label: "Klarvær" };
  }

  // Mainly clear, partly cloudy
  if (code === 1) {
    return { emoji: "🌤️", label: "Lettskyet" };
  }
  if (code === 2) {
    return { emoji: "⛅", label: "Delvis skyet" };
  }

  // Overcast
  if (code === 3) {
    return { emoji: "☁️", label: "Overskyet" };
  }

  // Fog
  if (code === 45 || code === 48) {
    return { emoji: "🌫️", label: "Tåke" };
  }

  // Drizzle
  if (code === 51 || code === 53 || code === 55) {
    return { emoji: "🌦️", label: "Yr" };
  }

  // Freezing drizzle
  if (code === 56 || code === 57) {
    return { emoji: "🌧️", label: "Underkjølt yr" };
  }

  // Rain
  if (code === 61 || code === 63 || code === 65) {
    return { emoji: "🌧️", label: "Regn" };
  }

  // Freezing rain
  if (code === 66 || code === 67) {
    return { emoji: "🌧️", label: "Underkjølt regn" };
  }

  // Snow
  if (code === 71 || code === 73 || code === 75) {
    return { emoji: "❄️", label: "Snø" };
  }

  // Snow grains
  if (code === 77) {
    return { emoji: "🌨️", label: "Snøkorn" };
  }

  // Rain showers
  if (code === 80 || code === 81 || code === 82) {
    return { emoji: "🌦️", label: "Regnbyger" };
  }

  // Snow showers
  if (code === 85 || code === 86) {
    return { emoji: "🌨️", label: "Snøbyger" };
  }

  // Thunderstorm
  if (code === 95) {
    return { emoji: "⛈️", label: "Torden" };
  }

  // Thunderstorm with hail
  if (code === 96 || code === 99) {
    return { emoji: "⛈️", label: "Torden med hagl" };
  }

  // Fallback for unknown codes
  return { emoji: "🌡️", label: "Ukjent" };
}

