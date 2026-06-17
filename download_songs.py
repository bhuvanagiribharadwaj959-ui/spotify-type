import os
import re
import subprocess

def main():
    with open('songs.txt', 'r') as f:
        lines = f.readlines()

    clean_queries = []
    for line in lines:
        line = line.strip()
        if not line or 'BILLBOARD' in line:
            continue
        # Remove leading numbers like "1. "
        line = re.sub(r'^\d+\.\s*', '', line)
        clean_queries.append(f'ytsearch1:{line}')

    batch_file = 'yt_dlp_batch.txt'
    with open(batch_file, 'w') as f:
        f.write('\n'.join(clean_queries))

    os.makedirs('songs', exist_ok=True)
    
    print(f"Prepared {len(clean_queries)} songs for download.")
    print("Starting yt-dlp in the background...")
    
    # Run yt-dlp
    cmd = [
        'yt-dlp',
        '-a', batch_file,
        '-x', 
        '--audio-format', 'mp3',
        '--audio-quality', '96K', # Reduce size
        '-o', 'songs/%(title)s.%(ext)s'
    ]
    
    # We will use bash to run this script so the user can easily see it.
    
if __name__ == '__main__':
    main()
