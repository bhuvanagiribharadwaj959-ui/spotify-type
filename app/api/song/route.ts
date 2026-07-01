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


// Direct details fetch and decryption using official JioSaavn API with strict timeouts
async function fetchJioSaavnAudioDirect(id: string, providedEncryptedUrl?: string): Promise<{ audioUrl: string | null; coverUrl: string | null }> {
  if (!id || id === 'dummy' || id.startsWith('loading-')) return { audioUrl: null, coverUrl: null };
  try {
    let encryptedMediaUrl = providedEncryptedUrl;
    let coverUrl: string | null = null;

    if (!encryptedMediaUrl) {
      const detailsUrl = `https://www.jiosaavn.com/api.php?__call=song.getDetails&cc=in&_marker=0%3F_marker%3D0&_format=json&pids=${encodeURIComponent(id)}`;
      
      const detailsRes = await fetch(detailsUrl, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G960F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://www.jiosaavn.com/',
          'Origin': 'https://www.jiosaavn.com/'
        },
        signal: AbortSignal.timeout(30000)
      });
      
      if (detailsRes.ok) {
        const detailsData = await detailsRes.json();
        if (detailsData[id]) {
          const song = detailsData[id];
          encryptedMediaUrl = song.encrypted_media_url || song.more_info?.encrypted_media_url;
          if (song.image) {
            coverUrl = song.image.replace("150x150", "500x500").replace("50x50", "500x500");
          }
        }
      }
    }

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
          return { audioUrl: authData.auth_url, coverUrl };
        }
      }
    }
  } catch (err) {
    console.error("Direct JioSaavn fetch failed:", err);
  }
  return { audioUrl: null, coverUrl: null };
}


export async function POST(req: NextRequest) {
  try {
    const { id, title, artist, permaUrl, language, encryptedMediaUrl } = await req.json();

    console.log(`[SONG API] id=${id}, title=${title}, artist=${artist}, hasEncryptedUrl=${!!encryptedMediaUrl}`);

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

      function cleanMetadataString(str: string): string {
        if (!str) return "";
        return str
          .replace(/\(feat\..*?\)/gi, '')
          .replace(/\[.*?\]/g, '')
          .replace(/- Live\s*/gi, '')
          .trim();
      }

      const cleanTitle = cleanMetadataString(title);
      const cleanArtist = cleanMetadataString(artist.split(',')[0]);

      // 1. Try LRCLIB exact match endpoint
      try {
        const getUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`;
        const getRes = await fetch(getUrl, {
          headers: { 'User-Agent': 'SONIC Music App (https://github.com/monochrome-music/monochrome)' },
          signal: AbortSignal.timeout(4000)
        });
        if (getRes.ok) {
          const getData = await getRes.json();
          if (getData && (getData.syncedLyrics || getData.plainLyrics)) {
            return getData.syncedLyrics || getData.plainLyrics;
          }
        }
      } catch (err) {}

      // 2. Try LRCLIB search endpoint as a fallback
      try {
        const searchUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`;
        const searchRes = await fetch(searchUrl, {
          headers: { 'User-Agent': 'SONIC Music App (https://github.com/monochrome-music/monochrome)' },
          signal: AbortSignal.timeout(4000)
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

      // 3. Try api.lyrics.ovh as a plain text fallback
      try {
        const ovhUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`;
        const ovhRes = await fetch(ovhUrl, { signal: AbortSignal.timeout(3000) });
        if (ovhRes.ok) {
          const ovhData = await ovhRes.json();
          if (ovhData && ovhData.lyrics) {
            return ovhData.lyrics;
          }
        }
      } catch (e) {}

      // 4. Try Lyrica API from render proxy as a fallback
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

      // 5. Try Genius API as a final fallback
      if (process.env.GENIUS_API) {
        try {
          const geniusUrl = `https://api.genius.com/search?q=${encodeURIComponent(cleanTitle + " " + cleanArtist)}`;
          const geniusRes = await fetch(geniusUrl, {
            headers: { 'Authorization': `Bearer ${process.env.GENIUS_API}` },
            signal: AbortSignal.timeout(3000)
          });
          if (geniusRes.status === 401 || geniusRes.status === 403) {
            return "Genius API token is expired or invalid.";
          }
          if (geniusRes.ok) {
             const gData = await geniusRes.json();
             if (gData.response?.hits?.length > 0) {
               const songUrl = gData.response.hits[0].result.url;
               // Scrape the actual lyrics from the Genius page
               const pageRes = await fetch(songUrl, { signal: AbortSignal.timeout(3000) });
               const html = await pageRes.text();
               const matches = html.match(/<div data-lyrics-container="true".*?>([\s\S]*?)<\/div>/g);
               if (matches) {
                 let scrapedLyrics = matches.map(m => m.replace(/<br.*?>/g, '\n').replace(/<[^>]+>/g, '')).join('\n');
                 scrapedLyrics = scrapedLyrics.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
                 // Clean up Genius contributor junk (everything before the first '[')
                 if (scrapedLyrics.includes('[')) {
                   scrapedLyrics = scrapedLyrics.substring(scrapedLyrics.indexOf('['));
                 }
                 return scrapedLyrics.trim();
               }
               return `No synced lyrics found.\nRead lyrics online at: ${songUrl}`;
             }
          }
        } catch (e) {}
      }

      return 'No lyrics found';
    };

    const fetchAudio = async () => {
      let audioUrl: string | null = localAudioUrl;
      let coverUrl: string | null = localCoverUrl;
      let artistPic: string | null = localArtistPic;

      const needsSearch = !audioUrl;

      // 1. Run JioSaavn fetch directly, passing encryptedMediaUrl to bypass rate-limited details fetch if possible
      const directJioRes = needsSearch ? await fetchJioSaavnAudioDirect(id, encryptedMediaUrl) : null;

      // 2. Resolve the audio stream URL and cover based on priority
      if (!audioUrl && directJioRes?.audioUrl) {
        audioUrl = directJioRes.audioUrl;
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
