import yt_dlp

ydl_opts = {
    'format': 'bestaudio[ext=m4a]/bestaudio',
    'outtmpl': 'public/cache/test1.%(ext)s',
    'quiet': True,
    'noplaylist': True
}
with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    info = ydl.extract_info("ytsearch1:The Weeknd Blinding Lights audio", download=True)
    if 'entries' in info and len(info['entries']) > 0:
        entry = info['entries'][0]
        print(f"Downloaded extension: {entry['ext']}")
