import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const artist = searchParams.get('q');

    if (!artist) {
      return NextResponse.json({ error: 'Missing artist query' }, { status: 400 });
    }

    const encodedQuery = encodeURIComponent(artist);
    // Fetch up to 150 tracks to populate the artist page nicely
    const searchUrl = `https://www.jiosaavn.com/api.php?p=1&q=${encodedQuery}&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=150&__call=search.getResults`;
    
    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(10000)
    });
    
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.results && searchData.results.length > 0) {
        return NextResponse.json({
          status: 'success',
          results: searchData.results.map((r: any) => {
            let cleanArtist = r.more_info?.artistMap?.primary_artists?.[0]?.name;
            if (!cleanArtist && r.subtitle) {
              cleanArtist = r.subtitle.split(" - ")[0].trim();
            }
            if (!cleanArtist) cleanArtist = artist;

            return {
              id: r.id,
              title: r.title,
              artist: cleanArtist,
              thumbnail: r.image?.replace("150x150", "500x500"),
              album: r.more_info?.album || undefined,
              language: r.language,
              perma_url: r.perma_url
            };
          })
        });
      }
    }
    
    return NextResponse.json({ status: 'success', results: [] });
  } catch (error) {
    console.error('Artist fetch error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
