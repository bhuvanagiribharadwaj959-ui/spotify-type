import sys
import json
import os
import requests
import yt_dlp
import urllib.parse

def fetch_lyrics(artist, title):
    url = f"https://lrclib.net/api/search?q={urllib.parse.quote(artist + ' ' + title)}"
    try:
        res = requests.get(url, timeout=10)
        data = res.json()
        if data and isinstance(data, list) and len(data) > 0:
            best_match = data[0]
            lyrics = best_match.get('syncedLyrics')
            if not lyrics:
                lyrics = best_match.get('plainLyrics')
            return lyrics
    except Exception as e:
        print(f"Error fetching lyrics: {e}", file=sys.stderr)
    return ""

def fetch_song(id, artist, title, cache_dir):
    m4a_path = os.path.join(cache_dir, f"{id}.m4a")
    json_path = os.path.join(cache_dir, f"{id}.json")
    
    # Check if cached
    if os.path.exists(m4a_path) and os.path.exists(json_path):
        with open(json_path, 'r') as f:
            lyrics = json.load(f).get("lyrics", "")
        print(json.dumps({"audioUrl": f"/cache/{id}.m4a", "lyrics": lyrics}))
        return

    # 1. Fetch Lyrics
    lyrics = fetch_lyrics(artist, title)

    # 2. Download Audio
    if not os.path.exists(m4a_path):
        query = f"ytsearch1:{artist} {title} official audio"
        ydl_opts = {
            'format': 'bestaudio[ext=m4a]/bestaudio',
            'outtmpl': os.path.join(cache_dir, f"{id}.%(ext)s"),
            'quiet': True,
            'noplaylist': True,
            'no_warnings': True
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(query, download=True)
                if 'entries' in info and len(info['entries']) > 0:
                    entry = info['entries'][0]
                    ext = entry.get('ext', 'm4a')
                    # If it downloaded with a different extension, rename it to m4a for consistency, 
                    # or handle the extension. Since we forced [ext=m4a], it's mostly m4a.
                    actual_path = os.path.join(cache_dir, f"{id}.{ext}")
                    if actual_path != m4a_path and os.path.exists(actual_path):
                        os.rename(actual_path, m4a_path)
        except Exception as e:
            print(f"Error downloading audio: {e}", file=sys.stderr)
            sys.exit(1)

    # 3. Save Lyrics cache
    with open(json_path, 'w') as f:
        json.dump({"lyrics": lyrics}, f)

    print(json.dumps({"audioUrl": f"/cache/{id}.m4a", "lyrics": lyrics}))

if __name__ == "__main__":
    if len(sys.argv) < 5:
        print("Usage: python fetch_song_data.py <id> <artist> <title> <cache_dir>", file=sys.stderr)
        sys.exit(1)
        
    id = sys.argv[1]
    artist = sys.argv[2]
    title = sys.argv[3]
    cache_dir = sys.argv[4]
    
    fetch_song(id, artist, title, cache_dir)
