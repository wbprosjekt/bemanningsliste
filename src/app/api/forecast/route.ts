import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat") ?? "60.0";    // Nittedal fallback
    const lon = searchParams.get("lon") ?? "10.85";   // Nittedal fallback

    // Open-Meteo daily forecast: weathercode + temp max/min
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Europe/Oslo&forecast_days=7`;
    
    const res = await fetch(url, { 
      next: { revalidate: 3600 } // cache 1 hour
    });

    if (!res.ok) {
      console.error("Open-Meteo API error:", res.status);
      return NextResponse.json(
        { error: "forecast_failed" }, 
        { status: 502 }
      );
    }

    const data = await res.json();
    const daily = data?.daily;

    if (!daily || !daily.time) {
      console.error("Invalid forecast response:", data);
      return NextResponse.json(
        { error: "no_daily_data" }, 
        { status: 500 }
      );
    }

    // Normalize structure
    const days = daily.time.map((time: string, i: number) => ({
      date: time,
      code: daily.weathercode[i],
      tmax: daily.temperature_2m_max[i],
      tmin: daily.temperature_2m_min[i],
    }));

    return NextResponse.json({ days });
  } catch (error) {
    console.error("Weather API error:", error);
    return NextResponse.json(
      { error: "unexpected_error" }, 
      { status: 500 }
    );
  }
}

