import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) return NextResponse.json({ error: 'Query required' }, { status: 400 });

  const cleanQuery = query.trim().toLowerCase();
  
  // Using search.getResults to get full song lists matching the query
  const saavnSearchUrl = `https://www.jiosaavn.com/api.php?p=1&q=${encodeURIComponent(cleanQuery)}&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=20&__call=search.getResults`;

  try {
    // Force Next.js to cache this exact search result on Vercel's Edge CDN for 24 hours
    const response = await fetch(saavnSearchUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*'
      },
      next: { 
        revalidate: 86400, // 24 hours
        tags: ['search', cleanQuery] 
      }
    });

    if (!response.ok) throw new Error('Saavn fetch failed');
    const rawData = await response.json();

    if (rawData.results && rawData.results.length > 0) {
      // Thin down the payload before sending it to the frontend!
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
          // Grab only the highest resolution image to save bandwidth
          img: song.image?.replace('150x150', '500x500') || song.image,
          album: song.more_info?.album || undefined,
          language: song.language || "english",
          permaUrl: song.perma_url || song.url || song.link
        };
      });

      return NextResponse.json({ status: "success", results: minimizedResults });
    }

    return NextResponse.json({ status: "success", results: [] });
  } catch (error) {
    console.error('Search cache error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
