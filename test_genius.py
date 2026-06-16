import requests
from bs4 import BeautifulSoup
import urllib.parse
import json

def get_lyrics(artist, title):
    query = f"{artist} {title} lyrics"
    url = f"https://genius.com/api/search/multi?per_page=5&q={urllib.parse.quote(query)}"
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        res = requests.get(url, headers=headers)
        data = res.json()
        sections = data['response']['sections']
        song_url = None
        for section in sections:
            if section['type'] == 'song':
                hits = section['hits']
                if hits:
                    song_url = hits[0]['result']['url']
                    break
        if not song_url:
            return None
            
        page = requests.get(song_url, headers=headers)
        soup = BeautifulSoup(page.text, 'html.parser')
        lyrics_divs = soup.find_all('div', attrs={"data-lyrics-container": "true"})
        lyrics = "\n".join([div.get_text(separator='\n') for div in lyrics_divs])
        return lyrics
    except Exception as e:
        return str(e)

print(get_lyrics("The Weeknd", "Blinding Lights"))
