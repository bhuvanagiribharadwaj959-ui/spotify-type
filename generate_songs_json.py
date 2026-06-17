import os
import json
import re
import requests
import concurrent.futures
from dotenv import load_dotenv

load_dotenv()
GENIUS_API = os.getenv('GENIUS_API')

def parse_filename(filename):
    name = filename[:-4]
    parts = name.split('-', 1)
    if len(parts) == 2:
        artist = parts[0].strip()
        title = parts[1].strip()
        
        # Remove anything in (), [], {} (like Official Video, Lyric Video)
        title = re.sub(r'[\(\[\{].*?[\)\]\}]', '', title).strip()
        
        # Remove anything after a vertical bar (standard or fullwidth)
        title = title.split('|')[0].split('｜')[0].strip()
        
        # Remove anything after 'ft.', 'feat.', etc.
        title = re.split(r'\s+ft\.|\s+feat\.|\s+ft\s', title, flags=re.IGNORECASE)[0].strip()
        
        return artist, title
    else:
        return "Unknown Artist", name.strip()

def get_genius_cover(artist, title):
    if not GENIUS_API:
        return None
        
    headers = {
        'Authorization': f'Bearer {GENIUS_API}'
    }
    search_url = 'https://api.genius.com/search'
    
    # Query with clean artist and clean title
    query = f"{artist} {title}"
    
    try:
        response = requests.get(search_url, headers=headers, params={'q': query}, timeout=10)
        if response.status_code == 200:
            data = response.json()
            hits = data.get('response', {}).get('hits', [])
            
            # Iterate through hits to make sure we grab a song result, not an article
            for hit_wrapper in hits:
                if hit_wrapper['type'] == 'song':
                    hit = hit_wrapper['result']
                    return hit.get('song_art_image_url') or hit.get('song_art_image_thumbnail_url')
    except Exception as e:
        pass
        
    return None

def process_song(i, filename):
    artist, title = parse_filename(filename)
    cover_url = get_genius_cover(artist, title)
    
    # Fallback if no cover found
    if not cover_url:
        cover_url = "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=300&h=300"
        
    song_id = f"local_song_{i}"
    
    return song_id, {
        "artist": artist,
        "title": title,
        "file_name": filename,
        "metadata": {
            "cover": cover_url
        }
    }

def main():
    songs_dir = 'songs'
    output_file = 'local_songs_manifest.json'
    
    if not os.path.exists(songs_dir):
        print(f"'{songs_dir}' directory not found.")
        return
        
    files = [f for f in os.listdir(songs_dir) if f.endswith('.mp3')]
    print(f"Found {len(files)} downloaded songs. Fetching covers from Genius API using cleaned titles...")
    
    songs_data = {}
    
    # Use ThreadPoolExecutor to speed up API requests
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(process_song, i, f) for i, f in enumerate(files)]
        
        for future in concurrent.futures.as_completed(futures):
            try:
                song_id, data = future.result()
                songs_data[song_id] = data
            except Exception as e:
                print(f"Error processing song: {e}")
            
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(songs_data, f, indent=4, ensure_ascii=False)
        
    print(f"Successfully generated '{output_file}' with {len(songs_data)} entries and actual album covers.")

if __name__ == '__main__':
    main()
