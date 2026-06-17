---
title: SONIC
emoji: 🏆
colorFrom: blue
colorTo: purple
sdk: docker
pinned: false
---

# Sonic Music Streaming Web App

A full-stack music streaming platform inspired by Spotify, built with Next.js. Sonic lets users search, stream, and explore songs with real-time lyrics powered by a custom audio pipeline integrating the DALI dataset, Genius API, and yt-dlp.

---

## Demo

>  [Watch Demo Video](#) <!-- Replace with your YouTube link -->

---

## Features

- **Authentication System:** Secure sign-up and login utilizing Firebase Authentication.
- **Interactive UI & Animations:** High-fidelity, polished interfaces built with Framer Motion, featuring a custom Canvas-based interactive Pixel Particle effect on the hero section.
- **Custom Music Player:** Advanced audio playback controls featuring A-B segment looping, progress tracking, track downloading, and spacebar play/pause toggling.
- **Real-Time Audio Pipeline:** On-the-fly audio stream extraction via a Python backend leveraging `yt-dlp` and `ffmpeg`.
- **Live Synchronized Lyrics:** Interactive synced lyrics fetched dynamically via the lrclib / Genius APIs.
- **Creator Studio & Dashboard:** Dedicated dashboard for managing your music library, exploring genres, and a "Deploy" system to publish new tracks.
- **Cloud Database:** Real-time data syncing for user favorites ("likes"), collections, and song metadata using Firebase Firestore.
- **Dockerized Deployment:** Fully containerized backend/frontend architecture for seamless local setup and Hugging Face Spaces deployment.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js, React, TypeScript, Tailwind CSS, Framer Motion |
| **Backend API** | Next.js API Routes, Python |
| **Audio Pipeline** | yt-dlp, FFmpeg |
| **Database & Auth** | Firebase Firestore, Firebase Authentication |
| **Lyrics** | Genius API / lrclib |
| **Dataset** | DALI Dataset (music metadata) |
| **Containerization** | Docker |

---

## Architecture

```
User Search Query
      
DALI Dataset  Song Metadata
      
yt-dlp  Fetch Audio Stream from YouTube
      
Lyrics API  Fetch Synced Lyrics
      
Next.js  Render Player + Lyrics UI + Animations
```

---

## Local Setup

### Prerequisites
- Docker installed
- Firebase Configuration (add to your `.env` file)
- Genius API key  [Get one here](https://genius.com/api-clients)

### Run with Docker

```bash
git clone https://github.com/bhuvanagiribharadwaj959-ui/spotify-type.git
cd spotify-type/my-app
docker build -t sonic .
docker run -p 7860:7860 -e GENIUS_API_KEY=your_key sonic
```

Open [http://localhost:7860](http://localhost:7860)

### Run without Docker

Ensure you have Python 3, Node.js, and FFmpeg installed locally.

```bash
cd my-app
npm install

# Setup Python virtual environment
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# Run development server
GENIUS_API_KEY=your_key npm run dev
```

---

## Project Structure

```
my-app/
 ├── app/                  # Next.js App Router (Dashboard, Login, Studio)
 ├── public/               # Static assets & audio cache
 ├── components/           # React components (Player, Pixel Particle Hero)
 ├── lib/                  # Firebase configuration
 ├── fetch_song_data.py    # Python audio & lyrics pipeline
 ├── merge_song_lists.py   # Song list preprocessing
 ├── Dockerfile            # Container setup for Hugging Face Spaces
 └── requirements.txt      # Python dependencies (yt-dlp, requests)
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `GENIUS_API_KEY` | Your Genius API key for lyrics fetching |
| `HUGGING_FACE` | Hugging Face space secret token |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase project credentials |

---

## What I Learned

- Building a full audio pipeline from metadata  stream  UI
- Designing and implementing complex Canvas-based interactive UI animations
- Integrating multiple external APIs (Genius, yt-dlp) in a unified system
- Managing real-time user states, authentication, and database syncing with Firebase
- Dockerizing a hybrid Next.js + Python application for cloud deployment

---

## Disclaimer

This project is built for educational purposes only. Audio is streamed in real-time and not stored permanently. All rights belong to respective artists and platforms.

---

## Author

**Bhuvana Giri Bharadwaj**
- GitHub: [@bhuvanagiribharadwaj959-ui](https://github.com/bhuvanagiribharadwaj959-ui)
- LinkedIn: [Add your LinkedIn here](#)

Check out the configuration reference at https://huggingface.co/docs/hub/spaces-config-reference
