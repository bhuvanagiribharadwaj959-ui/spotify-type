const fs = require('fs');

async function main() {
  const tokens = [
    'nrvUV5Tqghv9wIHXZ0JrGQ__', // English Hit Songs
    'pm49jiq,CNs_', // English Viral Hits
    '9J4ePDXBp8k_', // English 2010s
    'ez5bY2zH0CQ_', // English 2000s
    'H2FgDdeBnNg_', // English 1990s
    'FAbXU36a33nuCJW60TJk1Q__', // English 1980s
    '157252876' // Let's try some other tokens if we have them
  ];

  // Global top english playlist on jiosaavn
  const extraTokens = [
    '8MTJ,,eOQ2s_', // Top English Jiosaavn (often used)
    'L,LzDwk1G-U_', // Let's Play Justin Bieber
    'B2P,x,n0p34_' // Taylor swift
  ];

  let allSongs = [];
  let seenIds = new Set();

  const fetchPlaylist = async (token) => {
    try {
      console.log('Fetching playlist:', token);
      const url = `https://www.jiosaavn.com/api.php?__call=webapi.get&token=${token}&type=playlist&p=1&n=200&includeMetaTags=0&ctx=web6dot0&api_version=4&_format=json&_marker=0`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.list && Array.isArray(data.list)) {
        for (const song of data.list) {
          if (!seenIds.has(song.id)) {
            seenIds.add(song.id);
            
            let cleanArtist = song.more_info?.artistMap?.primary_artists?.[0]?.name;
            if (!cleanArtist && song.subtitle) {
              cleanArtist = song.subtitle.split(" - ")[0].trim();
            }
            if (!cleanArtist) cleanArtist = "Unknown Artist";

            allSongs.push({
              id: song.id,
              title: song.title || "Unknown Title",
              artist: cleanArtist,
              img: song.image?.replace('150x150', '500x500') || song.image,
              album: song.more_info?.album || undefined,
              language: "english", // force english
              permaUrl: song.perma_url || song.url || song.link,
              encryptedMediaUrl: song.more_info?.encrypted_media_url
            });
          }
        }
      }
    } catch (e) {
      console.error('Error fetching token:', token, e.message);
    }
  };

  for (const token of [...tokens, ...extraTokens]) {
    await fetchPlaylist(token);
    if (allSongs.length >= 1000) break;
  }

  // If we don't have 1000, let's just search for some popular artists and get their songs
  if (allSongs.length < 1000) {
    const popularArtists = ['Drake', 'The Weeknd', 'Taylor Swift', 'Ed Sheeran', 'Ariana Grande', 'Eminem', 'Post Malone', 'Billie Eilish', 'Dua Lipa', 'Justin Bieber', 'Imagine Dragons', 'Bruno Mars', 'Coldplay', 'Rihanna', 'Katy Perry', 'Lady Gaga', 'Maroon 5', 'Adele', 'Shawn Mendes', 'Selena Gomez', 'Harry Styles', 'Olivia Rodrigo', 'Doja Cat', 'Charlie Puth', 'Camila Cabello', 'Halsey', 'Sia', 'Sam Smith', 'David Guetta', 'Calvin Harris', 'Avicii', 'One Direction', 'Miley Cyrus', 'Demi Lovato', 'Nicki Minaj', 'Cardi B', 'Megan Thee Stallion', 'Travis Scott', 'Kendrick Lamar', 'J. Cole', 'Future', 'Lil Uzi Vert', 'XXXTENTACION', 'Juice WRLD', 'Polo G', 'Lil Baby', 'DaBaby', 'Roddy Ricch', 'Jack Harlow', 'Lil Nas X'];
    
    for (const artist of popularArtists) {
      if (allSongs.length >= 1000) break;
      try {
        console.log('Searching artist:', artist);
        const url = `https://www.jiosaavn.com/api.php?p=1&q=${encodeURIComponent(artist)}&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=20&__call=search.getResults`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.results && Array.isArray(data.results)) {
          for (const song of data.results) {
            if (!seenIds.has(song.id)) {
              seenIds.add(song.id);
              
              let cleanArtist = song.more_info?.artistMap?.primary_artists?.[0]?.name;
              if (!cleanArtist && song.subtitle) {
                cleanArtist = song.subtitle.split(" - ")[0].trim();
              }
              if (!cleanArtist) cleanArtist = "Unknown Artist";

              allSongs.push({
                id: song.id,
                title: song.title || "Unknown Title",
                artist: cleanArtist,
                img: song.image?.replace('150x150', '500x500') || song.image,
                album: song.more_info?.album || undefined,
                language: "english", // force english
                permaUrl: song.perma_url || song.url || song.link,
                encryptedMediaUrl: song.more_info?.encrypted_media_url
              });
            }
          }
        }
      } catch (e) {
        console.error('Error searching artist:', artist, e.message);
      }
    }
  }

  // Ensure exactly 1000 songs if we have more
  if (allSongs.length > 1000) {
    allSongs = allSongs.slice(0, 1000);
  }

  console.log(`Successfully fetched ${allSongs.length} songs`);
  fs.writeFileSync('public/jiosaavn_songs.json', JSON.stringify(allSongs, null, 2));
}

main();
