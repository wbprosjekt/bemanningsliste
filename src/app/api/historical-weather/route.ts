import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat") ?? "59.917";    // Slattum fallback
    const lon = searchParams.get("lon") ?? "10.917";   // Slattum fallback
    const days = parseInt(searchParams.get("days") ?? "7"); // Last 7 days

    // Calculate date range for historical data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Open-Meteo historical weather API
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startDateStr}&end_date=${endDateStr}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Europe/Oslo`;
    
    const res = await fetch(url, { 
      next: { revalidate: 3600 } // cache 1 hour
    });

    if (!res.ok) {
      console.error("Open-Meteo Historical API error:", res.status);
      return NextResponse.json(
        { error: "historical_weather_failed" }, 
        { status: 502 }
      );
    }

    const data = await res.json();
    const daily = data?.daily;

    if (!daily || !daily.time) {
      console.error("Invalid historical weather response:", data);
      return NextResponse.json(
        { error: "no_daily_data" }, 
        { status: 500 }
      );
    }

    // Normalize structure
    const days_data = daily.time.map((time: string, i: number) => ({
      date: time,
      code: daily.weathercode[i],
      tmax: daily.temperature_2m_max[i],
      tmin: daily.temperature_2m_min[i],
    }));

    return NextResponse.json({ days: days_data });
  } catch (error) {
    console.error("Historical weather API error:", error);
    return NextResponse.json(
      { error: "unexpected_error" }, 
      { status: 500 }
    );
  }
}
