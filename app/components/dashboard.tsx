"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  LayoutGrid,
  Users,
  ListMusic,
  ChevronDown,
  LogOut,
  Search,
  Heart,
  Settings,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
  ChevronRight,
  Music,
  Download,
  ChevronLeft,
  MoreHorizontal,
} from "lucide-react";
import "./dashboard.css";
import Link from "next/link";
import PlayingOverlay from "./playing";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth, db } from "../lib/firebase";
import { collection, doc, setDoc, getDoc, updateDoc, increment, addDoc, deleteDoc, query, where, getDocs } from "firebase/firestore";

type DashboardTrack = {
  id: string;
  img: string;
  title: string;
  artist: string;
  language?: string;
  genres?: string[];
  audioUrl?: string;
  lyrics?: string;
};

const dashboardTracks: DashboardTrack[] = [];

const playlists: { name: string; cover?: string }[] = [

];

const popularColors = [
  "linear-gradient(135deg, #7f1d1d 0%, #030706 100%)", // Red
  "linear-gradient(135deg, #064e3b 0%, #030706 100%)", // Green
  "linear-gradient(135deg, #1e3a8a 0%, #030706 100%)", // Blue
  "linear-gradient(135deg, #7c2d12 0%, #030706 100%)", // Orange
  "linear-gradient(135deg, #374151 0%, #030706 100%)", // Gray
  "linear-gradient(135deg, #581c87 0%, #030706 100%)", // Purple
];

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const ob = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setShown(true),
      { threshold: 0.12 },
    );
    ob.observe(ref.current);
    return () => ob.disconnect();
  }, []);
  return [ref, `reveal${shown ? " in" : ""}`] as const;
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [active, setActive] = useState("Home");
  const [playlistsOpen, setPlaylistsOpen] = useState(true);
  const [cat, setCat] = useState("English");
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSong, setCurrentSong] = useState<DashboardTrack>({
    id: "dummy",
    title: "Loading...",
    artist: "Loading...",
    img: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=300&h=300"
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [dbSongs, setDbSongs] = useState<DashboardTrack[]>([]);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [likedSongs, setLikedSongs] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(false);
  const [isABLoop, setIsABLoop] = useState(false);
  const [abLoopStart, setAbLoopStart] = useState<number | null>(null);
  const [abLoopEnd, setAbLoopEnd] = useState<number | null>(null);
  const [popupGenre, setPopupGenre] = useState<string | null>(null);
  const [popupArtist, setPopupArtist] = useState<string | null>(null);
  const [volume, setVolume] = useState(1);

  const categories = useMemo(() => {
    // Collect from dbSongs instead
    const extractedLanguages = dbSongs
      .map((track) => track.language)
      .filter((lang): lang is string => Boolean(lang));

    const uniqueLanguages = Array.from(new Set(extractedLanguages));

    // Capitalize extracted strings nicely
    return uniqueLanguages.map(
      (lang) => lang.charAt(0).toUpperCase() + lang.slice(1)
    );
  }, [dbSongs]);
  const [duration, setDuration] = useState(0);
  const playingRef = useRef(playing);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  const [lyrics, setLyrics] = useState<string>("");
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const [randomHeroSlides, setRandomHeroSlides] = useState<DashboardTrack[]>([]);
  const [popularArtists, setPopularArtists] = useState<{ name: string, img: string }[]>([]);
  const [mounted, setMounted] = useState(false);
  const [alternatives, setAlternatives] = useState<any[]>([]);

  const allTracks = useMemo(() => {
    // Put dashboardTracks first so they have priority over dbSongs!
    const combined = [...dashboardTracks, ...dbSongs];
    const unique = [];
    const seenTitles = new Set<string>();
    for (const track of combined) {
      const lowerTitle = track.title.toLowerCase();
      if (!seenTitles.has(lowerTitle)) {
        seenTitles.add(lowerTitle);
        unique.push(track);
      }
    }
    const goodTracks = [];
    const badTracks = [];
    for (const track of unique) {
      const isBad = !track.img || track.img.includes('default_cover_image') || track.img.includes('24596bcd24eb0adab57edfd0fa06a5d5') || track.img.includes('placeholder');
      if (isBad) {
        badTracks.push(track);
      } else {
        goodTracks.push(track);
      }
    }
    return [...goodTracks, ...badTracks];
  }, [dbSongs]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoaded(true);
      if (u) {
        // Create user document if it doesn't exist
        const userRef = doc(db, "users", u.uid);
        getDoc(userRef).then(docSnap => {
          if (!docSnap.exists()) {
            setDoc(userRef, {
              uid: u.uid,
              display_name: u.displayName || "User",
              email: u.email,
              created_at: new Date().toISOString(),
              last_login: new Date().toISOString(),
              premium_user: false,
              stats: {
                total_songs_listened: 0,
                total_songs_created: 0
              }
            }).catch(console.error);
          } else {
            updateDoc(userRef, { last_login: new Date().toISOString() }).catch(console.error);
          }
        }).catch((err) => {
          // Silencing the error to keep the console clean until database is ready
          // console.warn("Firestore not ready:", err.message);
        });

        // Fetch likes
        const fetchLikes = async () => {
          try {
            const q = query(collection(db, "likes"), where("user_id", "==", u.uid));
            const snapshot = await getDocs(q);
            const likes = new Set<string>();
            snapshot.forEach(d => likes.add(d.data().song_id));
            setLikedSongs(likes);
          } catch (e) {
            // Silencing the error
            // console.warn("Firestore likes not ready:", e.message);
          }
        };
        fetchLikes();
        
        const fetchDbSongs = async () => {
          try {
            // Fetch from local JSON file
            const jsonRes = await fetch('/songs.json');
            const data = await jsonRes.json();
            const fetched: DashboardTrack[] = [];
            data.forEach((item: any) => {
              fetched.push({
                id: item.id,
                title: item.meta?.title || "Unknown Title",
                artist: item.meta?.artist || "Unknown Artist",
                img: item.meta?.cover_url || item.assets?.cover_url || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=300&h=300",
                language: item.meta?.language || "english",
                genres: [item.meta?.category, ...(item.meta?.mood || [])].filter(Boolean),
                audioUrl: item.supabase?.audio_storage_url || item.assets?.audio_path,
                lyrics: item.assets?.lyrics
              });
            });

            // Keep the firebase fetch just in case there are custom songs uploaded by the user
            try {
              const q = query(collection(db, "songs"));
              const snapshot = await getDocs(q);
              snapshot.forEach(docSnap => {
                const docData = docSnap.data();
                if (docData.is_public && !fetched.find(f => f.id === docSnap.id)) {
                  fetched.push({
                    id: docSnap.id,
                    img: docData.img || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=300&h=300",
                    title: docData.title || "Unknown Title",
                    artist: docData.artist || "Unknown Artist",
                    language: docData.language,
                    genres: docData.genres || [],
                  });
                }
              });
            } catch (err) {}

            setDbSongs(fetched);
            setCurrentSong((prev) => (prev.id === "dummy" && fetched.length > 0) ? fetched[0] : prev);
          } catch (err) {
            console.error("Error fetching songs:", err);
          }
        };
        fetchDbSongs();

      } else {
        setLikedSongs(new Set());
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    setMounted(true);
    // Remove randomness, just take top 16 tracks to reduce load
    const staticSlides = dbSongs.slice(0, 16);
    setRandomHeroSlides(staticSlides);

    const uniqueArtistsMap = new Map<string, string>();
    staticSlides.forEach(t => {
      if (!uniqueArtistsMap.has(t.artist)) {
        uniqueArtistsMap.set(t.artist, t.img);
      }
    });
    const artistList = Array.from(uniqueArtistsMap.entries()).map(([name, img]) => ({ name, img }));
    setPopularArtists(artistList.slice(0, 6));
  }, [dbSongs]);

  const languageFilteredSongs = useMemo(() => {
    if (!cat) return allTracks.slice(0, 12);
    const filtered = allTracks.filter(s => s.language?.toLowerCase() === cat.toLowerCase());
    return filtered.length > 0 ? filtered.slice(0, 12) : allTracks.slice(0, 12);
  }, [cat, allTracks]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const lowerQ = searchQuery.toLowerCase();
    return allTracks.filter(
      (s) => s.title.toLowerCase().includes(lowerQ) || s.artist.toLowerCase().includes(lowerQ)
    );
  }, [searchQuery, allTracks]);

  const handleNext = () => {
    const idx = allTracks.findIndex(s => s.id === currentSong.id);
    if (idx === -1) return;
    if (isShuffle) {
      const randomIdx = Math.floor(Math.random() * allTracks.length);
      setCurrentSong(allTracks[randomIdx]);
    } else {
      const nextIdx = (idx + 1) % allTracks.length;
      setCurrentSong(allTracks[nextIdx]);
    }
  };

  const handlePrev = () => {
    const idx = allTracks.findIndex(s => s.id === currentSong.id);
    if (idx === -1) return;
    if (audioRef.current && audioRef.current.currentTime > 5) {
      audioRef.current.currentTime = 0;
      return;
    }
    const prevIdx = (idx - 1 + allTracks.length) % allTracks.length;
    setCurrentSong(allTracks[prevIdx]);
  };

  const playAudio = () => {
    if (audioRef.current) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          if (error.name !== "AbortError") {
            console.error("Playback failed:", error);
          }
        });
      }
    }
  };

  useEffect(() => {
    const fetchSongData = async () => {
      setIsLoadingAudio(true);
      setLyrics("");

      // Immediately stop the old song from playing while we fetch the new one
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
      }

      // Pre-load the static CDN stream if we have it in the database!
      let hasPlayedStatic = false;
      let staticAudioUrl = currentSong.audioUrl;
      // Force API fetch for Blinding Lights to avoid bad local download
      if (currentSong.title.toLowerCase().includes("blinding lights")) {
        staticAudioUrl = undefined;
      }

      if (staticAudioUrl && audioRef.current) {
        if (staticAudioUrl.includes('supabase.co')) {
          audioRef.current.src = encodeURI(staticAudioUrl);
        } else {
          audioRef.current.src = `/api/audio-proxy?url=${encodeURIComponent(staticAudioUrl)}`;
        }
        if (playingRef.current) {
          playAudio();
        }
        hasPlayedStatic = true;
      }

      if (currentSong.lyrics) {
        setLyrics(currentSong.lyrics);
        setAlternatives([]);
        if (hasPlayedStatic) {
          setIsLoadingAudio(false);
          return;
        }
      }

      try {
        const res = await fetch('/api/song', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: currentSong.id, title: currentSong.title, artist: currentSong.artist })
        });
        if (!res.ok) {
          const errData = await res.json();
          setLyrics(`Failed to load song. Error: ${errData.details || errData.error || 'Unknown error'}`);
          return;
        }

        const data = await res.json();
        if (data.alternatives) {
          setAlternatives(data.alternatives);
        } else {
          setAlternatives([]);
        }

        // Only use the fetched audio URL if we didn't already play the pre-calculated one
        if (!hasPlayedStatic && data.audioUrl && audioRef.current) {
          audioRef.current.src = data.audioUrl;
          if (playingRef.current) {
            playAudio();
          }
        } else if (!hasPlayedStatic && data.error) {
          console.warn("Audio fetching failed:", data.error);
          setLyrics(`Audio Extraction Failed: ${data.error}\n\n${data.lyrics || ''}`);
          return;
        }
        let finalLyrics = data.lyrics || "No lyrics found";
        if (finalLyrics.includes("No lyrics found") || finalLyrics.includes("Error:")) {
          try {
            const lrcRes = await fetch(`https://lrclib.net/api/search?track_name=${encodeURIComponent(currentSong.title)}&artist_name=${encodeURIComponent(currentSong.artist)}`);
            if (lrcRes.ok) {
              const lrcData = await lrcRes.json();
              if (lrcData && lrcData.length > 0) {
                finalLyrics = lrcData[0].syncedLyrics || lrcData[0].plainLyrics || finalLyrics;
              }
            }
          } catch (e) {
            console.error("LRCLIB fallback failed", e);
          }
        }
        setLyrics(finalLyrics);
      } catch (e: any) {
        console.error("Error fetching song", e);
        setLyrics(`Network error: ${e.message}`);
      } finally {
        setIsLoadingAudio(false);
      }
    };
    fetchSongData();
  }, [currentSong]);

  const handleAlternativeSelect = async (encryptedUrl: string) => {
    try {
      const res = await fetch(`/api/song/auth?url=${encodeURIComponent(encryptedUrl)}`);
      const data = await res.json();
      if (data.audioUrl && audioRef.current) {
        audioRef.current.src = data.audioUrl;
        if (playingRef.current) {
          playAudio();
        } else {
          setPlaying(true);
        }
      } else {
        alert("Failed to load alternative track.");
      }
    } catch (e) {
      alert("Error loading alternative track.");
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      if (playing) {
        playAudio();
      } else {
        audioRef.current.pause();
      }
    }
  }, [playing]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const curr = audioRef.current.currentTime;
      const dur = audioRef.current.duration;
      setProgress(dur ? (curr / dur) * 100 : 0);

      if (isABLoop && abLoopStart !== null) {
        const endPoint = abLoopEnd !== null ? abLoopEnd : dur;
        if (curr >= endPoint) {
          audioRef.current.currentTime = abLoopStart;
          playAudio();
        }
      }
    }
  };

  const handleEnded = () => {
    if (user && audioRef.current) {
      const durationListened = Math.floor(audioRef.current.currentTime);
      if (durationListened > 10) {
        addDoc(collection(db, "listening_history"), {
          user_id: user.uid,
          song_id: currentSong.id,
          listened_at: new Date().toISOString(),
          device: "Web",
          duration_seconds: durationListened
        }).catch(console.error);

        updateDoc(doc(db, "users", user.uid), {
          "stats.total_songs_listened": increment(1)
        }).catch(console.error);

        const songRef = doc(db, "songs", currentSong.id);
        updateDoc(songRef, { play_count: increment(1) }).catch(() => {
          setDoc(songRef, {
            song_id: currentSong.id,
            title: currentSong.title,
            creator_id: "system",
            is_public: true,
            like_count: 0,
            play_count: 1,
            created_at: new Date().toISOString(),
            notes_data: {}
          });
        });
      }
    }

    if (!isRepeat) {
      handleNext();
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (audioRef.current && duration) {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      const newTime = percent * duration;

      if (isABLoop) {
        if (abLoopStart === null) {
          setAbLoopStart(newTime);
        } else if (abLoopEnd === null) {
          if (newTime > abLoopStart) {
            setAbLoopEnd(newTime);
          } else {
            setAbLoopEnd(abLoopStart);
            setAbLoopStart(newTime);
          }
        } else {
          setAbLoopStart(newTime);
          setAbLoopEnd(null);
        }
      }

      audioRef.current.currentTime = newTime;
      setProgress(percent * 100);
    }
  };

  const handleToggleABLoop = () => {
    setIsABLoop(prev => {
      if (prev) {
        setAbLoopStart(null);
        setAbLoopEnd(null);
      }
      return !prev;
    });
  };



  const allGenres = useMemo(() => {
    const genres = new Set<string>();
    allTracks.forEach(t => t.genres?.forEach(g => genres.add(g)));
    return Array.from(genres);
  }, [allTracks]);

  const allArtistsList = useMemo(() => {
    const artists = new Set<string>();
    allTracks.forEach(t => artists.add(t.artist));
    return Array.from(artists);
  }, [allTracks]);

  const toggleLike = async (songId?: string) => {
    const id = songId || currentSong.id;
    const isNowLiked = !likedSongs.has(id);

    setLikedSongs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

    if (user) {
      const likeId = `${user.uid}_${id}`;
      const likeRef = doc(db, "likes", likeId);
      const songRef = doc(db, "songs", id);

      try {
        if (isNowLiked) {
          await setDoc(likeRef, {
            user_id: user.uid,
            song_id: id,
            liked_at: new Date().toISOString()
          });

          await updateDoc(songRef, { like_count: increment(1) }).catch(async () => {
            const track = allTracks.find(t => t.id === id);
            if (track) {
              await setDoc(songRef, {
                song_id: id, title: track.title, creator_id: "system", is_public: true, like_count: 1, play_count: 0, created_at: new Date().toISOString(), notes_data: {}
              });
            }
          });
        } else {
          await deleteDoc(likeRef);
          await updateDoc(songRef, { like_count: increment(-1) }).catch(() => { });
        }
      } catch (err) {
        console.error("Error updating likes:", err);
      }
    }
  };
  const currentIsLiked = likedSongs.has(currentSong.id);

  const downloadTrack = async (e: React.MouseEvent | null, song: DashboardTrack) => {
    if (e) e.stopPropagation();
    try {
      // Show loading indicator in console or UI if needed, but for now just await
      const res = await fetch('/api/song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: song.id, title: song.title, artist: song.artist })
      });
      const data = await res.json();
      if (data.audioUrl) {
        // Fetch the file as a blob to force the browser to download it instead of playing it
        const audioRes = await fetch(data.audioUrl);
        const blob = await audioRes.blob();
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement("a");
        a.href = url;
        a.download = `${song.artist} - ${song.title}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        alert("Audio not available for download.");
      }
    } catch (err) {
      alert("Error downloading song.");
    }
  };

  const renderSongCard = (song: DashboardTrack, i: number) => (
    <div
      key={`${song.id}-${i}`}
      className="dash-song-card"
      onClick={() => {
        setCurrentSong(song);
        setPlaying(true);
        setIsExpanded(true);
      }}
    >
      <div className="dash-song-cover-wrapper">
        <div
          className="dash-song-img"
          style={{ backgroundImage: `url(${song.img})` }}
        />
        <button
          className="dash-song-play"
          aria-label="Play"
          onClick={(e) => {
            e.stopPropagation();
            if (currentSong.id === song.id) {
              setPlaying((prev) => !prev);
            } else {
              setCurrentSong(song);
              setPlaying(true);
            }
          }}
        >
          {currentSong.id === song.id && playing ? (
            <Pause size={24} fill="currentColor" />
          ) : (
            <Play size={24} fill="currentColor" style={{ marginLeft: 3 }} />
          )}
        </button>
      </div>
      <div className="dash-song-meta">
        <div className="dash-song-title">{song.title}</div>
        <div className="dash-song-artist">{song.artist}</div>
      </div>
    </div>
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPopupGenre(null);
        setPopupArtist(null);
      }
    };
    if (popupGenre || popupArtist) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [popupGenre, popupArtist]);

  const navItems = [
    { key: "Home", icon: Home },
    { key: "Categories", icon: LayoutGrid },
    { key: "Artists", icon: Users },
  ];

  if (!authLoaded || !user) return null;

  return (
    <div className="dash-root">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={handleEnded}
        loop={isRepeat}
        style={{ display: 'none' }}
      />
      {/* Sidebar */}
      <aside className="dash-sidebar">
        <div className="dash-logo" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAIAAABMXPacAAAACXBIWXMAAAABAAAAAQBPJcTWAAAQAElEQVR4nO19BZQcVdr2W9oyLdPuPq3j7jECEWCBoIsvgUCIuztxbHGHJCT4wuLLstiyLMHibsRDIC4Tnfrf2z2Z9LRU94Td7///c74678npqap7697nefWWBCiKgnNbwm/xLfmc+D3pjoqfk33/2Zzf3q29PSTPKN3RZFSTAU/c/hvj/m+cmX3b38/Qf6qfDNAncJCS5yx5SqY94xzS6UGWRpk8znSzSKeSKZsn/xkPYsaBJYwkfnYpQM9IRvLIRC6WPMOU3SaPL2W32Qw13WkJqCWfk/JCIhNMBw6VxLf4wNLuFUFE/NrZXC/dZLIaZfs3cfSTlSDjxJPbphv2752dOL4JR0UGJEJeu7aMrcQnnBGv7MeQPKnkH/F/tu8qKTtNnkDCIJL/TR5QNuO4AK3Jcnri4095frt0PHvoxQYszmTy6FOONaGTlG3Fr57yULopXYAxZRyGyATTHUpWx8wjENmf0F3ybxH1iT8z+XLpNCVhViJw/Fe3dJcTmXUyPsl9Jp8vhkjClVKiL/5nug3Sgxs/dIpKVLfkWV3wljyMdBNPN3eRKaTrP8WfyQ1ELpbuULqdKRFMPjn5uinB+g9uIh1mHPzvOZrVMJJxEekrGc2U1xMZR7rBZQPW79nSdSsOVjboJ3clNuuUB8THmu6cZGKyn1i6JvA/vqXTBhFFEVEgKkmPU5+RTY8pVSCbQYh0KN7q/5EtS+izUdP4o0m/sh5Khh7/d4tuGQFpn/K1qn+7rvT/i45f2HbBuigCZuqzE7Z0h37XZdo/jDaXpomIj+fCLppxPNm3TRhb5hHGn5fuYim7+89CEA8xQZmh4wXYqHAUCsUSaT0zIyXiIxSfsji+6Rqm6Db+7/gzkjfxi8V3krGVyIRTXDcK+jmgmfPCs+dFwhDhEqWFpPSUtBfHbAARQYNKUlOANIqQsmVqgLIrF8QnljiHOH1vwT0GtOycyDlQ8ImCO1GiJ1DSKCuxVticbcNESrAScUmvJQl7Us463f7Etin3ZoN7MsSQXsfFB5EMfYvmogq3gp4TRVwpQaFUPArkSmJCaaQo5LeaRyGHlByFZyp4Koew0kJGkk2kRDMdAeKEUW1VW4SSZPIylwLpehfBN93FRAbaRutboY9qOkFTHUVcK6V0MjDIKWMOZZITsShjAmYFGHOIGOSgl5HTtFJaHWUrSkbMOChiFjTNMvE0pMZFFBORuadsmK6VWCGaZV+JPWbdJKFtK/REYtATZZeCRtICukkBNgVlV4JTBS41eHJjQnk1KOQ37nSpKYcK7EraqqAsOVSUj5h9xCyjxUdFaRC3hizHL467iB63uWLCeWKMXdAgMhw9p/iomOiyKQlqPUsjXjF9N+XQVlUL6D4N7ddBSEuFdZCvjwlVYICYxP7EQ0EN7dMiJbRTHSMDzHJiGTpiE8RBoWvKzhoueBOfeJvz/nsXy2yYbT0+jdDnRN13TOvNCgK9W00UPKinw0YCcQSh19JFBqg0MbU2ppEIXWeDGgtdYoQifSsxrWRQPjV4VTRahjVqE3rZeRrQIM5Zg7gd/KcwSUQg4y5xOxK5GJWp3DjvdmJ5DqpkTjSKoseIab1HTeVpIWKMio4tscC1Ps3ABnjp0tz3bqV/6i1f3U+6iYhs7T3M8juUX9wG7/XKfbA7jK3IuTIMHUxUgQ4iGiQMhQpqIU9NbMKmoNGb6WUkqKjirIGj/iM0ZHQVic4nvllCSypuy6q7pKMiQyRbzO1IGJKooNtBxTTIabMSXCr0IajyROtLdcruEXiiq+PzAdA0RiZMZYRpNPl3Mi1MooXxjDCBFsYxwnhKGE8LEzhhHCuMzT0yHLb1trx2HcwoV3bzQ4U25qzokA78ufE0xKyBmIKUiU9YRVyx+LzET0uhzfFtkvlIJiB5ZzatEhvGZzsxt6OTEv9gV1DuXCqgZ8MmKNOoLsuHD652b5/CCDMpYTqLoJ+dSJ8Zx5wdHxO6eUycjEJhmkcQEYbzwiheGMMJo817hsK3vSwD6uESdEoaJl9HhzTgV8VoIBfF2IAhR9FSPdAcfb6iTqM6aVWq7dwTsE1GGBLOaxeOkGQE6ZqkJYBnaSlJTphc4nYYGwmzTIi4cq7GCQt6hrbMYITZINzHnJlM5OxEFEqYiLqPis8KE1lhPEd+xATtYCwnjGQFJGAYSzgYhkILw3Cn4exo2PUnx4zucK2JjmijNOiIU8LYYJGTkJOLCSsGISYhKqRDWUQjE5Q9Aa74E9L68YxXSu5RBP0E6Imc8/u04pzuO5XodpiIibidAcHCf4ziWqCfikI1T2GF++TCNOrEWM2qgfDVTYp5V9NP9pDN7YrCPXqx/Kme1Ft/UP/9Ztjwp9xfh3DCCJkwRiKMaqWBEgaxwlCNMAoO3uWe3ROu1KAdMGEtHdCAN5opmWQk/KjauKOMa0oih8S5SSQgZTORQyIXS24Vf8J55xNLN9EFR3WfytPzYQvUaY19O7OHpuSefYA5PZ0+dR+cncoKMwyHp8GqPobZl0G/Ir5HADo7od6BQjU4YxL7k250QXeX7Jp8mFhueOYKWH+L4fAIXhiO0PPCEBRGGMAJg0xIw65brRjPOygIByEN7VWDM4c2YarKx9xRltlRStVOOJp8wnmsUuIojqDIxcQJgPjMB12tjEOrp/VycKhpj46JWOiwGe5vKP/5YVqYA2dnwpnpjDDLfmAWfPun3D71cKmbbvQwHbxUZx908uJvqsF9TqIcNDqpDq6Y0PUOBvf0sKtuLoaXG5xL7uaFoVJhuEQYyAsDKKE/KwzyHR8Niy9VdM+DUiUbMZDgHHNHaAfq6DKGlIlVCRnnJY5YhjPa1VdKU8qyq5bmMecjZ0ngxSQEcx6Plg+aoUZr6NNJcmyO/MQDcHoWnJmtOX0//DLWOKo7XO5kGz18Rx+CDvUuqs4JtQ6q0gnldqrUBiVW/Jf8qLRRVXaqxkbX2mPWgBIlxiq9xAf3F3u/6C0RBkuJKQxAAeFeXhhcunYYzA1gworC+DXgVjA4JBwY2kFOND1LFQ/ai97vb/Uf2FoIiGU+Cp5Wy8CioB25bNBEnM+g/OplD1DND8LpuUgAKzwQ+Xg4DIygynOd8gj0dU4GQS+1QsQM+RaotPKNXrqHn700yHULQBcPW2mHYlI0UPmYQZnpShvU2tAUqEYH09FFNdq4zi6YE/Z/cxfaASf0j9EgEwZJhYGBh66E7jIurGeCWgazI2sOrZVF7YAFGd1qB+2db+b92XSazpG1awTx3p9kPrlSWq8Au5rz6KHUzNR7YeUo+9En4TSq/wOuQw/Dv/uwmIN29TEd/dDg5ardUej10hovjKm2v3gLrO6r3D6SOziGPzRWcmAMvXe4avVA+PdthqevgQk1qm5hqCBkMEVWqLaiTcRoQGvgu3rg5arIVozMgyjhXoa4owH+E2Ph256SRgeU5LIBLXiUtBlrZkmLHcSVaf9BuNIG4ZSntjfwpnBWNEXKLilD3KtOTptUlFsrCZihg8F3300y4Wn65COIPiM8UvjeSPhTHt/BzzXmsTUe4m1KDcpLIvDale41mIPeh2GZEe6jsBxrnoSVATRjFTaBIrnpFFqYQgmT9fvGw8retimXwnVuUn8VGqHKgjRgYGAxUHc1qm4ughVXuk9iztqPEe5FJtA7lX3cB25Toh2wIR3dagcqjoQrCZNNQM4+WlAJVVi7QI8/mi6+Jxwif8Tq3hyOVknBqGBsGibPQLx/n1D9Tw/D2UfhzCPao4/QO6ZKbqiAbj6uMUDX+ahS1Eo7PHNR/kYSk0GYSp+eghKrCeg2Mr5VQBiLVbFCmAgnhubNvwXu8WElTGiotjJ1Dq6jCwVu0Lkf/YOUeKGBDDGFex2nR8L6ayUXuUhYjtkBVstYpik4dETidpAOkHRgJp6ZHE7j28SbVTqIRcbR8idW+ee9v4p16Vu8+Vu3hvc+i+gjB6Xbn4RHLkG3gyKr8tHFdrjSXLQQc8fZNGp9tCaAs5MZYRqHJYIwVXJmEndqAjLBR3WfiS5RgDAhVhuDMIoWxkiFcXTziPD8W+FWdGI6vtRK1dvYDk6+g4upt8MThWXbxrAkNboXhL7ol8o/6gM3yviQHjkgeZE5ulwRq5P5aJHMpC2A2q3KVHqHJa7j2Tc5vye23qmS0NocsOVyHiNUWPkexdwvD6qPPAUnHmWan468MQJu8ss6htm6PKhw0A1+WDHQ2YSu6T4izVM5YZbx2HRYe4/h/ithcIWkVyF7RYS6JiK/pRwm1OoevQK+u1W/YzQjjMfamBFGR9cnsDAeqRTG0E0DvfddDt1yqWKDpNLGNjiQA+iuNwyskxzroxWGxDjwnhgNP1xG15gxHjC+XFIfYK6skcSW7YgRp6mQU0KfvDOrLaOCJ/cebzeJ3cUXX2opo8Pwq5H4zNBock64Xia8QDU9ITvyhOTQY4o+XaBnIKc+zFX64HJjyevDOOFBODMD0afOznAdmgPf3GboVQ7FubSJCPZDObTgjIotl0hAnVPlglFFrldupZqGKslyBeEAhKG0MNx1ZhKsuVHZIwglKqbKKqlzSjq6uUYnzPCUrRvORHNTVrhXLgyOPHYtdOUkASPt0TAWRWJAjgPhAghIS0w2jLXLyiBF/iNnDWraoZfl2aCHo/yNSSA8D6efcux/HhaPhi4R6Bzm64JQ6oRXrirZ/xQ0z4SzMxQnZzMHJ9vv7AxFObRdx7mM4DMQwSTqnFBeAwrtw99ayq5mnBroZfHO7QVHByrJMtEwWhgKwhBWGFmxcgxMysOoIK1woB0gB9BNl9u3Utp0t7p5IBA7uLdy7wR4PESHyJIRSUwtcrJgpeSSK4N0E88IYztapfM5yeek3n9u6Y2RSUCbw6Dyuo0Svw1uL2j4HlPP5+DUs4W7X4Lnr+PqIihQ75RfWyM7Njen6QEQZoIwu27pHOgfAL1SYjeAO06cenDowK4l/7p1cUzoUDiHjrbmwjW68LM38sIIiTCSIasRQ2T4u3mYY3RX6CBnK62SGse5eBCp3D2OEvqhI8o9M5A/fKf8ygBU5rA+HTiUxBFh6d42I2on7O3Asx0QZ27VsvzAUvIoAWYNnWflgg6Y0KVm4zxEHzkoX/McjO+sqC+WVufDxabC5wexwp+xKJM0zZWdfMBycyfIk7JOE+MwEtBRrDpAF2RWs04Dk2cium/RgEEJmN3atDEyYjTQTg0KTPKXLhnBCeiLBqHQwpCKX6fACxWQr+XLLGytQ4q1Xi+N989X5giD+Ggw4ISB5e/0gSv5mCMiRTvJiCTkrnLszsEF6T60M2E9B2L6nZktI0aAlKNzpKBTsBYt5bcxSMDTN5TuWggn0QW9WPblQ3BXuaqxlK8MQ99Iw4rHAKvisw+E9z8BH9wC6OjdBtphpOwG2qgBnQq6ux0j/wCf3J77w1D5uhH8qiHaj++BeVeZbqmHWhPaCmVUg0tHufXolDDfBZ9ChvXE4it8e8gfQgAAEABJREFUJ7CSGEwJg2TCMLkw3Da8C9TLuCqbrA7rAwd1iQt+vJzEYeFulPL9E+DFIjqipcIa1q4C07mMqG0kuLAtRduUUVeEgIwjaDkhngCDkrXpIGSHsAPe7Bv+9VU48SKcnp//1hS4oUDeWALlAXjp6uJfnoMz9yMHHZc/DHe4ObuRd5h4mxn0GuioD826BY5NVQoP0cJcEGYxpC6bgc6KFmYrMGYcGB145na4xUdZ1MQFYUjw6niPkXHqoJErfPQmOblnMBhIyB1Y8/NkmObDvEhW7eDrXSgw1Fi1bEQ0I7pbf3qIZP+dku5eKFdybg25jxYtzeIjQbsAyUBAyr7E06F0uVCbf2M1sIyjlTIwqqIEOCHihg+HBZCAk/Ph7KLIvHFwVT7bWAS1EfhxtPPgs3DyQVp4rOyJ/lAhlzmsUrsFtVh/WSVsH2c8+efocukM5vR0FO70NPZUS4EGZ6diqcwLM6jmKUXz74LrLGBQ8HY0BS3t0YE3l9xnfq9T4ZHJUQIG6M+M5PffI708ALVavtYha3DDpWrrxC45wmCJ0J8W+kqFQeFHroYujDTPgOUxKc20kthaaUIkSAAt/t9klKjWSlgkeCajnHJnOubOb20IyGVthhYC/jY679fXoWk+nHkl8sI4uKIAGvLZLqXszrnaI0/TJ/7Mn3ncdvvF4JfLbRbOqIehhQ1rH6WE+zEvok5Op0/NoIWZnDCHF2ahYIlAC9OxUovSQFYmlMI0umm0b2A3iDBoCrxTz7nRFPTQAQqfuEFC7tJg/TUAf1S81Qcu57lym7zGDZfYqB5OWHON68SIqCPqW796LAzQSIJ6LAtaUtJoJGitCZKhTw130v6UyIsRAOl1P92hRAswqM8T8OEo/943oGkRnHmjYMEkuLoYGoKyy2sk+x9RHHlS3vSY9Ngjyk7F4FJhvi8rzuP2TDOceBTOzIKzs+Wn51CHp5he6Q2zukoHNypHdIEX/mD+tD91bIKSlM2ToXkiCOOwKg4fmgUfXk6eFHIoWuzAryKPtyy71ntifMwOKn+bCk8VQYGWOKJObrJQcb+vcicevQc5yD88Dj7oQBVqIT+Xc6gxEjAYCXLIHZvWSJDRH6RFWQT9dPiKN0kxiHMEUAqMAWrGqoegG0IeeHVwZPfbcOwVOPlGyV/mwHVlUFfAdamgdz2Qe/RZTdPTzC9zZYU+kmVGZGVz+kqEx+E0RubZrPBQxYdj4WY3o1aigCEXhdIqOGMuXG7zzrwWjoxSCdOheRycHQvk3uTUqpf7QmeetaolDq3EZcAMFe5UdVyOEJNgoDs9gtt3N9PdA3U6rM7kmBHdpCz8y+2s0B8J0J4eKDnYW9LDDRU5JBJYc0hNkCoUJ2tqe5EXa5klASmu1LIOGg3CehUSQOW5aL8bnryzZPs7cPx1OPFm+WdPwq3V8poSuiQEM7uHv5ub//UMGN9BarZwBiPcltdl+ZOYFKHYjz0Kq4ZxGMMtShqTIqwMEE2HjrITwSKDMqjgD4bIU7dxwkSmGSEeCcKoUNNM+Poa8oSdQ8m6tMQRlTD2extzhGESYRBDluSGhR/F6peXVtlzal3Qw6C+t0re3B+FEfrKhEGeSRdDIyP16Sm7ktHJ04XibLDKzMF/cKPOZ0ESSi4DXS5jNjBeJ5fnhklXV218B5reQqleuggGXcxXFbMVhZDvY4oCfMAFNj3rsAF6/5evL/3tRTjzIDQ/3HHpn+F2D6XXS6xWcBiioiOVQTTpjAnSgPkuzCiq2jQdBDSCUShSYVJkylVQCBiTpU4DYDT25sLiP+QdR0+Fmj6gw6rx0DeXLbHkVLvhIjtc7IS119hPDI9Ggn7VH98LvViZ39gaiuOLsgtE5n9gO0+AhCcEaNWMSc+4HbzPDXd1rP3pVWhCI3i7ZNPbMPcWuqKQqSxiCgIQcFNOGzis4DSC2wzLxzuPYLnwCC08UTLrLgiynMXIW02IO+UyUHYNWFC11YwXbUsPPlIDs+i4vJT5ukrJyVEKYgfDQBjeYdsMGOsEYw5v16AjYmwaGGrovGUqRKvfokOT4M06KNTy1Xauo4PtYIf5JaX7se1dIPSp3zQeRptioZjcrtHx8bnQ/wVks9zOE8DzjEwGGhVt1DEOu9TrgctKqt57Eo59AIff9e16F96fDNWlUFlMCAh6GLcTUP0dRjo/j9n9oObYc+ypxyRnnzRe1QhOOWM1sjYTok90v4PNcFuDumcBFKhov4GIj5TBEocec1CY6q/bhnaAijzMfnIiveVO8kSQS452IHMZoRNULLgDC2PkwHByOLP7DuhkhzqjtMGZ09EDIwzVq0dGLeCuogNj4bUKLMoglMvYlGCUkueI5HTC+qhIkpICmWy4Evf7Cae1xuE244gnIFfF6LWUzUoIqAuG7x9DN30CB9/T7H2PWr+A6dYB6krZwjCE8pAAymkHp0FSWSDZ97jyyLPy409Jjz4hx1rBlctZo3VZnlpa54cdI03ND5fufACe6YLqzwZN5AGLoBGLL85tgAIIjrtMKoylhGEMqX7H+gZdBAGQIAHoiIp47R9L5cIQafMgDAYYEgz966GjSlrrVDR6Y6GYiYZiZ9NwWH01XWWEYjXrygWLPLY+SnN0/B0CkYwoBYzJ4TtlIpWOlXiIE6TtfoZm0V3yIJOCWknrMJGw8G4XlAW1t/Ti933M/vohs+99yaGP9f1uhsYirrCACodYj4d2ucBtlNYUcfuflB95TnbsaQmmpx2LwauV2MwoEOadA3rKsSRuxoJgBi/MDDxwI1yUy0XMKHTQAH4d+JQQyIX1tztPToouBA3p9OUo6AmcVSNFEwnmQlgL6//oODkayP3hIYXzboaeHOajynoPXKGxTO0qJbfM+qrODJAc6yO73AeVLbkQHU1G43OhZOjTAZsW22xMKRX06ApZYM8L/tkq5E+ebwnCKiWtyQWziXU6ID9EV5bBskWG3Z/CwY/g6N8L5t8PPSukxSVMJJ/L81FIksfClIbZXY+pDr5AH39acvoF/XVdwK9pISAiM9/eUS08JDkzE2tgaJ7mP/ogfHkTU2OHUgNdgAwZJF4DWJUw1de4e1aUgIH1e2fCnCAY0AtpMCMCrK1eLi89hLVxX+Sg/rsRcJtcUmmL5kJm+Z9KJCfvyTnbnxP6YS5kvLcG6qQSrw5siuRkNN4HJMOVwiBSkpDIZqqWrdC3QMxxRHhpq1D4LydpkdhOqYyS5yABVC7WMkbGboOAH4IBeGF85OfPYP/f4MAn5Uvfh+E3sEVFTGEhGwiC1wceO3gdsGSGdd/LcPJZRlhQNLMv5CvR/0jsFggYqXwbvH916AAmSFOJCFMkwqyi1zBj0XEFFhSZ30yevbgI6t8bFA3Fg/KOT4LvrkYfAnYlRgLWiqFY33HLlOidgL512yfDJDtbZiYEdLOxf/BSu242nh4Su2Hpn30ZdGpJRtusC2XS19S6LnK2WF/xWs9xRLsRcYkMIQaZPCb4J9kTv18uh5wcUKgotQYMBsZiYTw+Pi8At/es+eYd2Pc5/PaZc9tn8MkTVFU5lKMRhJEhzuUGrAMW3Fm05zU4/SI0z+/0z8fhMifmsjKnjc2zcH4r1OR4J14lIS4Igy3iOMXTNAe+v5Xt4IQqoyxi4wImjATOQZ2lwhhKGGo9OZbeege4csAu5W1aDAZwJdXx6xHRZLRvyYEpMK8cSgwYBqiuDhqT0R8v9zRhIns3JfQvefkW6E7J8gwMJqOtdwj4FEvT2bgQsSCc7tB5Alg2pvUEYpkC5ErIUaNQLaIie9oK7qQUalqZC1qsmMyUwy3xBaCuODh7Ir3/G/jlS27XZ5I9X2jvvBXqKriCQioUlrh8YLZDv/pO61+H0/Pg1EuhXfPh9T6YHTE+O+W30AErhlwqZIJnOpbtmksJ06AZnclEJIPYwdV6WYGVD5sgpGCrbdSBu03ChLKj02FhFSbyjFmJkYAQ0AGqFt6J3gkJyDs6Hj7vBmV6rt7BdnExnZ3wUUP46JhYNVDzt35YDcj9RiSAMeSIEyCCbSIBVKq4kbZZyy1GCfEzkhxKpqQUuURUxlYBlQ6lZX9U6KiQH0oNEkCjXtvtGGmhMCK9uAu/8VPl9n/C3i9h/7/K/voS9OrMFxYzkQKpJ8g586DeWf3yTPr0a3B0PnPkBemJBZ7B10OBjvFY+Dw7XWDnil3QQWsZcjF/Yor8DNoBxttJoaOz4bOrqTITqjN54cCngets9mndHb1rIQKov5xJyVhUGAmgHELTr+TIPct+tpOjYO11UGOEBmvLutC84mg1QBbm6hYPg1skUrQAVy5rVIgQIL5ltgBRAqJZTUz35ajUuaA2UrkmUGhAqQWdjYjWjII7UWilDmRqkCqQAFBpiGh1lN6Aqs3Y3RAME3l+ZmTjN7D3a5Twhi/g2cmQX0QVlnDBCOMPQdCtvKSjZO88xYFF0PQSnFpQs3EBTO4GZo3Ua4MCG13s5MpcVJENHqws3zqLIo5oEiVM4IWpefdfCxerJMUWJt/A2rFCJu+gEeWNvtZKoxHYcqEI7AM68ISA/rqTw2HXn6CzDRqMkkYX2gE85K/YMzFWjjWsGA13KyQ+PRJwvh5uPwGQrOjZtG+5TMz5RHUfEadzDaCzgtmVc8nVfOc/gNkbFSeYHLTeSuksYPJpa7rq6i8Bs49R6VEojYHWGsFsoW12xuOX+MPQq3v1R2/Brz/C7sXSbV/zP3+lvuEGqKzkCoupcD7vDYLZAQ/eWLntL9D0MhxfIDnyEnfoBXvfK6BIzwRtXNjBlDgkFR64SG8ZcYnkzCTp2cnR1dDxpXtnwHM1dImRKjaQW2MIXOt7k8acqBdSQ5jWXl/Ck0Wh/qrTQ9hDd9Pd3FCvl9c4pVV2mGKv2RpbGb2nYcM4GKLBLAhLgXgXhFt87BQLvClXScUbJBNAAq9MgT6dVWn5XD2EGgonPybZKHDrBf+IWRBp5Kxe1uKhLBhC7TD3jdCP+/xLD8LjHwDyoTFRGh0KGEyMxQZOL58XgtJSU+/esp0/clsXw67F8MsPZR+8DjdewRWUMpFiiS/EuPKg0ln44Cj+zFtwdCEcexGa5pVtWwBP3gBeI0YCKLYx5S621kUhZM83FP8yK0rAGEXzeNnpMdrbKqFayQeN5L1iuxKz+Nhb3ZQxh7WoII9W9wjyzQNRlGcGSY735S/zQo1KWm6XlNlgtImsQ8QI2DwOhmskLnKHMpmAhE1cvzNofGoaY+GXxF4egyqGUy5Xz6p10Gtgxy83wQYBNgqNHy2H7r0lVp/UlgfOMFtcx/50VL7ylGT1KX7VSVlJLRicdK4OBX0UbbCBzU3ADRVBuBgWPuVb+z1s/w52fO/Y9B18vJCqrIXicgwGxE35fJTfD2+PCO35Cxybh0Iff0FyekFw2h1QbWRCVkmBk61wSqo90FPrffA6mTCZJRyMpoTxNV+Mgj/mSkIm1q9veTvMhEYgxUhAXAz2E+EAABAASURBVLmbVl7kl50dKG8elHN2kPRUf1JwVcjlRRZZoRmGaoniC33IitC2CTBKi16LtaqT10ST0Y83ixSqLBJ7U/d1jgBKIkHvz6i0rNaEAjeNqvtqM6wTUGr/thKu7Mc7glJXGDzFstpu/NLjshUnEX0URXVnMLgYjRGFBAm9FawuyuFl80J8IAKX9ah463XYtRy2L4FtP3G7V/inToG6Wi6/hAkXoaei3XlQ5cyfPYQ7/So6Ijj+HDQ9H9kzH964C8IWyLdRpQ62wg0NDqqDC767Ie/EDCQAhFH+IzPg0yvQC0GhjvFqwakiC2oGKYJIcHTS8lqH/Ex/RfNARfNg/sS9XEcHFOZIgyYUdPqd1sQsoE+nrZNhoBKjN0rslaZ0BKTcMlhAPNbpLKAl/8Hwq1BTai2nt6HAjSNr0QKiBNR8ugauH8p7CiTeQvBXSGq7s0sOy1Y2catPoigbMBJ4GZ2JxAAkgEQIG211Uh4/h5GgqFx91XWSDUvkm5fDVuRgacGyf8PcKVSkhCkoo8P5EAhRHi9gcTC/T9Gu1+HES3D8BWh6ViIsiDxwD9Tq0Q6khS6u2i2p9cI9lopvRqH6IwHc2VEyYZxpYCPUy3m/gXLntrwXpot+WMIkI1HhvfrwkXGRQ+PhzWryIJBHw3t1mPBARyZ0/5WxVwoKH7se6kFqJup//gmJuBgQr+8pfH0C2gkWQLUNIykatSUA3QhrdHImF1w7pP4f62A9IaDqi81w63gur1gaLINgFV1xEf39fsWqE8yqU/zas7pu14A1iJwxWkuMAMpoYzDAOr20N0CHy6hQKcycVrD0B9iyAoXbvETy8zJL3/5QUc2FC+hAmPMEWLcfimy+obdxx+ajQNNzcOL5ym3z4f7LwK2V5juocjtf44GuJmXvKsnJUTln0YFgnTWm7tvRcDtxROSFQJsSQW/5rIdWRspaVIyLA9pLQpDH01YVeWvTpUYaIE8N/ly+ly/n+hB5794hI15LK215q7LtjckUfiaNvqe1gLToJxKgwfyHMTp5iwcuv6fu4xUxAkr/tR36zWb85XyoCsLVUNQAX+7QrjgOa84wGwXbH+8BZyESwGLihOqvs6A1AEYRjZmzephAER8uhepGz5hJkp/XMRtXwZZVsHVN6eJ/wphh4AlxgUI6gAAFeDQCkxlmXlm1+RVSoJ14QXnwWcnex+U9SqDYSBdauBI7U+OEShu82aXg4IzoIsSwwsPT4J3O5N35iIaJRoLYNyQQTZTY2g56FeKUjDIUypJDvvthV5K4bVCAnqStJHmNfocl9j5l/K15EQxFuEnkIOWBlv2pCJBYvdD11pq3F5MgvFYoWvwrjHueClawkWpACVbA+2vMy47iIXqzEBg0BTzlEqODcKA3E0fkLbBdd7ttwHi4qBe4Qqwfo3EpkXnz/KtWwaa1sHGNdP0ybs1Pptv/BMUlnD/E+AK808s5PJBv8g25RXZyEX34RTj+NNM8r2LBWOho5NAR5Tu4Moe00g23GSo/J+qPRqA+PUp6dLDssiCUKTmPFhDZ6Ivasc8NtXyJSH3+Y0StH8hpEb2s5dsrSgn5hFGaN4pTa3dG9QdRn9VKQDQIS+g4AqQ2H9ReVfniR5gCIcqBnw7Bw+8h9HRhHR2qBE8RvPSld+khWCPAJqF07osQbowRgFUCqA0w56WCZbtzNx6Hf29li2vBk8/78qX+QujSs+Dx57ltW2HDekBT2Lym+Nt/wcRxlMuHoZh2e4m4XGCxwBv9wrsWwcnn4PQLHdbNg37ltEMv99vpYitf7oSuOu2ABpkwVnIWo/FQThgdeewG6MxJ80zkqcXYK3lqGcQ+K3ReyNcTyNO4Kr6NKLnWd+oT3iXOiGEK9DMSlbidI4BYQI4as6AWAkq7Fd4/H/FFlB1Lj8Gi76GgHgobOFR/VwFMX1Dw468kRG8U6l/9HGqukBisUqMNjHawuOAfq/TLfoHVB/hNxx239gVPAesJEwLyK5myBnjzr44Va2E9Ecn6VdINqz339oNwhHF5UaRWN4OJ7OW+zl8/A2fmwckXinYvhJduJe8f+K1QaGVLnVBvh0Yn/HC95/iU6DMQQ+pXTIS++vhHz8mHic599AzBJfjGfx4tTmLQU9EvoaV7aUnMh4tvIvG6jWuLrYBG01Da4CAuqKCDd/gMdPGwStAtOwH/2AFVF0NJR1monPYUQJ/7qr/eRghYL9R/vhauHYgBAI0ATE5Spr32pWPpHlh7CDYcrXh8PhQ3cE6/lLj7YuKOOvcsePQ5bst2WLsR1q1CCX7/DTz6IOULgMsrsTp4ix0KNMVzBlHNr0DTS9a9L8EPU8FvIRIxM4U2rAy4ShdM91dvnwbk1uPggkNT4Y0GOkK+Z0Oe+DRKz78DE/Uq0bga+zQgHRPqHOgtf6b52FNy9pjOnUDGW5IpM6KW37FKWK6ilRpKbydBOFSnv+4eCXr5FWclK06xS5uk3W+E0ouQAEyHoOddte/9REL0WqHghz0w7UXQWRmzizM5INcIQ6ZXLN4Eaw+jVP5zBfQZCWaXxBWg8gowJkOwlCmqgZff8i5bD2vXwZq1ktXLVZvWGa7sBW4vok8I8BsMN3SXHF9IH3pJte8FdvtjbGUA/EYqYOYidrbULqvywPWaonfujT6iMtR4cixsv5NpdECppuXmYtxLSC0vpSZJ7MuNyR//S4Y+o0EkuikRpy9GgExBKdSgs3FmN+b7fF0P9oejOStOw6pmdr1g7DMGyi+RhytIMlrRo/jhhbCZ5EjmZYfgg1VYIYM9KDPZOZ0Z6ns0vPE32HAMCTAv2w3vfweeMDgDlDvIeMNcXj7ri0BVB/+E6dyGn+m1m7hVq3I2bHDcfAtWA7zFigIek6JTFb9vnvTAAvmBFyS/PSttzIc8Le03YTTGSCCpcMElOsPwzhJhDCuM5IXhUmGktncl1Mh5DMVYFSeVVCmEASKpPnEmglXC/oRWmaFPbRlxa0GgtbJYB3iLIFQB7661LGsiwXajEH5gEdRdnROpJAQUdDDfPpTfIFCrT7GrTvBrTmm7XweuQqnJSRyRI+S9azC38Ris2g8rf+XXH/L0GQzuCGv3cY488ERoXwHtCYHTD9Pm5H/zo371GvjiS1lZFdjdnMWOAm4jIeDAfOmhl3MOvogESOrywaOlvSaMBFSRjStzQSc7e2mQ2dtff3oCkLdlRoceuQ668FKfkbxOI7qokHITh14cyZTApu0u+WjLaqg0hxCQayRh0BUicv+boR/3EQLWCeXvLYWrBkrCVTwmQpgRVXRmvtmTuwLV/CyaQvHs5yHSQWJx8WYnOhzKG4bPV+mW74E1BzEYVH36Hdw2AMs0idUNLvT1AdoVRAFfvrpTd91V10F5DVgctM3FWu0o4NEZrrlEcvw15vBC1cH57K6n6FI/eAyUx8zm2c6FYvJlD/jqCv/xadGaYETV3wfDNbLYva02t1bSPPOcjY5TKdU8pRJnYwFp97fcD5CT5WiVASMqY/MSbb11PCmD156vBuhQNRupZdA43AXw6LvBJfthfTOWC7VfrIE/DmYMDt7sJpFAY4K+46q/WQtr9sPqfTkrdlGLN2o79wSLl7W4sUADh59yBmhnHsmadGYsnimrEwUDAGe2QUBTdN8g6uRrcGyh9cBCWDEbEHe3CQmgvRbINzMlDqbOhQLPVpT+Nj2WC9WtnQgD9bFbK/Er+/GLCuJqK6KsIjC2OSRyOHn/+XHE7gbzUloqB6WWrKyZXVIkoP7qqpc+JuXYGsGy9Ci8sxJKO0FxBwzFjLcQrhlY+/dV5Oi6ZueyX+HVrwDTJ5sPjYBw4C+JjLmP23gEvRCs3gvr9pX/7RvoMwxy9ZzBQlk9tM1LWd0oZOHI4ogJEkDpTXBDeYd/z4dji1AKfnkNXrkbLHrGaQG7jg84iPqjEdR4+DofjPNUb5watYChVbumwewAFzCQZYm4J92SCRBHo73ot+k2JasibVq2+Ho4Wg1gMkqqgYKO7oFTOIR4VbNkxRkU5dV9oLQrEiAJlEJJ1/C0JxmsFVafZVYdla4/af3jXeApxCSKhHH0RXYvvP535/LtsGovCr16F7Nmd96YyVDdgdGZCA3odqxOdD7E/5jsKGAysEE/fPtn256/wpGFcHRRxyUvwe2lrMnEmc0wvLHwi9nB72fBnG6YjMrr8qCPpfLb2LrQsKL902BBDXlKLoDVgIp8NyrNo4Zp4csicRdpnhXUyZc83zh2TziajILeRhyFv0Ja14NbfEi57CQWBNR6If+hVzEUy8LVkmAlhKq52u7cd78plx+FdSdh45na97+By27FUg4JwGhMVodqu5Y//TKzBcvmX2DVdli9Q7VuGyxe7hw8Ahq7YMpEqfXk3qfaSCu0rEoP19aXv/kIfewDOPA2HFrEn3irdNYACKvAaZRGvLBjrv7Ei+rjT7G/PiDtUQiNHrjFVPzh4NiyRPDwNPiwG/nAZVjLWtXpCBDR0XSOOl3DFGdmb2vx57Rc+FwuRGMyqjUzWNa684k8+Yn/p+jCw1qh7KstcM90JlzFRqp5TIccIZj0TPH3uwgB60/ZVv4Gf11MucNg9aGvRwGzg/OF4OV3Pct/hnU7Yc12WLOJ2rBVtnkzLF9umP8SzLhPcfed0t63w8T+pufnwvZ3pb9+Avv+Avvf1u1/k970rLQgD6xacGuUnUolR56UHXtaduQxyaFHFFdVQIMLrjMVvtoXogvUvqNTMCZThXqIaAgBehl576Xti0ftVXCRaJyehExYp93fkgtFH7dSG2j9uVB8/VByS2AtiQTWZcfg7RWxSID5KCnKqnqWP/UmvaUZ1p2AtQfZLU2FUx+A/Co0AhT06bTBjNlO3t2DqJVbpBt2UWs3wZqNsHYVtW41/LyG2b6e2b2U3bOM27eY+fXfzJ4PUeDgm3D83YYlC6FvR05nkJkskKe23daTO/Us3fSU5vAT7M7Z7EUhaPDA1YaCl/vECPAcmwLf9Ip+6zU1AckgZvTsVNst3dE23WZkMqGv83vOPRtBQjGGAe25UFx6cXDK40w0EjArm7E8NmNRVnaxJFLBhcogWCntcBn7wx7V6sOw7jCsPxJauhUeWwj2PAzIGGMxz0F3j7EXLrs6/7FnqU1bmC1b6Q2rqfWr6A0/Mht/Yrb8m/35W2bHZ+zOz2Hvh/DrR4Z978Ga57WXNIDLILXZUaBUW/bYCPIKeNNTtoPPwJIxVK2XawzAdeaC1/qBMBG9UN6RafDlVcQCwrnpCIife0pAkoGiklyQCIztRr9N46RQDAY7b/OCv4yv68Z8u0+5vClWE1S8+yNcPZANV3KRKlKXuSLQd1LVP9fBhqNRDn7jth4pmDIHiqoxmKMdUBYXCrljrLfCNdfn3f8QLPsuZ/Maevcq2LmC2rUYBX77ij7wr5yDn8L2t0OT+0OtH7Q6UhjbsTKwwm1FjT8+ByefghNPFu55HuZfT5U75Q1J7w4dAAAQAElEQVRBuNlW9MHwKAFjQ4dnwIc9yaenYzGglYBz30OJV9WUmKREPyNn8TC2YxEilQWcWxnFUByLBDozY3bQrjDlDMGU+YXf/0YIWCPYlx2B13+Ass7oiCShctZfgnZgu2OwZMMRdu1BWL8PNuz3rtwMi97hg0VYl6Ero60ewoHZSWkMKFBRbbr+Rnh8tub1F/gvX5d9/Zb6k+fgjQccg++ALhWQq2F0espmpe1YEtrJax0fDg3sXQRNT8OJZ+qXPA59CiRlXnVdBPq5y7+bBAIWw+OK98+GBR2YsD5jFiQCSLuISaHE7UU/RRfxzwjlGmORQILla12v8qf/iokQpkOw6izmpq4xD0DNZVgbs4Fy1ldEAvL0p4t+2gabkIBfYcMuZtu+4r9+DHf0pYxO2uSKZf0tNOgsZNku2j8pgB0e8jyLwQR6I4Ue32qjbHbOZkOBPJ2zdy/J0ZfZQ/Pg6LPs6fmFjw6ARpOsyq+oDcHU4uot90cJGF+1Yy7MKDxXByh/PwGQxu2kQ5Ki2n459/zetj9E9lOtkUAiJY/fxh7SMrtYuw8CFTlde7E/HM5ZcTKWEZV8vQ2G/RkdFBuu4gKlDAbkgnpX39Hc+r0osG4HtX4nt3k3u2lXYOpMTDpJZmWwxaJCjIaYkDLYaAOzHcuCGPRgR613SKw29EIwsEvNT1iULYCj85UHnpf88qS0ZwVUOLnaAFvjh0XdivY/FH1wcXL90mlwl1maZ2JcWpFKOB6+5P3J+CZwIKK7LQSIq3lyv4k7W95+aXlMkdQE0aXmFkc09qnixbsJAasF+fIT3I9H1Ff1hqJOmJXSoUpJXhHYAzBgTMk/FtNbf4ONu2HjVmrTNuWWn2HZcvfIMdDpIlpvB62VPGQXNQiyFBEtxGJFWWxBgrO6SFEWttl7X8vunp+z/zU4guo/v2T7Qnjyj5DvlFYEoYMfOgZg5b22Y3MRfUqYXvnWIOipkCEBTk1sLSj+QfNs5p5OuzO6kDYEZIN+uo2izj8pHX0FQ0HLVW0cUXm3wOTHSG288iw6ImIHHy+HuyZR4Uq2oAaTItpfDJ4CdadL4dNvLet2IvrIAWzayPy8RbFjC6xZ7nrkz9D7jpz8YrC7CRMoBntU8Ef0uUetGQJuXfcu8Mk0586/wKFX4OAiODSPP/la4ZMjoJOTL8nLqQzDxV7FnZ2lTTNkJ2bSZ6ZKhVmuiZdChxzy+oZN1fJxvrYEZOWB04ObFT1p9Tq7Wvl8Ry2RIM4RmZzEEfmKEWt49TsnxuFVZ1ByVp+kfzyoueEeKOmESREdLJfklVDOCNR0zhszlVm3WbZlB71pE5HNa5kt69hd61F0P3wG7y3UTh0NA3rLr+gJF3diO9VLLuoAt16qH3s3/OtRw453qWPvwsG3oui/4v3lVfh0HFWSB4UeriIgr82HP3oK/jKSEubA6emqphnsvvHSS0NQqeXcOrAomFw5+c9qeDb+IzQJCKb0P8k8JTQXZyhDZSFuSm2OtrysEU1Jo48soiOiCQcBHh3RRTeWPP8+vZGsAsG6M7ChufCLtTDigVg8oCNVEKrgvAXEHfX6Y+jx56gtW9ltO5jN6+lN6+gty5mfV8COJeyeFcy+pSj8nm+Ynf/kdnzC7/w7s/8T/tA/6EMfwv73YN+b1P63qCOvscffzH94KHTyUhG3tDTI1ITo6iA8dnHZzifI55+apwf3PQTv9IJ8E0SMnEND/r8IlZR8zjHuQ8XJcxdHQ/ycZBbbWEBGfFP22JaAOEcUu1Gj1pEHfixuzukHX5mksit8tM68qgnWnoI1J9k1R1Hco2dBw2WxhQo6VAH+UsoZQIGb/+R7/BnYuFq2cwu9Yy1sW01t/ZHe9hO9fTEK7PiK2vlPavffiez5EIXe+y4KHP4LdeL9/O+fh+nXg8/JBr10eYCrCqP3l/aqpXffl3vsEWieAcKsup9mwV0uPmgmnxLCBPRcBZD88Y10BCQAkqJNmqPxNFDpXJDIxai2tplMwHlHFH1wEYx2DJ6MM8i6QtDj1qIX36fJkxOnYc0xWHucrAW9863i4l5QUMuEK5EDOlQKgWJwBEkA73mlY+R4+PwD7eofqF9W0XtX07/8CLu/p3f9i9r5Nez+B7XnM9j3MXXgEzjyEYr7uxfh2cHyulIIOqmCPLY4yFXmsxURuCVU8sFkmnx/6wHq1CyJ8KB74pXQoJL5zTQJv0rQyNJ9mrX1twjE6Q4ln5DcZ1bQi1wpkc+W2jj67HSsNIsGZLD6kAPIK+ZK6mHRP53LDxACUNYfYn5uCn2xBCY/hDEZAmXojkjMCJShNTDuCHFK4WJl40Uw8B7D7Gnw7kuqL9+mV38o2fB39ucPmS0f5Kx8Df79nPXxcTDoWnlxAXicEPSwhUEoCzGV+VgecxeXwncjyNeHTt2PBNiPPAw/9aOrHVBsIG/ukfCbAyoJ+ZxjqsdMUqKRDt+UmIjD2MYFifeYwFDqncl2oMxNtIOqHv7xD7HrT9Brj1NrDxDZtI/ZciBvwV+gzxB0RxAoj9FAHhINltD+QnKP3uEni0WeIBcqgspKvqGB7dJAd6rjKsqgIAJuD5GAn7zXVxKmy/K5ygK6LAz9agr+NoM58xQ0PQonH4Szj1R+NwvuCfBhCxMwkrdljPKY94+F3/j/tiR+jukAyXJ/8tHziIk3Tt6Z0nAS2G59e/K8HWhMxA4sXtoRoD0F5O7Y8Ln5n66gN5+AdUeodXtR2C2/MJv3eF56A/qN5Ivq0AioYDk6JSpcAaFyJINIsAgChVReBHxh8AUgLwjBEBWOUPn5dEEBFOdTJQVsWQFVjEln2DLqJvjlEcWxF+DYYyjKY4+yv83JvbEWKvXke8keLL5UoJO3fo413f8TkE4RxY+KaHA8YmIpVMo2GQdBicQDvQ0LNPTvrCcf1VzV6XJ465+OlXth435Y9yuzbie7fhe79Rd6y27n2x/CtDmKzj2gqIpEZiQjHGWioDwqpShUpAgFCgupoiKqpIguLWZK8Hc+dCjQ3XY5fDvJ8tsCaHoWjj8DJx6H00+VrfwzTKijgxYmZGXdBrCqY86HfMqUS/sZSnHoRZBJB2OGTeR6It2lNJfWxBSiS3WxvCj6XpiLsfvQvxMXX9bR2nswfLtes2EfvekX2LCb3riNyLbt7I6d2iXfw0fvGSZMhtt7yxq6QlkdHS5DpwTBIipUTF6nCZPXx+gI6n4hV1UBN3Y1jLsLvp+j372IPrYADr0IR5+mjj2jPf4sbJupuaEBKsx80Ep5DYwlFwyK886HS3sbUsx7pFHThC1dny1Hky1ApEHKc1KOhmoNyOfeJSb3DHLUZKEC3ZHBBnYP5cpDUyDZzkVXusfNguWbFFv2Ulu2waafY4UY/LyO3bGJ27WW3r5KteQL+Pwd9fwn4NGZORNGMCMGcAN7o8DYuxQzhsAbkzRfPg57FskOv8McfR0LMfrAiyhw4jnm9IuRV0fDTflsyM4EbbTbCDYNrVNCbovzEf8CaEaIk4kRgT4FpAm9JCtyfHfpjiaPmGp1RK0F2rk3ijEsk7fD9BayemPPIw/8eCIo0OMa57gZ8P0S9aatzPYd8PNWrIRJMfzzChRq51Jm93L6tyVYiLG/fYvC/PYlu+8r+tCnzOF/0Ic/oA69z2AV9tsb9P5FKNA0jz69MPTTI/DQ1WyJD/KdiD55l8+iAaOKPAuNdS9mPjwr7nxSTjAlAclbMjfJGKbwOek6zZLqxEPJ79TLleSBxpg7MtrJMqfTT3tCyAG5OdzQ1XTHvfDX9ww/LqF3bmZ2bWF2rKa2rSRV2LafmB3fkVpsx1dMtBCj93xK7f2A/vVD6td3UGDfG/SBt+D4a9SJN9zLn4B5d8k7YrRwMmEnBGy0Qw/WFt2PffMw4QlncbVLiW9K3JNhEdmfGD8z9p5uKGn3t/nvOqPPVLd8NyJKQ66eVMvRlc4YDYCmgDREypUdusGoUeann4bFn6rW/cD8soLduxItgPr1J3rvN0R++wwFDnxMH8JC7APq6IdSRH/nAttfp8PMmwj0hS4m7KaCTtprAqeOjn7EjFahJ2zJ+hMyn3aBmE2rlIcSWmW7CHEBQ2zDc1saoJWGWFTQGsjDVSYHsYaoUyI0RIX2FUBFreKSS2HAPeop42HBI4q3X2C+Wihf/Ca3/A0U2Q8L6H89l/vWTHh6mObua+Cy2tjXtiDsgpCTzrOCu8XtULmY88jIx6ulXMr/M7JdUGaEOMsOsyJA3AwTe0zf2zkO2PNVQuyJihxV9PMdBtAZwWAlscHmoRw+cCMTIZLye0PgDRAJhsmLkiXFTEU5XVtJ1VQwFSVQUkBF8JAPAm6EnsJ//S7aawOXmbbowKShtAoSchVSkPNwzu0kZP3xMxWZXUKTdOdngz6I1wEZKUm5ZdX23FeGyH20lmJNHqMhFhvIHWCdhWRKZjtldYLDA04v5cmjvX7Iw+IrQPmDKORbQwE/5Y9KwAd+L+V1gsdBuSzgMJ2DXgW5CgJ9zO3wbMqXijLiCKk0LB0lGQlI0VvyVdPh24a9LJqkG1lCcI59zqklNmDFEFvAiNmE0Uzu+lqslNUWu/UITge4nDEhH5Vz2CibBQWsBrDoKaMG9GoqVwnqFuhJqXUO+nQv1Ino1gVo5AUra+pjWV4sbXfpR9/WGmKpapQJOXoMRYtNqJAMDaXR0lod6DB/1aNQBkOrRP/EMjuq7xqCO6hy0kEfv9qTMJ52ISU+64xwifTc5kAy9Cl/U3E2kbn39E4p9fe3chBN1GUFrVRSUQG1KkEoZQ4RhZQIhlkZT76kwPOt0Kf7X+Oz1+LkKSfMN/mcdB22OT+BkOQzshxf8lBE2iafQJ0P0fT5+jkWIfgomlIJ+eJiTHJkbUSOO/ko6Nx5R58K+gseYToCUqKXEbT43tJWwiJ9pbxSfNfZN0w+lPjty3gyzvGRLFhSUedwP89i21fpREYiohltwBJ1CSn7FJlyGwIyjk+kx3SjEZlVtifQbQqIOIl9CpNulTbvMqb6L5jFxy9OgHirdh06j3urumcFhKgBZjwkTluWHaZ+bTHVp2LbO5KMwxNRSpHeslF/iqJSINsuQ4vvVGQ06c6PPyHezi6YtnQqnLJPkUMi40w+mrA/3dGUHaZO5y9giCLTFhlcyt8pG6YbZJZNsh9kwjizbxV/VGRn4jhTjjVhBJAdMSn7ET8q0urCNvFrZT/+1GCl71PkWu1qmAKRLPdcwLR/zyZ+ufYeEjn6O1uJo0+JWEDGK2WElYozGpE+0w1RpM90J7T3WvEwZbxiui1hSNkoXGoCkhmjkrZ0h0QukP20E85P9yPl5dIdjW+bcnbJDZPHkLLPZNySx58a/oROkntPh2OWECcfSp7b7+9TZOYi40/4kc21xLDLIlYnXy4R7XSDEJlAyk3kaEZi0k1b5HLiw/g9bf/brRJoSyY4swZlP46MjGZUnywvlPGoODHiw0g+mnEMdyAMvAAAAL9JREFUKc9PCUUbgC5Yfdo7MfFDIkezsYwLbijSJAEykQtl023yVcTUX4SVbKgWV/yUExOZnnhvIlsCaunAzdit+NSyGUMyvGmHkgBTNpMXGVaWQ095lXTDo9LTmW6E2Q/1AsjOyEraPtNdIyNSyc2zubYIKFkOPRuNhrZbyk6yRDP5zHRQig8+MwHpzk6esMi1RfQxyzGlHGWKmaXZ4lkR16ds9sQPIOHf+P0ZdT91z9nN6H+3/9b2vwT8X97+Dy5zgTHYl6KoAAAAAElFTkSuQmCC" alt="Sonic" style={{ width: '36px', height: '36px', borderRadius: '50%' }} />
          <div className="dash-logo-text">
            SONIC
          </div>
        </div>

        <nav className="dash-nav">
          {navItems.map((n) => {
            if (n.key === "Home") {
              return (
                <Link href="/dashboard" key={n.key} style={{ textDecoration: 'none' }}>
                  <motion.div
                    className={`dash-nav-item${active === n.key ? " active" : ""}`}
                    onClick={() => setActive(n.key)}
                    whileTap={{ scale: 0.97 }}
                  >
                    <n.icon className="dash-nav-icon" />
                    <span>{n.key}</span>
                  </motion.div>
                </Link>
              );
            }
            return (
              <motion.div
                key={n.key}
                className={`dash-nav-item${active === n.key ? " active" : ""}`}
                onClick={() => setActive(n.key)}
                whileTap={{ scale: 0.97 }}
              >
                <n.icon className="dash-nav-icon" />
                <span>{n.key}</span>
              </motion.div>
            );
          })}

          {/* Create Music Link */}
          <Link href="/create" style={{ textDecoration: 'none' }}>
            <motion.div
              className="dash-nav-item dash-create-music-btn"
              whileTap={{ scale: 0.97 }}
              whileHover={{ scale: 1.02 }}
            >
              <Music className="dash-nav-icon" style={{ color: 'var(--accent)' }} />
              <span>Create Music</span>
              <span className="dash-create-badge">NEW</span>
            </motion.div>
          </Link>

          <div
            className={`dash-nav-item${playlistsOpen ? " expanded" : ""}`}
            onClick={() => setPlaylistsOpen((v) => !v)}
          >
            <Heart className="dash-nav-icon" style={{ fill: playlistsOpen ? "currentColor" : "none" }} />
            <span>Liked Songs</span>
            <ChevronDown className="dash-nav-caret" size={16} />
          </div>

          <AnimatePresence initial={false}>
            {playlistsOpen && (
              <motion.div
                className="dash-sub"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
              >
                {Array.from(likedSongs).map((songId) => {
                  const song = allTracks.find(t => t.id === songId);
                  if (!song) return null;
                  return (
                    <div key={song.id} className="dash-sub-item" onClick={() => { setCurrentSong(song); setPlaying(true); }} style={{ cursor: 'pointer' }}>
                      <img src={song.img} alt="" className="dash-sub-img" />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</span>
                    </div>
                  );
                })}
                {likedSongs.size === 0 && (
                  <div className="dash-sub-item" style={{ color: "rgba(255,255,255,0.5)", pointerEvents: "none" }}>
                    <span>No liked songs yet</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </nav>

        <div className="dash-logout" onClick={() => signOut(auth)} style={{ cursor: "pointer" }}>
          <div className="dash-nav-item">
            <LogOut className="dash-nav-icon" />
            <span>Logout</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="dash-main">
        {/* Topbar */}
        <motion.div
          className="dash-topbar"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="dash-search" style={{ position: 'relative' }}>
            <Search size={16} color="rgba(255,255,255,0.5)" />
            <input
              placeholder="Search for a song"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery.trim() && searchResults.length > 0 && (
              <div className="dash-search-dropdown">
                {searchResults.slice(0, 8).map(s => (
                  <div
                    key={s.id}
                    className="dash-search-item"
                    onClick={() => {
                      setCurrentSong(s);
                      setPlaying(true);
                      setProgress(0);
                      setSearchQuery("");
                    }}
                  >
                    <img src={s.img} alt={s.title} />
                    <div className="dash-search-item-info">
                      <div className="dash-search-item-title">{s.title}</div>
                      <div className="dash-search-item-artist">{s.artist}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="dash-topbar-spacer" />
          <div className="dash-user">
            <div className="dash-avatar">
              <img src={user?.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100"} alt="User" className="dash-avatar-img" />
            </div>
            <div className="dash-user-name">{user?.displayName || "Guest"}</div>
          </div>
        </motion.div>

        {active === "Home" && !popupGenre && !popupArtist && (
          <>
            {/* Spotify Style Hero Grid */}
            <div className="dash-content">
              <h1 className="dash-greeting">
                {new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening"}
              </h1>
              {mounted && randomHeroSlides.length > 0 && (
                <div className="dash-hero-grid">
                  {randomHeroSlides.slice(0, 6).map((track, i) => (
                    <div
                      key={`hero-${track.id}-${i}`}
                      className="dash-hero-card"
                      onClick={() => {
                        setCurrentSong(track);
                        setPlaying(true);
                        setIsExpanded(true);
                      }}
                    >
                      <img src={track.img} alt={track.title} className="dash-hero-img" />
                      <div className="dash-hero-title">{track.title}</div>
                      <button
                        className="dash-hero-play"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (currentSong.id === track.id) {
                            setPlaying((prev) => !prev);
                          } else {
                            setCurrentSong(track);
                            setPlaying(true);
                          }
                        }}
                      >
                        {currentSong.id === track.id && playing ? (
                          <Pause size={24} fill="currentColor" />
                        ) : (
                          <Play size={24} fill="currentColor" style={{ marginLeft: 4 }} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>


            {/* Categories / Select Language */}
            <div>
              <div className="dash-section-head">
                <div className="dash-section-title">Select Language</div>
                <div className="dash-section-nav">
                  <button className="dash-more-btn">More</button>
                </div>
              </div>
              <div className="dash-cats">
                {categories.map((c) => (
                  <motion.div
                    key={c}
                    className={`dash-cat${cat === c ? " active" : ""}`}
                    onClick={() => setCat(c)}
                    whileTap={{ scale: 0.95 }}
                    layout
                  >
                    {c}
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Popular songs */}
            <div>
              <div className="dash-section-head">
                <div className="dash-section-title">Popular songs</div>
                <div className="dash-section-nav">
                  <button className="dash-more-btn">More</button>
                </div>
              </div>
              <div className="dash-songs">
                {languageFilteredSongs.map((song, i) => renderSongCard(song, i))}
              </div>
            </div>

            {/* Popular Artists */}
            <div style={{ marginTop: 12 }}>
              <div className="dash-section-head">
                <div className="dash-section-title">Popular Artists</div>
                <div className="dash-section-nav">
                  <button className="dash-more-btn">More</button>
                </div>
              </div>
              {mounted && popularArtists.length > 0 && (
                <div className="dash-playlists artists-grid">
                  {popularArtists.map((artist, i) => (
                    <div
                      key={artist.name}
                      className="dash-artist-card"
                      onClick={() => setPopupArtist(artist.name)}
                    >
                      <div className="dash-artist-img" style={{ backgroundImage: `url(${artist.img})` }} />
                      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                        <div className="dash-artist-name">{artist.name}</div>
                        <div className="dash-artist-label">Artist</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {active === "Categories" && !popupGenre && !popupArtist && (
          <div style={{ padding: "0 24px 24px" }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: "white" }}>Categories</h2>
            <div className="dash-playlists">
              {allGenres.slice(0, 10).map((genre) => {
                const genreSongs = allTracks.filter((t) => t.genres?.includes(genre));
                if (genreSongs.length === 0) return null;
                return (
                  <div key={genre} style={{ marginBottom: 32 }}>
                    <div className="dash-section-head">
                      <div className="dash-section-title" style={{ textTransform: "capitalize" }}>{genre}</div>
                      <div className="dash-section-nav">
                        <button className="dash-more-btn" style={{ color: "#1db954" }} onClick={() => setPopupGenre(genre)}>..more</button>
                      </div>
                    </div>
                    <div className="dash-songs">
                      {genreSongs.slice(0, 6).map((song, i) => renderSongCard(song, i))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {popupGenre && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{ padding: "0 24px 24px", paddingTop: 24 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <button
                  onClick={() => setPopupGenre(null)}
                  style={{
                    background: "rgba(255,255,255,0.1)", border: "none", color: "white",
                    width: 40, height: 40, borderRadius: "50%",
                    display: "flex", justifyContent: "center", alignItems: "center",
                    cursor: "pointer", transition: "var(--transition)"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.2)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                >
                  <ChevronLeft size={24} />
                </button>
                <h2 style={{ fontSize: 32, fontWeight: 800, textTransform: "capitalize", color: "white", margin: 0 }}>{popupGenre} Songs</h2>
              </div>
            </div>
            <div className="dash-section-title" style={{ marginTop: 24, marginBottom: 16 }}>Top {popupGenre} Tracks</div>
            <div className="dash-songs">
              {allTracks.filter(t => t.genres?.includes(popupGenre)).map((song, i) => renderSongCard(song, i))}
            </div>
          </motion.div>
        )}

        {active === "Artists" && !popupGenre && !popupArtist && (
          <div style={{ padding: "0 24px 24px" }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: "white" }}>Artists</h2>
            <div className="dash-playlists artists-grid">
              {allArtistsList.slice(0, 16).map((artist) => {
                const artistSongs = allTracks.filter((t) => t.artist === artist);
                if (artistSongs.length === 0) return null;
                return (
                  <div key={artist} style={{ marginBottom: 32 }}>
                    <div className="dash-section-head">
                      <div className="dash-section-title">{artist}</div>
                      <div className="dash-section-nav">
                        <button className="dash-more-btn" style={{ color: "#1db954" }} onClick={() => setPopupArtist(artist)}>..more</button>
                      </div>
                    </div>
                    <div className="dash-songs">
                      {artistSongs.slice(0, 6).map((song, i) => renderSongCard(song, i))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {popupArtist && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ width: "100%", height: "100%", overflowY: "auto", paddingBottom: 100 }}
          >
            {/* Spotify-like Artist Banner */}
            <div
              style={{
                height: 340,
                position: "relative",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                padding: "24px 32px",
                backgroundImage: `linear-gradient(transparent 0%, rgba(0,0,0,0.8) 100%), url(${allTracks.find(t => t.artist === popupArtist)?.img || ''})`,
                backgroundSize: "cover",
                backgroundPosition: "center 20%",
              }}
            >
              <button
                onClick={() => setPopupArtist(null)}
                style={{
                  position: "absolute", top: 24, left: 32,
                  background: "rgba(0,0,0,0.5)", border: "none", color: "white",
                  width: 32, height: 32, borderRadius: "50%",
                  display: "flex", justifyContent: "center", alignItems: "center",
                  cursor: "pointer", transition: "var(--transition)"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.8)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.5)"}
              >
                <ChevronLeft size={24} />
              </button>
              
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: "white" }}>
                <div style={{ background: "#3d91f4", borderRadius: "50%", padding: 2, display: "flex" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                </div>
                <span style={{ fontSize: 14, fontWeight: 500 }}>Verified Artist</span>
              </div>
              <h2 style={{ fontSize: "6rem", fontWeight: 900, color: "white", margin: 0, letterSpacing: "-0.04em", lineHeight: "1" }}>{popupArtist}</h2>
              <div style={{ marginTop: 16, color: "rgba(255,255,255,0.7)", fontSize: 16 }}>
                14,528,932 monthly listeners
              </div>
            </div>

            {/* Artist Controls */}
            <div style={{ padding: "24px 32px", display: "flex", alignItems: "center", gap: 32, background: "linear-gradient(rgba(0,0,0,0.6) 0%, var(--bg) 100%)" }}>
              <button 
                onClick={() => {
                  const firstSong = allTracks.find(t => t.artist === popupArtist);
                  if (firstSong) {
                    setCurrentSong(firstSong);
                    setPlaying(true);
                  }
                }}
                style={{ 
                  width: 56, height: 56, borderRadius: "50%", background: "#1db954", 
                  border: "none", display: "flex", justifyContent: "center", alignItems: "center", 
                  color: "black", cursor: "pointer", boxShadow: "0 8px 8px rgba(0,0,0,0.3)" 
                }}
              >
                <Play size={28} fill="currentColor" style={{ marginLeft: 4 }} />
              </button>
              <button style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.5)", borderRadius: 32, color: "white", padding: "6px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: 1, textTransform: "uppercase" }}>
                Follow
              </button>
              <button style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", display: "flex" }}>
                <MoreHorizontal size={32} />
              </button>
            </div>

            {/* Popular Tracks List */}
            <div style={{ padding: "0 32px" }}>
              <h3 style={{ fontSize: 24, fontWeight: 700, color: "white", marginBottom: 24 }}>Popular</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {allTracks.filter(t => t.artist === popupArtist).slice(0, 5).map((song, i) => (
                  <div 
                    key={song.id} 
                    onClick={() => {
                      setCurrentSong(song);
                      setPlaying(true);
                    }}
                    style={{ 
                      display: "flex", alignItems: "center", padding: "8px 16px", 
                      borderRadius: 4, cursor: "pointer", transition: "background 0.2s" 
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <div style={{ width: 32, textAlign: "right", marginRight: 16, color: "rgba(255,255,255,0.5)", fontSize: 16 }}>{i + 1}</div>
                    <img src={song.img} alt={song.title} style={{ width: 40, height: 40, borderRadius: 4, marginRight: 16 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ color: currentSong.id === song.id ? "#1db954" : "white", fontSize: 16, fontWeight: 500 }}>{song.title}</div>
                    </div>
                    <div style={{ width: 120, color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
                      {Math.floor(Math.random() * 900) + 100},{Math.floor(Math.random() * 900) + 100},{Math.floor(Math.random() * 900) + 100}
                    </div>
                    <div style={{ width: 48, textAlign: "right", color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
                      3:{(Math.floor(Math.random() * 40) + 10)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Discography Grid */}
            <div style={{ padding: "48px 32px 0 32px" }}>
              <h3 style={{ fontSize: 24, fontWeight: 700, color: "white", marginBottom: 24 }}>Discography</h3>
              <div className="dash-songs">
                {allTracks.filter(t => t.artist === popupArtist).map((song, i) => renderSongCard(song, i))}
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* Player */}
      <motion.div
        className="dash-player"
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.6 }}
      >
        <div className="dash-player-now" style={{ cursor: 'pointer' }} onClick={() => setIsExpanded(true)}>
          <div
            className="dash-player-cover"
            style={{ backgroundImage: `url(${currentSong.img})`, backgroundSize: "cover", backgroundPosition: "center", width: 56, height: 56, borderRadius: 8 }}
          />
          <div>
            <div className="dash-player-name">{currentSong.title}</div>
            <div className="dash-player-artist">{currentSong.artist}</div>
          </div>
          {playing && (
            <div className="eq" aria-hidden>
              <span /><span /><span /><span />
            </div>
          )}
        </div>

        <div className="dash-player-controls">
          <div className="dash-player-buttons">
            <button className="dash-player-btn" aria-label="shuffle" onClick={() => setIsShuffle(s => !s)} style={{ color: isShuffle ? 'var(--accent)' : 'inherit' }}><Shuffle size={16} /></button>
            <button className="dash-player-btn" aria-label="prev" onClick={handlePrev}><SkipBack size={18} /></button>
            <motion.button
              className="dash-player-main"
              whileTap={{ scale: 0.9 }}
              onClick={() => setPlaying((p) => !p)}
              aria-label="play"
            >
              {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
            </motion.button>
            <button className="dash-player-btn" aria-label="next" onClick={handleNext}><SkipForward size={18} /></button>
            <button className="dash-player-btn" aria-label="repeat" onClick={() => setIsRepeat(r => !r)} style={{ color: isRepeat ? 'var(--accent)' : 'inherit' }}><Repeat size={16} /></button>
            <button className="dash-player-btn" aria-label="ab-loop" onClick={handleToggleABLoop} style={{ color: isABLoop ? 'var(--accent)' : 'inherit', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '12px', fontWeight: 600 }}>
              -<Repeat size={14} />-
            </button>
            <motion.button
              className="dash-player-btn"
              onClick={() => toggleLike()}
              whileTap={{ scale: 0.8 }}
              animate={currentIsLiked ? { scale: [1, 1.2, 1], color: "#e1306c" } : { color: "rgba(255,255,255,0.7)" }}
              transition={{ duration: 0.3 }}
              aria-label="like"
            >
              <Heart size={16} fill={currentIsLiked ? 'currentColor' : 'none'} />
            </motion.button>
            <motion.button
              className="dash-player-btn"
              onClick={(e) => downloadTrack(e, currentSong)}
              whileTap={{ scale: 0.8 }}
              style={{ color: "rgba(255,255,255,0.7)" }}
              aria-label="download"
              title="Download Current Track"
            >
              <Download size={16} />
            </motion.button>
          </div>
          <div className="dash-player-progress">
            <span>{formatTimeReal(audioRef.current?.currentTime || 0)}</span>
            <div className="dash-player-bar" style={{ cursor: 'pointer', position: 'relative' }} onClick={handleProgressClick}>
              <div
                className="dash-player-fill"
                style={{ width: `${progress}%` }}
              >
                <div className="dash-player-thumb" />
              </div>
              {isABLoop && abLoopStart !== null && (
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${(abLoopStart / duration) * 100}%`, width: 2, background: 'var(--accent)' }} />
              )}
              {isABLoop && abLoopEnd !== null && (
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${(abLoopEnd / duration) * 100}%`, width: 2, background: 'var(--accent)' }} />
              )}
            </div>
            <span>{formatTimeReal(duration)}</span>
          </div>
        </div>

        <div className="dash-player-right">
          <button className="dash-player-btn" aria-label="shuffle" onClick={() => setIsShuffle(s => !s)} style={{ color: isShuffle ? 'var(--accent)' : 'inherit' }}><Shuffle size={16} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="dash-player-btn" aria-label="volume" onClick={() => setVolume(v => v === 0 ? 1 : 0)}>
              <Volume2 size={16} color={volume === 0 ? 'rgba(255,255,255,0.5)' : 'white'} />
            </button>
            <input
              type="range"
              min="0" max="1" step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              style={{
                width: 80,
                cursor: 'pointer',
                accentColor: '#1db954'
              }}
            />
          </div>
        </div>
      </motion.div>



      <PlayingOverlay
        track={currentSong}
        playing={playing}
        progress={progress}
        currentTime={audioRef.current?.currentTime || 0}
        duration={duration}
        lyrics={lyrics}
        isLoading={isLoadingAudio}
        isExpanded={isExpanded}
        onClose={() => setIsExpanded(false)}
        onTogglePlay={() => setPlaying(p => !p)}
        onNext={handleNext}
        onPrev={handlePrev}
        isShuffle={isShuffle}
        onToggleShuffle={() => setIsShuffle(s => !s)}
        isRepeat={isRepeat}
        onToggleRepeat={() => setIsRepeat(r => !r)}
        onSeek={(time) => {
          if (audioRef.current) {
            audioRef.current.currentTime = time;
            setProgress((time / duration) * 100);
            setPlaying(true);
          }
        }}
        isLiked={currentIsLiked}
        onToggleLike={() => toggleLike()}
        isABLoop={isABLoop}
        onToggleABLoop={handleToggleABLoop}
        abLoopStart={abLoopStart}
        abLoopEnd={abLoopEnd}
        onProgressClick={handleProgressClick}
        onDownload={(e: any) => downloadTrack(e, currentSong)}
        alternatives={alternatives}
        onAlternativeSelect={handleAlternativeSelect}
      />
    </div>
  );
}

function formatTimeReal(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}