import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat") ?? "60.0";   // Nittedal fallback
    const lon = searchParams.get("lon") ?? "10.85"; // Nittedal fallback

    // Open-Meteo current weather: temperature + weathercode
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&timezone=auto`;
    const res = await fetch(url, { next: { revalidate: 600 } }); // cache 10 min
    if (!res.ok) {
      console.error(`Current weather API failed: ${res.status} ${res.statusText}`);
      return NextResponse.json({ error: "current_weather_failed", details: res.statusText }, { status: res.status });
    }
    const data = await res.json();
    const current = data?.current;
    if (!current) {
      console.error("No current weather data received:", data);
      return NextResponse.json({ error: "no_current" }, { status: 500 });
    }

    // Normalise structure
    const currentWeather = {
      temperature: current.temperature_2m,
      weathercode: current.weathercode,
    };
    
    return NextResponse.json({ currentWeather });
  } catch (error) {
    console.error("Unexpected error in current weather API:", error);
    return NextResponse.json({ error: "unexpected", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

