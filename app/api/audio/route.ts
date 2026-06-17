import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const songName = searchParams.get('name');

  if (!songName) {
    return NextResponse.json({ error: 'Song name is required' }, { status: 400 });
  }

  const encodedQuery = encodeURIComponent(songName);

  try {
    const searchUrl = `https://www.jiosaavn.com/api.php?p=1&q=${encodedQuery}&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=10&__call=search.getResults`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.results && searchData.results.length > 0) {
        let song = searchData.results[0];
        const targetQuery = songName.toLowerCase();
        
        for (const res of searchData.results) {
          const resTitle = (res.title || '').toLowerCase();
          const subtitle = (res.subtitle || '').toLowerCase();
          // For generic searches, try to find an exact title match to avoid weird covers
          if (resTitle === targetQuery || subtitle.includes(targetQuery)) {
            song = res;
            break;
          }
        }
        
        const encryptedMediaUrl = song.more_info?.encrypted_media_url;
        
        if (encryptedMediaUrl) {
          const authUrl = `https://www.jiosaavn.com/api.php?__call=song.generateAuthToken&url=${encodeURIComponent(encryptedMediaUrl)}&bitrate=320&api_version=4&_format=json&ctx=web6dot0&_marker=0`;
          const authRes = await fetch(authUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          });
          
          if (authRes.ok) {
            const authData = await authRes.json();
            if (authData.status === 'success' && authData.auth_url) {
              const proxiedUrl = `/api/audio-proxy?url=${encodeURIComponent(authData.auth_url)}`;
              return NextResponse.json({ audioUrl: proxiedUrl });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("JioSaavn Official API error:", error);
  }

  // Fallback to iTunes API if JioSaavn completely fails
  try {
    const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodedQuery}&media=music&limit=1`);
    if (itunesRes.ok) {
      const itunesData = await itunesRes.json();
      if (itunesData.results && itunesData.results.length > 0 && itunesData.results[0].previewUrl) {
        return NextResponse.json({ audioUrl: itunesData.results[0].previewUrl });
      }
    }
  } catch (e) {}

  return NextResponse.json({ error: 'Audio track not found' }, { status: 404 });
}
