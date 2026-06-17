import os
from supabase import create_client, Client
from dotenv import load_dotenv

def upload_to_supabase():
    # Load environment variables
    load_dotenv()
    
    # We need Supabase URL and Key (Service Role Key recommended for uploading)
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")  # Use the service_role key here to bypass RLS for uploading
    
    if not url or not key:
        print("Error: Missing Supabase credentials in your .env file.")
        print("Please add SUPABASE_URL and SUPABASE_KEY to your .env file.")
        print("You can find these in your Supabase Dashboard -> Project Settings -> API.")
        return

    # Bucket name
    bucket_name = "songs"

    print("Connecting to Supabase...")
    try:
        supabase: Client = create_client(url, key)
    except Exception as e:
        print(f"Failed to connect to Supabase: {e}")
        return

    # Check if bucket exists, create if it doesn't
    try:
        buckets = supabase.storage.list_buckets()
        bucket_exists = any(b.name == bucket_name for b in buckets)
        
        if not bucket_exists:
            print(f"Bucket '{bucket_name}' not found. Creating it as a public bucket...")
            try:
                # The python API expects options dictionary for setting public=True
                supabase.storage.create_bucket(bucket_name, options={"public": True})
            except Exception as inner_e:
                print(f"Warning: Failed to create bucket programmatically. Error: {inner_e}")
                print(f"Please manually create a public bucket named '{bucket_name}' in your Supabase Dashboard -> Storage.")
                return
    except Exception as e:
        print(f"Warning: Could not list buckets. Error details: {e}")
        print(f"Please make sure you are using your SERVICE_ROLE key in .env, not the anon key!")
        return

    songs_dir = 'songs'
    if not os.path.exists(songs_dir):
        print(f"Error: '{songs_dir}' directory not found. No songs to upload.")
        return

    files = [f for f in os.listdir(songs_dir) if f.endswith('.mp3')]
    print(f"Found {len(files)} files to upload to Supabase bucket: '{bucket_name}'...")

    success_count = 0
    for i, filename in enumerate(files):
        file_path = os.path.join(songs_dir, filename)
        storage_path = filename
        
        print(f"[{i+1}/{len(files)}] Uploading {filename}...")
        try:
            with open(file_path, 'rb') as f:
                # Upload file (overwrite if exists)
                res = supabase.storage.from_(bucket_name).upload(
                    file=f,
                    path=storage_path,
                    file_options={"content-type": "audio/mpeg", "upsert": "true"}
                )
                success_count += 1
        except Exception as e:
            print(f"Failed to upload {filename}: {e}")

    print(f"\nUpload process completed! Successfully uploaded {success_count} out of {len(files)} songs.")
    print("\nIMPORTANT: Don't forget to update your frontend dashboard to fetch these audio URLs from Supabase!")
    print(f"Your public base URL for songs will be: {url}/storage/v1/object/public/{bucket_name}/<filename>")

if __name__ == "__main__":
    upload_to_supabase()
