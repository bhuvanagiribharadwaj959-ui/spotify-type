import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { id, title, artist, permaUrl, language } = await req.json();

    if (!id || !title || !artist) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const isDev = process.env.NODE_ENV === 'development';
    const baseUrl = isDev ? 'http://127.0.0.1:9999' : 'https://test-0k.onrender.com';

    const cleanLanguage = (language || '').toLowerCase();
    const isIndian = ["hindi", "punjabi", "tamil", "telugu", "bhojpuri", "malayalam", "kannada", "marathi", "bengali", "gujarati", "urdu", "indian"].includes(cleanLanguage) ||
                     (artist + " " + title).toLowerCase().match(/(arijit|nehha|badshah|diljit|shreya|arman|rahman|udit|kishore|rafi|lata|alkas|kumarsanu|jio|saavn|bollywood)/i);

    // Fetch lyrics and audio in parallel
    const lyricsPromise = (async () => {
      let lyrics = 'No lyrics found';
      // Try LRCLIB first (extremely fast)
      try {
        const getUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
        const getRes = await fetch(getUrl, {
          headers: { 'User-Agent': 'SONIC Music App (https://github.com/monochrome-music/monochrome)' },
          signal: AbortSignal.timeout(3000)
        });
        if (getRes.ok) {
          const getData = await getRes.json();
          if (getData.syncedLyrics || getData.plainLyrics) {
            return getData.syncedLyrics || getData.plainLyrics;
          }
        }
      } catch (err) {}

      try {
        const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(title + " " + artist)}`;
        const searchRes = await fetch(searchUrl, {
          headers: { 'User-Agent': 'SONIC Music App (https://github.com/monochrome-music/monochrome)' },
          signal: AbortSignal.timeout(3000)
        });
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData && searchData.length > 0) {
            const match = searchData[0];
            if (match.syncedLyrics || match.plainLyrics) {
              return match.syncedLyrics || match.plainLyrics;
            }
          }
        }
      } catch (err) {}

      // Fallback to slow Lyrica API if LRCLIB doesn't have it
      try {
        const lyricaUrl = `${baseUrl}/lyrics/?artist=${encodeURIComponent(artist)}&song=${encodeURIComponent(title)}&fast=true&timestamps=true&metadata=true`;
        const lyricaRes = await fetch(lyricaUrl, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
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
      } catch (e) {}

      return lyrics;
    })();

    // Fetch Audio
    const audioPromise = (async () => {
      let audioUrl = null;
      let coverUrl = null;
      let artistPic = null;

      // 1. If not Indian, try Deezer API first for instant preview and HD assets
      if (!isIndian) {
        try {
          const deezerRes = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(artist + " " + title)}`, { signal: AbortSignal.timeout(3000) });
          if (deezerRes.ok) {
            const deezerData = await deezerRes.json();
            if (deezerData && deezerData.data && deezerData.data.length > 0) {
              const trackMatch = deezerData.data[0];
              audioUrl = trackMatch.preview;
              coverUrl = trackMatch.album?.cover_xl || trackMatch.album?.cover_big;
              artistPic = trackMatch.artist?.picture_big || trackMatch.artist?.picture_medium;
            }
          }
        } catch (err) {
          console.error("Deezer fetch error:", err);
        }
      }

      // 2. Fallback to JioSaavn if Deezer didn't find anything or if it is Indian
      if (!audioUrl) {
        try {
          let songLink = permaUrl;
          if (!songLink) {
            const searchUrl = `${baseUrl}/api/jiosaavn/search?q=${encodeURIComponent(artist + " " + title)}`;
            const searchRes = await fetch(searchUrl, { cache: 'no-store', signal: AbortSignal.timeout(60000) });
            if (searchRes.ok) {
              const searchData = await searchRes.json();
              if (searchData.status === "success" && searchData.results && searchData.results.length > 0) {
                const results = searchData.results;
                let bestMatch = results[0];
                const targetTitle = title.toLowerCase();
                const targetArtist = artist.toLowerCase();
                for (const r of results) {
                  const rTitle = (r.title || "").toLowerCase();
                  const rArtist = (r.artist || "").toLowerCase();
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
            const playRes = await fetch(playUrl, { cache: 'no-store', signal: AbortSignal.timeout(60000) });
            if (playRes.ok) {
              const playData = await playRes.json();
              if (playData.status === "success" && playData.data && playData.data.stream_url) {
                const rawUrl = playData.data.stream_url;
                audioUrl = `/api/audio-proxy?url=${encodeURIComponent(rawUrl)}`;
              }
            }
          }
        } catch (e) {
          console.error("JioSaavn fetch fallback error:", e);
        }
      }

      // 3. Fallback to iTunes search preview if still nothing
      if (!audioUrl) {
        try {
          const encodedQuery = encodeURIComponent(`${artist} ${title}`);
          const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodedQuery}&media=music&limit=1`, { signal: AbortSignal.timeout(3000) });
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

    const [lyrics, audioDetails] = await Promise.all([lyricsPromise, audioPromise]);

    return NextResponse.json({
      audioUrl: audioDetails.audioUrl,
      lyrics: lyrics,
      coverUrl: audioDetails.coverUrl,
      artistPic: audioDetails.artistPic,
      alternatives: []
    });

  } catch (error) {
    console.error('API error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
