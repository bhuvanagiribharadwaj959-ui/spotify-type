import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore
import { getLyrics } from 'genius-lyrics-api';

async function getOfficialJioSaavnStream(artist: string, title: string) {
  const query = `${artist} ${title}`;
  const encodedQuery = encodeURIComponent(query);
  try {
    const searchUrl = `https://www.jiosaavn.com/api.php?p=1&q=${encodedQuery}&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=15&__call=search.getResults`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    
    if (!searchRes.ok) return null;
    
    const searchData = await searchRes.json();
    if (searchData.results && searchData.results.length > 0) {
      let bestSong = searchData.results[0];
      const targetArtist = artist.toLowerCase();
      const targetTitle = title.toLowerCase();
      
      for (const res of searchData.results) {
        const subtitle = (res.subtitle || '').toLowerCase();
        const resTitle = (res.title || '').toLowerCase();
        const singers = (res.more_info?.singers || '').toLowerCase();
        
        if (
          resTitle.includes(targetTitle) && 
          (subtitle.includes(targetArtist) || singers.includes(targetArtist))
        ) {
          bestSong = res;
          break;
        }
      }
      
      const alternatives = [];
      for (const res of searchData.results) {
        if (res.more_info?.encrypted_media_url) {
          alternatives.push({
            id: res.id,
            title: res.title,
            subtitle: res.subtitle,
            duration: res.more_info.duration || 'Unknown',
            encrypted_url: res.more_info.encrypted_media_url
          });
        }
      }

      const encryptedMediaUrl = bestSong.more_info?.encrypted_media_url;
      let bestAuthUrl = null;
      
      if (encryptedMediaUrl) {
        const authUrl = `https://www.jiosaavn.com/api.php?__call=song.generateAuthToken&url=${encodeURIComponent(encryptedMediaUrl)}&bitrate=320&api_version=4&_format=json&ctx=web6dot0&_marker=0`;
        const authRes = await fetch(authUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        if (authRes.ok) {
          const authData = await authRes.json();
          if (authData.status === 'success' && authData.auth_url) {
            bestAuthUrl = authData.auth_url;
          }
        }
      }
      
      return { bestMatchUrl: bestAuthUrl, alternatives };
    }
  } catch (error) {
    console.error("JioSaavn Official API error:", error);
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { id, title, artist } = await req.json();

    if (!id || !title || !artist) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    // 1. Fetch Lyrics using Lyrica API
    let lyrics = 'No lyrics found';
    try {
      const isDev = process.env.NODE_ENV === 'development';
      const baseUrl = isDev ? 'http://127.0.0.1:9999' : 'https://test-0k.onrender.com';
      const lyricaUrl = `${baseUrl}/lyrics/?artist=${encodeURIComponent(artist)}&song=${encodeURIComponent(title)}&fast=true&timestamps=true&metadata=true`;
      const lyricaRes = await fetch(lyricaUrl, { cache: 'no-store' });
      if (lyricaRes.ok) {
        const lyricaData = await lyricaRes.json();
        if (lyricaData && lyricaData.data && lyricaData.data.lyrics) {
          lyrics = lyricaData.data.lyrics;
        }
      }
    } catch (e: any) {
      console.error("Lyrica API Error:", e);
      lyrics = `No lyrics found (Error: ${e.message || 'Lyrica server not reachable'})`;
    }

    // 2. Fetch Audio URL fallback (Frontend uses static Supabase URLs, so this is just a fallback for older songs)
    const saavnData = await getOfficialJioSaavnStream(artist, title);

    const saavnAudioUrl = saavnData?.bestMatchUrl;
    const alternatives = saavnData?.alternatives || [];

    if (!saavnAudioUrl) {
      // Fallback to iTunes API if JioSaavn completely fails
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
