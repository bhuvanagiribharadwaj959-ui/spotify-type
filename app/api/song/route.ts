import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Caching local songs.json in memory for sub-millisecond lookups
let songsData: any[] = [];
try {
  const pathsToTry = [
    path.join(process.cwd(), 'public', 'songs.json'),
    path.join(process.cwd(), 'songs.json'),
    path.join(process.cwd(), '.next', 'standalone', 'public', 'songs.json'),
  ];
  for (const p of pathsToTry) {
    if (fs.existsSync(p)) {
      songsData = JSON.parse(fs.readFileSync(p, 'utf-8'));
      console.log(`Successfully loaded ${songsData.length} tracks from ${p}`);
      break;
    }
  }
} catch (err) {
  console.error("Failed to load local songs.json in API route:", err);
}

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
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(15000)
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
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            signal: AbortSignal.timeout(12000)
          });
          
          if (authRes.ok) {
            const authData = await authRes.json();
            if (authData.status === 'success' && authData.auth_url) {
              const proxiedUrl = `/api/audio-proxy?url=${encodeURIComponent(authData.auth_url)}`;
              let cover = null;
              if (song.image) {
                cover = song.image.replace("150x150", "500x500").replace("50x50", "500x500");
              }
              return { audioUrl: proxiedUrl, coverUrl: cover };
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
      const searchRes = await fetch(searchUrl, { cache: 'no-store', signal: AbortSignal.timeout(25000) });
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
      const playRes = await fetch(playUrl, { cache: 'no-store', signal: AbortSignal.timeout(25000) });
      if (playRes.ok) {
        const playData = await playRes.json();
        if (playData.status === "success" && playData.data && playData.data.stream_url) {
          return `/api/audio-proxy?url=${encodeURIComponent(playData.data.stream_url)}`;
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
    const baseUrl = isDev ? 'http://127.0.0.1:9999' : 'https://test-0k.onrender.com';

    const cleanLanguage = (language || '').toLowerCase();
    const isIndian = ["hindi", "punjabi", "tamil", "telugu", "bhojpuri", "malayalam", "kannada", "marathi", "bengali", "gujarati", "urdu", "indian"].includes(cleanLanguage) ||
                     (artist + " " + title).toLowerCase().match(/(arijit|nehha|badshah|diljit|shreya|arman|rahman|udit|kishore|rafi|lata|alkas|kumarsanu|jio|saavn|bollywood|playback)/i);

    // 1. Try to find the song inside our local 1000-song library
    let localSong = null;
    if (id && id !== 'dummy' && typeof id === 'string') {
      localSong = songsData.find(s => s.id === id);
    }
    if (!localSong) {
      const cleanTitle = title.toLowerCase().trim().replace(/\s*\(.*?\)\s*/g, '');
      const cleanArtist = artist.toLowerCase().trim().replace(/\s*\(.*?\)\s*/g, '');
      localSong = songsData.find(s => {
        const sTitle = (s.meta?.title || '').toLowerCase().trim().replace(/\s*\(.*?\)\s*/g, '');
        const sArtist = (s.meta?.artist || '').toLowerCase().trim().replace(/\s*\(.*?\)\s*/g, '');
        return (sTitle === cleanTitle || sTitle.includes(cleanTitle) || cleanTitle.includes(sTitle)) && 
               (sArtist === cleanArtist || sArtist.includes(cleanArtist) || cleanArtist.includes(sArtist) || cleanArtist.split(',')[0].trim() === sArtist);
      });
    }

    let localAudioUrl = null;
    let localLyrics = null;
    let localCoverUrl = null;
    let localArtistPic = null;

    if (localSong) {
      const storageUrl = localSong.supabase?.audio_storage_url;
      const isNightChanges = title.toLowerCase().includes("night changes") || artist.toLowerCase().includes("one direction");
      const isFallbackUrl = storageUrl && storageUrl.includes("song_1019.mp3");
      const isPreview = isPreviewUrl(storageUrl);

      // Only use the database audio URL if it's not a placeholder (song_1019.mp3) and not a short preview
      if (storageUrl && (!isFallbackUrl || isNightChanges) && !isPreview) {
        localAudioUrl = storageUrl;
      }
      
      if (localSong.assets?.lyrics && localSong.assets.lyrics !== "No lyrics found") {
        localLyrics = localSong.assets.lyrics;
      }
      
      localCoverUrl = localSong.meta?.cover_url || localSong.assets?.cover_url || null;
      localArtistPic = localSong.meta?.artist_cover_url || localSong.assets?.artist_cover_url || null;
    }

    // Parallel processing for lyrics and audio resolution to keep reaction time low
    const lyricsPromise = (async () => {
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
    })();

    const audioPromise = (async () => {
      let audioUrl = localAudioUrl;
      let coverUrl = localCoverUrl;
      let artistPic = localArtistPic;

      const needsSearch = !audioUrl;
      const needsDeezer = !coverUrl || !artistPic;

      // 1. Run all external fetches in parallel to minimize response latency
      const deezerPromise = (needsDeezer || !isIndian) ? (async () => {
        try {
          const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(artist + " " + title)}`, { signal: AbortSignal.timeout(2000) });
          if (res.ok) {
            const data = await res.json();
            if (data && data.data && data.data.length > 0) {
              const track = data.data[0];
              return {
                preview: track.preview,
                cover: track.album?.cover_xl || track.album?.cover_big,
                artistPic: track.artist?.picture_big || track.artist?.picture_medium
              };
            }
          }
        } catch (e) {
          console.error("Parallel Deezer fetch failed/timed out:", e);
        }
        return null;
      })() : Promise.resolve(null);

      const directJioPromise = needsSearch ? fetchJioSaavnAudioDirect(title, artist) : Promise.resolve(null);
      const proxyJioPromise = needsSearch ? fetchRenderProxyAudio(title, artist, permaUrl, baseUrl) : Promise.resolve(null);

      // Wait for all three requests in parallel
      const [deezerRes, directJioRes, proxyJioRes] = await Promise.all([
        deezerPromise,
        directJioPromise,
        proxyJioPromise
      ]);

      // 2. Merge retrieved HD assets
      if (!coverUrl && deezerRes?.cover) coverUrl = deezerRes.cover;
      if (!artistPic && deezerRes?.artistPic) artistPic = deezerRes.artistPic;

      // 3. Resolve the audio stream URL based on priority
      if (!audioUrl && directJioRes?.audioUrl) {
        audioUrl = directJioRes.audioUrl;
        if (!coverUrl && directJioRes.coverUrl) coverUrl = directJioRes.coverUrl;
      }
      
      if (!audioUrl && proxyJioRes) {
        audioUrl = proxyJioRes;
      }
      
      if (!audioUrl && deezerRes?.preview) {
        audioUrl = deezerRes.preview;
      }

      // Final fallback to iTunes preview
      if (!audioUrl) {
        try {
          const encodedQuery = encodeURIComponent(`${artist} ${title}`);
          const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodedQuery}&media=music&limit=1`, { signal: AbortSignal.timeout(2000) });
          if (itunesRes.ok) {
            const itunesData = await itunesRes.json();
            if (itunesData.results && itunesData.results.length > 0) {
              audioUrl = itunesData.results[0].previewUrl;
            }
          }
        } catch (e) {}
      }

      return { audioUrl, coverUrl, artistPic };
    })();

    const [lyricsResult, audioResult] = await Promise.all([lyricsPromise, audioPromise]);

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
