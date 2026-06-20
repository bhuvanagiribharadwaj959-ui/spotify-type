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
    unique.sort((a, b) => {
      const isBadA = !a.img || a.img.includes('default_cover_image') || a.img.includes('24596bcd24eb0adab57edfd0fa06a5d5');
      const isBadB = !b.img || b.img.includes('default_cover_image') || b.img.includes('24596bcd24eb0adab57edfd0fa06a5d5');
      if (isBadA && !isBadB) return 1;
      if (!isBadA && isBadB) return -1;
      return 0;
    });
    return unique;
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
      if (currentSong.audioUrl && audioRef.current) {
        if (currentSong.audioUrl.includes('supabase.co')) {
          audioRef.current.src = encodeURI(currentSong.audioUrl);
        } else {
          audioRef.current.src = `/api/audio-proxy?url=${encodeURIComponent(currentSong.audioUrl)}`;
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
          <img src="https://zgcbpjrvzmocydnlpexx.supabase.co/storage/v1/object/public/songs/logo.png" alt="Sonic" style={{ width: '36px', height: '36px', borderRadius: '8px' }} />
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