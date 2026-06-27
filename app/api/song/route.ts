import { NextRequest, NextResponse } from 'next/server';

// Helper to check if a string is a 30s preview URL
function isPreviewUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes('mp3-preview') || 
         lower.includes('preview.dzcdn.net') || 
         lower.includes('itunes.apple.com') ||
         lower.includes('preview');
}


// Direct search and decryption using official JioSaavn API with strict timeouts
async function fetchJioSaavnAudioDirect(title: string, artist: string): Promise<{ audioUrl: string | null; coverUrl: string | null }> {
  try {
    const queryStr = `${artist} ${title}`;
    const encodedQuery = encodeURIComponent(queryStr);
    const searchUrl = `https://www.jiosaavn.com/api.php?p=1&q=${encodedQuery}&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=10&__call=search.getResults`;
    
    const searchRes = await fetch(searchUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G960F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.jiosaavn.com/',
        'Origin': 'https://www.jiosaavn.com/'
      },
      signal: AbortSignal.timeout(30000)
    });
    
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.results && searchData.results.length > 0) {
        let song = searchData.results[0];
        const targetTitle = title.toLowerCase().trim();
        const targetArtist = artist.toLowerCase().trim();
        
        for (const res of searchData.results) {
          const resTitle = (res.title || '').toLowerCase().trim();
          const subtitle = (res.subtitle || '').toLowerCase().trim();
          if (resTitle.includes(targetTitle) && subtitle.includes(targetArtist)) {
            song = res;
            break;
          }
          if (resTitle === targetTitle) {
            song = res;
          }
        }
        
        const encryptedMediaUrl = song.more_info?.encrypted_media_url;
        if (encryptedMediaUrl) {
          const authUrl = `https://www.jiosaavn.com/api.php?__call=song.generateAuthToken&url=${encodeURIComponent(encryptedMediaUrl)}&bitrate=320&api_version=4&_format=json&ctx=web6dot0&_marker=0`;
          const authRes = await fetch(authUrl, {
            headers: { 
              'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G960F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
              'Accept': 'application/json, text/plain, */*',
              'Referer': 'https://www.jiosaavn.com/',
              'Origin': 'https://www.jiosaavn.com/'
            },
            signal: AbortSignal.timeout(30000)
          });
          
          if (authRes.ok) {
            const authData = await authRes.json();
            if (authData.status === 'success' && authData.auth_url) {
              const directUrl = authData.auth_url;
              let cover = null;
              if (song.image) {
                cover = song.image.replace("150x150", "500x500").replace("50x50", "500x500");
              }
              return { audioUrl: directUrl, coverUrl: cover };
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Direct JioSaavn fetch failed:", err);
  }
  return { audioUrl: null, coverUrl: null };
}

// Fallback search using Render API backend with strict timeouts
async function fetchRenderProxyAudio(title: string, artist: string, permaUrl?: string, baseUrl?: string): Promise<string | null> {
  try {
    let songLink = permaUrl;
    if (!songLink) {
      const searchUrl = `${baseUrl}/api/jiosaavn/search?q=${encodeURIComponent(artist + " " + title)}`;
      const searchRes = await fetch(searchUrl, { cache: 'no-store', signal: AbortSignal.timeout(35000) });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.status === "success" && searchData.results && searchData.results.length > 0) {
          const results = searchData.results;
          let bestMatch = results[0];
          const targetTitle = title.toLowerCase().trim();
          const targetArtist = artist.toLowerCase().trim();
          for (const r of results) {
            const rTitle = (r.title || "").toLowerCase().trim();
            const rArtist = (r.artist || "").toLowerCase().trim();
            if (rTitle.includes(targetTitle) && rArtist.includes(targetArtist)) {
              bestMatch = r;
              break;
            }
            if (rTitle === targetTitle) {
              bestMatch = r;
            }
          }
          songLink = bestMatch.perma_url || bestMatch.url || bestMatch.link;
        }
      }
    }

    if (songLink) {
      const playUrl = `${baseUrl}/api/jiosaavn/play?songLink=${encodeURIComponent(songLink)}`;
      const playRes = await fetch(playUrl, { cache: 'no-store', signal: AbortSignal.timeout(35000) });
      if (playRes.ok) {
        const playData = await playRes.json();
        if (playData.status === "success" && playData.data && playData.data.stream_url) {
          return playData.data.stream_url;
        }
      }
    }
  } catch (err) {
    console.error("Render proxy fetch failed:", err);
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { id, title, artist, permaUrl, language } = await req.json();

    if (!title || !artist) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const isDev = process.env.NODE_ENV === 'development';
    const baseUrl = 'https://test-0k.onrender.com';

    const cleanLanguage = (language || '').toLowerCase();
    const isIndian = ["hindi", "punjabi", "tamil", "telugu", "bhojpuri", "malayalam", "kannada", "marathi", "bengali", "gujarati", "urdu", "indian"].includes(cleanLanguage) ||
                     (artist + " " + title).toLowerCase().match(/(arijit|nehha|badshah|diljit|shreya|arman|rahman|udit|kishore|rafi|lata|alkas|kumarsanu|jio|saavn|bollywood|playback)/i);

    let localAudioUrl: string | null = null;
    let localLyrics: string | null = null;
    let localCoverUrl: string | null = null;
    let localArtistPic: string | null = null;

    // Sequential processing for lyrics and audio resolution to keep proxy load low
    const fetchLyrics = async () => {
      if (localLyrics) return localLyrics;

      // Try LRCLIB get first (extremely fast direct lookup)
      try {
        const getUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist.split(',')[0].trim())}&track_name=${encodeURIComponent(title.replace(/\s*\(.*?\)\s*/g, '').trim())}`;
        const getRes = await fetch(getUrl, {
          headers: { 'User-Agent': 'SONIC Music App (https://github.com/monochrome-music/monochrome)' },
          signal: AbortSignal.timeout(4000)
        });
        if (getRes.ok) {
          const getData = await getRes.json();
          if (getData.syncedLyrics || getData.plainLyrics) {
            return getData.syncedLyrics || getData.plainLyrics;
          }
        }
      } catch (err) {}

      // Try LRCLIB search
      try {
        const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(title.replace(/\s*\(.*?\)\s*/g, '').trim() + " " + artist.split(',')[0].trim())}`;
        const searchRes = await fetch(searchUrl, {
          headers: { 'User-Agent': 'SONIC Music App (https://github.com/monochrome-music/monochrome)' },
          signal: AbortSignal.timeout(5000)
        });
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData && searchData.length > 0) {
            const match = searchData.find((m: any) => m.syncedLyrics) || searchData.find((m: any) => m.plainLyrics) || searchData[0];
            if (match && (match.syncedLyrics || match.plainLyrics)) {
              return match.syncedLyrics || match.plainLyrics;
            }
          }
        }
      } catch (err) {}

      // Try Lyrica API from render proxy as a fallback
      try {
        const lyricaUrl = `${baseUrl}/lyrics/?artist=${encodeURIComponent(artist)}&song=${encodeURIComponent(title)}&fast=true&timestamps=true&metadata=true`;
        const lyricaRes = await fetch(lyricaUrl, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
        if (lyricaRes.ok) {
          const lyricaData = await lyricaRes.json();
          if (lyricaData && lyricaData.data) {
            if (lyricaData.data.timed_lyrics && lyricaData.data.timed_lyrics.length > 0) {
              return lyricaData.data.timed_lyrics.map((l: any) => {
                const totalSec = l.start_time / 1000;
                const mins = Math.floor(totalSec / 60);
                const secs = (totalSec % 60).toFixed(2).padStart(5, '0');
                return `[${mins.toString().padStart(2, '0')}:${secs}] ${l.text}`;
              }).join('\n');
            } else if (lyricaData.data.lyrics) {
              return lyricaData.data.lyrics;
            }
          }
        }
      } catch (e) {}

      return 'No lyrics found';
    };

    const fetchAudio = async () => {
      let audioUrl: string | null = localAudioUrl;
      let coverUrl: string | null = localCoverUrl;
      let artistPic: string | null = localArtistPic;

      const needsSearch = !audioUrl;

      // 1. Run JioSaavn fetches in parallel to minimize response latency
      const directJioPromise = needsSearch ? fetchJioSaavnAudioDirect(title, artist) : Promise.resolve(null);
      const proxyJioPromise = needsSearch ? fetchRenderProxyAudio(title, artist, permaUrl, baseUrl) : Promise.resolve(null);

      // Wait for all requests in parallel
      const [directJioRes, proxyJioRes] = await Promise.all([
        directJioPromise,
        proxyJioPromise
      ]);

      // 2. Resolve the audio stream URL and cover based on priority
      if (permaUrl && proxyJioRes) {
        audioUrl = proxyJioRes;
      } else if (!audioUrl && directJioRes?.audioUrl) {
        audioUrl = directJioRes.audioUrl;
      } else if (!audioUrl && proxyJioRes) {
        audioUrl = proxyJioRes;
      }
      
      if (!coverUrl && directJioRes?.coverUrl) coverUrl = directJioRes.coverUrl;

      return { audioUrl, coverUrl, artistPic };
    };

    const [lyricsResult, audioResult] = await Promise.all([
      fetchLyrics(),
      fetchAudio()
    ]);

    return NextResponse.json({
      audioUrl: audioResult.audioUrl,
      lyrics: lyricsResult,
      coverUrl: audioResult.coverUrl,
      artistPic: audioResult.artistPic,
      alternatives: []
    });

  } catch (error) {
    console.error('API error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
