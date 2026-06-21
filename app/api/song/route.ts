import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { id, title, artist } = await req.json();

    if (!id || !title || !artist) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    const isDev = process.env.NODE_ENV === 'development';
    const baseUrl = isDev ? 'http://127.0.0.1:9999' : 'https://test-0k.onrender.com';

    // Fetch lyrics and audio in parallel to optimize speed
    const lyricsPromise = (async () => {
      let lyrics = 'No lyrics found';
      try {
        const lyricaUrl = `${baseUrl}/lyrics/?artist=${encodeURIComponent(artist)}&song=${encodeURIComponent(title)}&fast=true&timestamps=true&metadata=true`;
        const lyricaRes = await fetch(lyricaUrl, { cache: 'no-store', signal: AbortSignal.timeout(60000) });
        if (lyricaRes.ok) {
          const lyricaData = await lyricaRes.json();
          if (lyricaData && lyricaData.data) {
            if (lyricaData.data.timed_lyrics && lyricaData.data.timed_lyrics.length > 0) {
              lyrics = lyricaData.data.timed_lyrics.map((l: any) => {
                const totalSec = l.start_time / 1000;
                const mins = Math.floor(totalSec / 60);
                const secs = (totalSec % 60).toFixed(2).padStart(5, '0');
                return `[${mins.toString().padStart(2, '0')}:${secs}] ${l.text}`;
              }).join('\n');
            } else if (lyricaData.data.lyrics) {
              lyrics = lyricaData.data.lyrics;
            }
          }
        }
      } catch (e: any) {
        console.error("Lyrica API Error:", e);
      }
      return lyrics;
    })();

    const audioPromise = (async () => {
      let saavnAudioUrl = null;
      try {
        const searchUrl = `${baseUrl}/api/jiosaavn/search?q=${encodeURIComponent(artist + " " + title)}`;
        const searchRes = await fetch(searchUrl, { cache: 'no-store', signal: AbortSignal.timeout(60000) });
        
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData.status === "success" && searchData.results && searchData.results.length > 0) {
            const songLink = searchData.results[0].perma_url || searchData.results[0].url || searchData.results[0].link;
            
            if (songLink) {
               const playUrl = `${baseUrl}/api/jiosaavn/play?songLink=${encodeURIComponent(songLink)}`;
               const playRes = await fetch(playUrl, { cache: 'no-store', signal: AbortSignal.timeout(60000) });
               if (playRes.ok) {
                  const playData = await playRes.json();
                  if (playData.status === "success" && playData.data && playData.data.stream_url) {
                     saavnAudioUrl = playData.data.stream_url;
                  }
               }
            }
          }
        }
      } catch (e) {
        console.error("Lyrica JioSaavn fetch error:", e);
      }
      return saavnAudioUrl;
    })();

    const [lyrics, saavnAudioUrl] = await Promise.all([lyricsPromise, audioPromise]);
    const alternatives: any[] = [];

    if (!saavnAudioUrl) {
      // Fallback to iTunes API if Lyrica completely fails to find stream
      try {
        const encodedQuery = encodeURIComponent(`${artist} ${title}`);
        const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodedQuery}&media=music&limit=1`);
        if (itunesRes.ok) {
          const itunesData = await itunesRes.json();
          if (itunesData.results && itunesData.results.length > 0) {
            return NextResponse.json({
              audioUrl: itunesData.results[0].previewUrl,
              lyrics: lyrics,
              alternatives: [],
            });
          }
        }
      } catch (e) {}

      return NextResponse.json({
        audioUrl: null,
        lyrics: lyrics,
        alternatives: [],
        error: 'Could not extract audio stream from any source',
      });
    }

    // Proxy the JioSaavn CDN URL to bypass Akamai CORS / IP blocks
    const proxiedUrl = `/api/audio-proxy?url=${encodeURIComponent(saavnAudioUrl)}`;

    return NextResponse.json({
      audioUrl: proxiedUrl,
      alternatives: alternatives,
      lyrics: lyrics,
    });

  } catch (error) {
    console.error('API error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
