import json
import os
from dotenv import load_dotenv

load_dotenv()
supabase_url = os.getenv("SUPABASE_URL", "")

with open("local_songs_manifest.json", "r") as f:
    local_songs = json.load(f)

with open("app/final_song_list.json", "r") as f:
    final_songs = json.load(f)

for song_id, data in local_songs.items():
    file_name = data.get("file_name", "")
    
    # Construct the Supabase public URL
    audio_url = f"{supabase_url}/storage/v1/object/public/songs/{file_name}"
    
    # Map to final_song format
    final_songs[song_id] = {
        "title": data.get("title"),
        "artist": data.get("artist"),
        "metadata": data.get("metadata", {}),
        "audio": {
            "url": audio_url,
            "path": "None",
            "working": True
        }
    }

with open("app/final_song_list.json", "w") as f:
    json.dump(final_songs, f, indent=2)

print("Successfully merged local songs into final_song_list.json with Supabase URLs!")
