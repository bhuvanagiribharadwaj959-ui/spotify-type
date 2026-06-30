import { NextRequest, NextResponse } from 'next/server';

const searchCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 3600 * 1000; // 1 hour

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) return NextResponse.json({ error: 'Query required' }, { status: 400 });

  const cleanQuery = query.trim().toLowerCase();
  
  if (searchCache.has(cleanQuery)) {
    const cached = searchCache.get(cleanQuery)!;
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ status: "success", results: cached.data });
    } else {
      searchCache.delete(cleanQuery);
    }
  }

  // Using search.getResults to get full song lists matching the query
  const saavnSearchUrl = `https://www.jiosaavn.com/api.php?p=1&q=${encodeURIComponent(cleanQuery)}&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=20&__call=search.getResults`;

  try {
    const response = await fetch(saavnSearchUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*'
      }
    });

    if (!response.ok) throw new Error('Saavn fetch failed');
    const rawData = await response.json();

    if (rawData.results && rawData.results.length > 0) {
      const minimizedResults = rawData.results.map((song: any) => {
        let cleanArtist = song.more_info?.artistMap?.primary_artists?.[0]?.name;
        if (!cleanArtist && song.subtitle) {
          cleanArtist = song.subtitle.split(" - ")[0].trim();
        }
        if (!cleanArtist) cleanArtist = "Unknown Artist";

        return {
          id: song.id,
          title: song.title || "Unknown Title",
          artist: cleanArtist,
          img: song.image?.replace('150x150', '500x500') || song.image,
          album: song.more_info?.album || undefined,
          language: song.language || "english",
          permaUrl: song.perma_url || song.url || song.link
        };
      });

      // Only cache valid, non-empty results to prevent caching rate-limit failures
      searchCache.set(cleanQuery, { data: minimizedResults, timestamp: Date.now() });
      return NextResponse.json({ status: "success", results: minimizedResults });
    }

    return NextResponse.json({ status: "success", results: [] });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
