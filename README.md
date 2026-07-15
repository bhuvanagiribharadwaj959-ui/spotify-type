# Sonic

A full-stack music streaming web application designed to replicate the core functionalities of modern streaming platforms. Built with Next.js, Sonic integrates a custom audio processing pipeline, real-time data synchronization, and dynamic user interfaces to deliver a seamless listening experience.

## Overview

Sonic provides an end-to-end music streaming experience, from user authentication and personalized libraries to on-the-fly audio extraction and real-time synchronized lyrics. The architecture relies on robust cloud databases and custom backend scripts to fetch, process, and serve audio streams efficiently.

## Core Features

- **Authentication & User Management:** Secure user registration, login, and session management integrated with Firebase Authentication.
- **Dynamic Audio Pipeline:** Custom backend infrastructure utilizing Python, yt-dlp, and FFmpeg for real-time extraction and streaming of audio data.
- **Interactive UI & Animations:** High-performance user interfaces built with React, Tailwind CSS, and Framer Motion. Includes advanced Canvas-based visual effects and seamless page transitions.
- **Synchronized Lyrics Engine:** Real-time lyric tracking integrated dynamically via external APIs (Genius and lrclib).
- **Custom Media Player:** Fully functional audio playback controls featuring timeline scrubbing, volume management, A-B segment looping, and background playback.
- **Creator Dashboard:** Dedicated portal for music curation, library management, and deployment of new tracks.
- **Real-Time Database Sync:** User preferences, playlists, and track metadata are stored and synchronized globally using Firebase Firestore.

## Technical Stack

- **Frontend Environment:** Next.js (App Router), React, TypeScript
- **Styling & Animations:** Tailwind CSS, Framer Motion, HTML5 Canvas
- **Backend & API:** Next.js API Routes, Python
- **Audio Processing:** yt-dlp, FFmpeg
- **Database & Storage:** Firebase Firestore
- **Authentication:** Firebase Auth
- **Data Sources:** DALI Dataset (metadata), Genius API / lrclib (lyrics)

## System Architecture

1. **Client Request:** User searches or selects a track within the Next.js frontend.
2. **Metadata Resolution:** Application queries the DALI Dataset for comprehensive track information.
3. **Audio Extraction:** Python-based backend pipeline invokes yt-dlp and FFmpeg to fetch and format the corresponding audio stream.
4. **Lyrics Retrieval:** Parallel request sent to Genius API/lrclib to fetch synchronized lyric timestamps.
5. **Playback & Rendering:** Next.js client renders the media player, visualizer, and lyrics interface concurrently with the audio stream.

## Local Development Setup

### Prerequisites

- Node.js (v18 or higher recommended)
- Python 3.8+
- FFmpeg installed and accessible in the system path
- Firebase account and project credentials
- Genius API Client Key

### Installation Instructions

1. **Install Node Dependencies**
   Navigate to the project directory and install frontend dependencies:
   ```bash
   cd my-app
   npm install
   ```

2. **Configure Python Environment**
   Set up a virtual environment and install backend requirements:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # On Windows use `.venv\Scripts\activate`
   pip install -r requirements.txt
   ```

3. **Environment Variables**
   Create a `.env.local` file in the root of `my-app` and configure the following:
   ```
   GENIUS_API_KEY=your_genius_api_key_here
   NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
   ```

4. **Launch the Development Server**
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:3000`.

## Key Technical Learnings

- Designed and optimized a low-latency audio streaming pipeline integrating external metadata sources.
- Implemented complex, state-driven UI animations ensuring 60fps performance using Framer Motion and native Canvas APIs.
- Architected a robust real-time state management solution utilizing Firebase Firestore for synchronized user data.
- Handled cross-environment API integrations bridging Node.js and Python ecosystems.

## Disclaimer

This software is developed strictly for educational and portfolio demonstration purposes. All audio streams are processed in real-time without permanent storage. Copyright and intellectual property rights of the streamed content belong to their respective artists and platforms.

## Contact & Links

**Bhuvana Giri Bharadwaj**
- GitHub: [bhuvanagiribharadwaj959-ui](https://github.com/bhuvanagiribharadwaj959-ui)
- LinkedIn: [My LinkedIn Profile](https://www.linkedin.com/in/bhuvanagiri-bharadwaj-aba3353a6/)
