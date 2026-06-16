import { NextRequest, NextResponse } from "next/server";

const FREESOUND_API_KEY = process.env.FREE_SOUND;
const BASE_URL = "https://freesound.org/apiv2";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "drum loop";
  const page = searchParams.get("page") || "1";
  const pageSize = searchParams.get("page_size") || "15";

  if (!FREESOUND_API_KEY) {
    return NextResponse.json(
      { error: "Freesound API key not configured" },
      { status: 500 }
    );
  }

  try {
    const url = `${BASE_URL}/search/?query=${encodeURIComponent(query)}&fields=id,name,tags,previews,duration,username,images&page=${page}&page_size=${pageSize}&filter=duration:[0.1 TO 30]&token=${FREESOUND_API_KEY}`;

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 }, // cache for 5 minutes
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Freesound API error:", res.status, errorText);
      return NextResponse.json(
        { error: `Freesound API returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Freesound fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sounds" },
      { status: 500 }
    );
  }
}
