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
  Clock,
  Library as LibraryIcon,
  Grid,
  MoreVertical,
  MoreHorizontal,
  Pin,
  Globe,
  MessageCircle,
  X,
  Radio,
  Disc3,
  ExternalLink,
  Copy,
  Ban,
  Info,
  Gift,
  PartyPopper,
  Volume1,
  VolumeX,
  Timer,
  Waves,
  Mic,
  User as UserIcon
} from "lucide-react";
import "./dashboard.css";
import Link from "next/link";
import PlayingOverlay from "./playing";
import { onAuthStateChanged, User, signOut, sendPasswordResetEmail, updateProfile } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth, db } from "../lib/firebase";
import { collection, doc, setDoc, getDoc, updateDoc, increment, addDoc, deleteDoc, query, where, getDocs } from "firebase/firestore";

type DashboardTrack = {
  id: string;
  img: string;
  title: string;
  artist: string;
  album?: string;
  language?: string;
  genres?: string[];
  audioUrl?: string;
  lyrics?: string;
  permaUrl?: string;
  artistPic?: string;
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
  const cleanImgUrl = (url?: string) => {
    if (!url) return "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=300&h=300";
    let clean = url;
    clean = clean.replace(/\/\d+x\d+bb\.jpg$/, '/600x600bb.jpg');
    clean = clean.replace(/\/\d+x\d+\.jpg$/, '/600x600.jpg');
    clean = clean.replace("150x150", "500x500").replace("50x50", "500x500");
    return clean;
  };

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
  const [searchResults, setSearchResults] = useState<DashboardTrack[]>([]);
  const [dbSongs, setDbSongs] = useState<DashboardTrack[]>([]);
  const [randomPicks, setRandomPicks] = useState<DashboardTrack[]>([]);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [likedSongs, setLikedSongs] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(false);
  const [isABLoop, setIsABLoop] = useState(false);
  const [abLoopStart, setAbLoopStart] = useState<number | null>(null);
  const [abLoopEnd, setAbLoopEnd] = useState<number | null>(null);
  const [popupGenre, setPopupGenre] = useState<string | null>(null);
  const [popupArtist, setPopupArtist] = useState<string | null>(null);
  const [popupAlbum, setPopupAlbum] = useState<DashboardTrack | null>(null);
  const [volume, setVolume] = useState(1);
  const [subActive, setSubActive] = useState("Home");
  const [recentTracks, setRecentTracks] = useState<DashboardTrack[]>([]);
  const [showQueue, setShowQueue] = useState(false);
  const [queue, setQueue] = useState<DashboardTrack[]>([]);
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [searchOverlayQuery, setSearchOverlayQuery] = useState("");
  const [searchOverlayResults, setSearchOverlayResults] = useState<DashboardTrack[]>([]);
  const [searchTab, setSearchTab] = useState("Tracks");
  const [ctxMenu, setCtxMenu] = useState<{show: boolean, x: number, y: number, track: DashboardTrack | null}>({show: false, x: 0, y: 0, track: null});
  const [showPopularAll, setShowPopularAll] = useState(false);
  const [showUnreleased, setShowUnreleased] = useState(false);
  const [settingsState, setSettingsState] = useState({hiRes: true, privacy: true, scrobbling: false, notifications: true, autoplay: true, crossfade: false});

  const matchArtist = (trackArtist: string, targetArtist: string | null): boolean => {
    if (!targetArtist) return false;
    const a = trackArtist.toLowerCase();
    const b = targetArtist.toLowerCase();
    return a.includes(b) || b.includes(a);
  };

  const [profileName, setProfileName] = useState("");
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState("");

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setCustomAvatar(base64String);
        localStorage.setItem("sonic_user_avatar", base64String);
        setProfileMessage("Avatar updated successfully!");
        
        if (user) {
          updateProfile(user, { photoURL: base64String })
            .then(() => console.log("Firebase profile image updated"))
            .catch(err => console.error("Firebase profile image update failed", err));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage("");
    try {
      if (user) {
        await updateProfile(user, { displayName: profileName });
      }
      localStorage.setItem("sonic_display_name", profileName);
      setProfileMessage("Profile updated successfully!");
    } catch (err: any) {
      setProfileMessage(`Error updating profile: ${err.message}`);
    }
  };

  const handleResetPassword = async () => {
    setProfileMessage("");
    if (!user || !user.email) {
      setProfileMessage("Cannot reset password for guest accounts.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, user.email);
      setProfileMessage("Password reset email sent!");
    } catch (err: any) {
      setProfileMessage(`Error sending reset email: ${err.message}`);
    }
  };

  const renderAvatar = (size: number) => {
    if (customAvatar) {
      return (
        <img
          src={customAvatar}
          alt="User"
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
        />
      );
    }
    if (user?.photoURL && !user.photoURL.includes("unsplash.com/photo-1535713875002-d1d0cf377fde")) {
      return (
        <img
          src={user.photoURL}
          alt="User"
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
        />
      );
    }
    return (
      <div style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#282828',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0
      }}>
        <UserIcon size={size * 0.6} color="rgba(255,255,255,0.6)" />
      </div>
    );
  };


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
    const savedName = localStorage.getItem("sonic_display_name");
    if (savedName) {
      setProfileName(savedName);
    } else if (user) {
      setProfileName(user.displayName || user.email?.split("@")[0] || "User");
    } else {
      setProfileName("Guest");
    }
    const savedAvatar = localStorage.getItem("sonic_user_avatar");
    if (savedAvatar) {
      setCustomAvatar(savedAvatar);
    }
  }, [user]);

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
            const isDev = process.env.NODE_ENV === 'development';
            const baseUrl = isDev ? 'http://127.0.0.1:9999' : 'https://test-0k.onrender.com';
            let trendingList: any[] = [];
            
            try {
              const res = await fetch(`${baseUrl}/trending/?country=us&limit=100`);
              if (res.ok) {
                const data = await res.json();
                if (data.data && data.data.trending) {
                  trendingList = data.data.trending;
                }
              }
            } catch (err) {
              if (isDev) {
                try {
                  const res = await fetch(`https://test-0k.onrender.com/trending/?country=us&limit=100`);
                  if (res.ok) {
                    const data = await res.json();
                    if (data.data && data.data.trending) {
                      trendingList = data.data.trending;
                    }
                  }
                } catch (e) {}
              }
            }

            // using outer cleanImgUrl

            const fetched: DashboardTrack[] = [];
            const seenTitles = new Set<string>();

             // Map trending songs first
             trendingList.forEach((item: any) => {
               const titleLower = (item.title || "").toLowerCase();
               if (titleLower) seenTitles.add(titleLower);
               fetched.push({
                 id: item.song_id || item.id || Math.random().toString(36).substring(7),
                 title: item.title || "Unknown Title",
                 artist: item.artist || "Unknown Artist",
                 img: cleanImgUrl(item.thumbnail),
                 language: "english",
                 genres: item.genre ? [item.genre] : [],
                 audioUrl: undefined,
                 lyrics: undefined,
                 permaUrl: item.perma_url || item.url || item.link
               });
             });
 
             // Map local attractive/popular songs from songs.json
             try {
               const jsonRes = await fetch('/songs.json');
               if (jsonRes.ok) {
                 const localData = await jsonRes.json();
                 localData.forEach((item: any) => {
                   const titleLower = (item.meta?.title || "").toLowerCase();
                   if (!seenTitles.has(titleLower)) {
                     seenTitles.add(titleLower);
                     fetched.push({
                       id: item.id,
                       title: item.meta?.title || "Unknown Title",
                       artist: item.meta?.artist || "Unknown Artist",
                       img: cleanImgUrl(item.meta?.cover_url || item.assets?.cover_url),
                       language: item.meta?.language || "english",
                       genres: [item.meta?.category, ...(item.meta?.mood || [])].filter(Boolean),
                       audioUrl: item.supabase?.audio_storage_url || undefined,
                       lyrics: item.assets?.lyrics || undefined
                     });
                   }
                 });
               }
             } catch (err) {
               console.error("Local songs load error:", err);
             }

            // Keep the firebase fetch just in case there are custom songs uploaded by the user
            try {
              const q = query(collection(db, "songs"));
              const snapshot = await getDocs(q);
              snapshot.forEach(docSnap => {
                const docData = docSnap.data();
                if (docData.is_public && !fetched.find(f => f.id === docSnap.id)) {
                  fetched.push({
                    id: docSnap.id,
                    img: cleanImgUrl(docData.img),
                    title: docData.title || "Unknown Title",
                    artist: docData.artist || "Unknown Artist",
                    language: docData.language,
                    genres: docData.genres || [],
                  });
                }
              });
            } catch (err) {}
            fetched.sort((a, b) => {
              const aEng = (a.language || "").toLowerCase() === "english";
              const bEng = (b.language || "").toLowerCase() === "english";
              if (aEng && !bEng) return -1;
              if (!aEng && bEng) return 1;
              return 0;
            });

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
    try {
      const saved = localStorage.getItem("recent_tracks");
      if (saved) {
        setRecentTracks(JSON.parse(saved));
      }
    } catch (e) {}

    // Remove randomness, just take top 16 tracks to reduce load
    const staticSlides = dbSongs.slice(0, 16);
    setRandomHeroSlides(staticSlides);

    // Initial random picks for discovery section
    const shuffled = [...dbSongs].sort(() => 0.5 - Math.random());
    setRandomPicks(shuffled.slice(0, 12));

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
    if (!cat) return allTracks;
    const catLower = cat.toLowerCase();
    
    // Check if the cat is a language
    const languages = ["english", "hindi", "punjabi", "tamil", "telugu", "marathi", "kannada", "bhojpuri", "gujarati", "bengali", "urdu", "spanish", "korean"];
    if (languages.includes(catLower)) {
      const filtered = allTracks.filter(s => s.language?.toLowerCase() === catLower);
      return filtered.length > 0 ? filtered : allTracks;
    }
    
    // If not a language, filter by genre!
    const filteredByGenre = allTracks.filter(s => {
      if (!s.genres || s.genres.length === 0) return false;
      const filterParts = catLower.split(/[\s/&,-]+/).filter(Boolean);
      return s.genres.some(g => {
        const gLower = g.toLowerCase();
        return filterParts.some(part => gLower.includes(part));
      });
    });
    return filteredByGenre.length > 0 ? filteredByGenre : allTracks;
  }, [cat, allTracks]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const isDev = process.env.NODE_ENV === 'development';
        const baseUrl = isDev ? 'http://127.0.0.1:9999' : 'https://test-0k.onrender.com';
        const res = await fetch(`${baseUrl}/api/jiosaavn/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "success" && data.results) {
             const parsedResults = data.results.map((r: any) => {
               return {
                 id: r.id || Math.random().toString(36).substring(7),
                 title: r.title || "Unknown Title",
                 artist: r.artist || "Unknown Artist",
                 img: cleanImgUrl(r.thumbnail),
                 language: r.language || "english",
                 permaUrl: r.perma_url || r.url || r.link
               };
             });
            setSearchResults(parsedResults);
          }
        }
      } catch (err) {
        console.error("Open source search failed:", err);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
    let active = true;
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
          body: JSON.stringify({
            id: currentSong.id,
            title: currentSong.title,
            artist: currentSong.artist,
            permaUrl: currentSong.permaUrl,
            language: currentSong.language
          })
        });

        if (!active) return;

        if (!res.ok) {
          const errData = await res.json();
          if (active) {
            setLyrics(`Failed to load song. Error: ${errData.details || errData.error || 'Unknown error'}`);
          }
          return;
        }

        const data = await res.json();
        if (!active) return;

        if (data.alternatives) {
          setAlternatives(data.alternatives);
        } else {
          setAlternatives([]);
        }

        if (data.coverUrl || data.artistPic) {
          setCurrentSong(prev => {
            if (!prev || prev.id !== currentSong.id) return prev;
            return {
              ...prev,
              img: data.coverUrl || prev.img,
              artistPic: data.artistPic || prev.artistPic
            };
          });
        }

        // Only use the fetched audio URL if we didn't already play the pre-calculated one
        if (!hasPlayedStatic && data.audioUrl && audioRef.current) {
          audioRef.current.src = data.audioUrl;
          if (playingRef.current) {
            playAudio();
          }
        } else if (!hasPlayedStatic && data.error) {
          console.warn("Audio fetching failed:", data.error);
          if (active) {
            setLyrics(`Audio Extraction Failed: ${data.error}\n\n${data.lyrics || ''}`);
          }
          return;
        }

        if (active) {
          setLyrics(data.lyrics || "No lyrics found");
        }
      } catch (e: any) {
        console.error("Error fetching song", e);
        if (active) {
          setLyrics(`Network error: ${e.message}`);
        }
      } finally {
        if (active) {
          setIsLoadingAudio(false);
        }
      }
    };

    if (currentSong && currentSong.id && currentSong.id !== "dummy") {
      fetchSongData();
    }

    return () => {
      active = false;
    };
  }, [currentSong.id]);

  useEffect(() => {
    if (currentSong && currentSong.id !== "dummy") {
      setRecentTracks(prev => {
        const filtered = prev.filter(t => t.id !== currentSong.id);
        const updated = [currentSong, ...filtered].slice(0, 30);
        localStorage.setItem("recent_tracks", JSON.stringify(updated));
        return updated;
      });
    }
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
        body: JSON.stringify({ id: song.id, title: song.title, artist: song.artist, permaUrl: song.permaUrl })
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
      onContextMenu={(e) => handleContextMenu(e, song)}
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
              setIsExpanded(true);
            } else {
              setCurrentSong(song);
              setPlaying(true);
              setIsExpanded(true);
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
        setPopupAlbum(null);
        setShowSearchOverlay(false);
        setCtxMenu(prev => ({...prev, show: false}));
        setShowQueue(false);
      }
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setShowSearchOverlay(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [popupGenre, popupArtist, popupAlbum]);

  const handleContextMenu = (e: React.MouseEvent, track: DashboardTrack) => {
    e.preventDefault();
    setCtxMenu({show: true, x: Math.min(e.clientX, window.innerWidth - 240), y: Math.min(e.clientY, window.innerHeight - 400), track});
  };

  const addToQueue = (track: DashboardTrack) => {
    setQueue(prev => [...prev, track]);
  };

  const removeFromQueue = (idx: number) => {
    setQueue(prev => prev.filter((_, i) => i !== idx));
  };

  const playNext = (track: DashboardTrack) => {
    setQueue(prev => [track, ...prev]);
  };

  useEffect(() => {
    if (!searchOverlayQuery.trim()) { setSearchOverlayResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const isDev = process.env.NODE_ENV === 'development';
        const baseUrl = isDev ? 'http://127.0.0.1:9999' : 'https://test-0k.onrender.com';
        const res = await fetch(`${baseUrl}/api/jiosaavn/search?q=${encodeURIComponent(searchOverlayQuery)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "success" && data.results) {
            setSearchOverlayResults(data.results.map((r: any) => ({
              id: r.id || Math.random().toString(36).substring(7),
              title: r.title || "Unknown",
              artist: r.artist || "Unknown",
              img: cleanImgUrl(r.thumbnail),
              language: r.language || "english",
              permaUrl: r.perma_url || r.url || r.link
            })));
          }
        }
      } catch (err) { console.error("Search overlay error:", err); }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchOverlayQuery]);

  const navItems = [
    { key: "Home", icon: Home },
    { key: "Library", icon: LibraryIcon },
    { key: "Recent", icon: Clock },
    { key: "Unreleased", icon: Disc3 },
    { key: "Donate", icon: Gift },
    { key: "Settings", icon: Settings },
  ];

  if (!authLoaded || !user) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: '#090909',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        zIndex: 9999
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: 44,
            height: 44,
            background: 'white',
            borderRadius: '10px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: '0 4px 20px rgba(255,255,255,0.15)'
          }}>
            <Waves size={26} color="black" />
          </div>
          <span style={{ fontSize: 26, fontWeight: 900, color: 'white', letterSpacing: '-0.75px' }}>SONIC</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', marginTop: '40px' }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <motion.path d="M2 6c.6 0 1.2-.2 1.7-.6C4.8 4.3 6.3 4.3 7.4 5.4c.5.4 1.1.6 1.7.6s1.2-.2 1.7-.6C11.9 4.3 13.4 4.3 14.5 5.4c.5.4 1.1.6 1.7.6s1.2-.2 1.7-.6C19.1 4.3 20.6 4.3 21.7 5.4c.5.4 1.2.6 1.7.6" animate={{ x: [-3, 3, -3] }} transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut" }} />
            <motion.path d="M2 12c.6 0 1.2-.2 1.7-.6C4.8 10.3 6.3 10.3 7.4 11.4c.5.4 1.1.6 1.7.6s1.2-.2 1.7-.6C11.9 10.3 13.4 10.3 14.5 11.4c.5.4 1.1.6 1.7.6s1.2-.2 1.7-.6C19.1 10.3 20.6 10.3 21.7 11.4c.5.4 1.2.6 1.7.6" animate={{ x: [3, -3, 3] }} transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut" }} />
            <motion.path d="M2 18c.6 0 1.2-.2 1.7-.6C4.8 16.3 6.3 16.3 7.4 17.4c.5.4 1.1.6 1.7.6s1.2-.2 1.7-.6C11.9 16.3 13.4 16.3 14.5 17.4c.5.4 1.1.6 1.7.6s1.2-.2 1.7-.6C19.1 16.3 20.6 16.3 21.7 17.4c.5.4 1.2.6 1.7.6" animate={{ x: [-3, 3, -3] }} transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut" }} />
          </svg>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', fontWeight: 500, letterSpacing: '2px' }}>LOADING</div>
        </div>
      </div>
    );
  }

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
          <div style={{ width: 32, height: 32, background: 'white', borderRadius: 4, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Waves size={20} color="black" />
          </div>
          <div className="dash-logo-text" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px' }}>
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

        <div className="dash-sidebar-sep" />
        <div className="dash-pinned-links">
          <div className="dash-pinned-link" onClick={() => setActive("About")}>
            <Info size={16} /> About
          </div>
          <a className="dash-pinned-link" href="https://discord.gg/monochrome" target="_blank" rel="noreferrer">
            <MessageCircle size={16} /> Discord
          </a>
          <div className="dash-pinned-link" onClick={() => setActive("Home")}>
            <PartyPopper size={16} /> Parties
          </div>
          <a className="dash-pinned-link" href="https://github.com/monochrome-music/monochrome" target="_blank" rel="noreferrer">
            <ExternalLink size={16} /> GitHub
          </a>
        </div>

        <div className="dash-user-profile" onClick={() => { setActive("Profile"); setPopupAlbum(null); setPopupArtist(null); setPopupGenre(null); }} style={{ cursor: 'pointer' }}>
          {renderAvatar(36)}
          <div>
            <div className="dash-user-display">{profileName || "Guest"}</div>
            <div className="dash-user-handle">@{user?.email?.split("@")[0] || "user"}</div>
          </div>
        </div>

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
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 4
                }}
              >
                <X size={16} />
              </button>
            )}
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
                    <img src={s.img} alt={s.title} style={{ objectFit: 'cover', width: 40, height: 40, borderRadius: 4, flexShrink: 0 }} />
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
          <div className="dash-user" onClick={() => { setActive("Profile"); setPopupAlbum(null); setPopupArtist(null); setPopupGenre(null); }} style={{ cursor: 'pointer' }}>
            <div className="dash-avatar">
              {renderAvatar(28)}
            </div>
            <div className="dash-user-name">{profileName || "Guest"}</div>
          </div>
        </motion.div>

        {active === "Home" && !popupGenre && !popupArtist && !popupAlbum && (
          <>
            {/* Subnav Tabs */}
            <div className="dash-subnav">
              {["Home", "Hot & New", "Editor's Picks", "AOTY"].map((tab) => (
                <div
                  key={tab}
                  className={`dash-subnav-tab ${subActive === tab ? 'active' : ''}`}
                  onClick={() => setSubActive(tab)}
                >
                  {tab}
                </div>
              ))}
            </div>

            {/* Subnav Views Content */}
            <div className="dash-content" style={{ paddingTop: 0 }}>
              {subActive === "Home" && (
                <>
                  {/* Creative Animated Hero Banner */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '40px',
                    marginBottom: '40px',
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, rgba(29,185,84,0.1) 0%, rgba(0,0,0,0) 100%)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <motion.div 
                      style={{ position: 'absolute', top: -50, right: -50, width: 250, height: 250, background: 'var(--accent)', borderRadius: '50%', filter: 'blur(100px)', opacity: 0.2 }}
                      animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
                      transition={{ repeat: Infinity, duration: 4 }}
                    />
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <motion.path d="M2 6c.6 0 1.2-.2 1.7-.6C4.8 4.3 6.3 4.3 7.4 5.4c.5.4 1.1.6 1.7.6s1.2-.2 1.7-.6C11.9 4.3 13.4 4.3 14.5 5.4c.5.4 1.1.6 1.7.6s1.2-.2 1.7-.6C19.1 4.3 20.6 4.3 21.7 5.4c.5.4 1.2.6 1.7.6" animate={{ x: [-3, 3, -3] }} transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut" }} />
                          <motion.path d="M2 12c.6 0 1.2-.2 1.7-.6C4.8 10.3 6.3 10.3 7.4 11.4c.5.4 1.1.6 1.7.6s1.2-.2 1.7-.6C11.9 10.3 13.4 10.3 14.5 11.4c.5.4 1.1.6 1.7.6s1.2-.2 1.7-.6C19.1 10.3 20.6 10.3 21.7 11.4c.5.4 1.2.6 1.7.6" animate={{ x: [3, -3, 3] }} transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut" }} />
                          <motion.path d="M2 18c.6 0 1.2-.2 1.7-.6C4.8 16.3 6.3 16.3 7.4 17.4c.5.4 1.1.6 1.7.6s1.2-.2 1.7-.6C11.9 16.3 13.4 16.3 14.5 17.4c.5.4 1.1.6 1.7.6s1.2-.2 1.7-.6C19.1 16.3 20.6 16.3 21.7 17.4c.5.4 1.2.6 1.7.6" animate={{ x: [-3, 3, -3] }} transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut" }} />
                        </svg>
                        <h1 style={{ fontSize: '48px', fontWeight: 900, margin: 0, letterSpacing: '-2px', color: '#fff' }}>
                          SONIC
                        </h1>
                      </div>
                      <div style={{ fontSize: '18px', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                        Your personalized music experience
                      </div>
                    </div>

                    <div style={{ zIndex: 1, display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.05)', padding: '14px 28px', borderRadius: '30px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)' }} />
                      <span style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>Welcome back, {profileName}</span>
                    </div>
                  </div>

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
                                setIsExpanded(true);
                              } else {
                                setCurrentSong(track);
                                setPlaying(true);
                                setIsExpanded(true);
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

                  {/* Lucky Shuffles - Discover Random Songs Section */}
                  {mounted && randomPicks.length > 0 && (
                    <div style={{ marginTop: 32 }}>
                      <div className="dash-section-head">
                        <div className="dash-section-title">Discover Random Picks</div>
                        <div className="dash-section-nav">
                          <button 
                            className="dash-more-btn"
                            onClick={() => {
                              const shuffled = [...dbSongs].sort(() => 0.5 - Math.random());
                              setRandomPicks(shuffled.slice(0, 12));
                            }}
                            style={{
                              background: 'rgba(255,255,255,0.05)',
                              padding: '6px 16px',
                              borderRadius: '20px',
                              border: '1px solid rgba(255,255,255,0.1)',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            Shuffle Again
                          </button>
                        </div>
                      </div>
                      <div className="dash-songs">
                        {randomPicks.map((song, i) => renderSongCard(song, i))}
                      </div>
                    </div>
                  )}

                  {/* Hot Tracks */}
                  <div style={{ marginTop: 24 }}>
                    <div className="dash-section-head">
                      <div className="dash-section-title">Hot Tracks</div>
                      <div className="dash-section-nav">
                        <button className="dash-more-btn">More</button>
                      </div>
                    </div>
                    <div className="dash-songs">
                      {languageFilteredSongs.slice(0, 24).map((song, i) => renderSongCard(song, i))}
                    </div>
                  </div>

                  {/* Trending Albums */}
                  <div style={{ marginTop: 32 }}>
                    <div className="dash-section-head">
                      <div className="dash-section-title">Trending Albums</div>
                      <div className="dash-section-nav">
                        <button className="dash-more-btn">More</button>
                      </div>
                    </div>
                    <div className="dash-songs">
                      {languageFilteredSongs.slice(24, 48).map((song, i) => renderSongCard(song, i))}
                    </div>
                  </div>

                  {/* Featured Playlists */}
                  <div style={{ marginTop: 32 }}>
                    <div className="dash-section-head">
                      <div className="dash-section-title">Featured Playlists</div>
                      <div className="dash-section-nav">
                        <button className="dash-more-btn">More</button>
                      </div>
                    </div>
                    <div className="dash-songs">
                      {languageFilteredSongs.slice(48, 72).map((song, i) => renderSongCard(song, i))}
                    </div>
                  </div>

                  {/* The Hits */}
                  <div style={{ marginTop: 32 }}>
                    <div className="dash-section-head">
                      <div className="dash-section-title">The Hits</div>
                      <div className="dash-section-nav">
                        <button className="dash-more-btn">More</button>
                      </div>
                    </div>
                    <div className="dash-songs">
                      {languageFilteredSongs.slice(72, 100).map((song, i) => renderSongCard(song, i))}
                    </div>
                  </div>

                  {/* Recommended Artists */}
                  <div style={{ marginTop: 32 }}>
                    <div className="dash-section-head">
                      <div className="dash-section-title">Recommended Artists</div>
                      <div className="dash-section-nav">
                        <button className="dash-more-btn">See all</button>
                      </div>
                    </div>
                    <div className="shelf-scroll">
                      {popularArtists.slice(0, 6).map((artist, i) => (
                        <div key={`ra-${i}`} className="dash-artist-card" style={{minWidth: 180}} onClick={() => { setPopupArtist(artist.name); setPopupAlbum(null); }}>
                          <div className="dash-artist-img" style={{backgroundImage: `url(${artist.img})`, width: 120, height: 120}} />
                          <div className="dash-artist-name">{artist.name}</div>
                          <div className="dash-artist-label">Artist</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Jump Back In */}
                  {recentTracks.length > 0 && (
                    <div style={{ marginTop: 32 }}>
                      <div className="dash-section-head">
                        <div className="dash-section-title">Jump Back In</div>
                        <div className="dash-section-nav">
                          <button className="dash-more-btn">See all</button>
                        </div>
                      </div>
                      <div className="shelf-scroll">
                        {recentTracks.slice(0, 5).map((song, i) => (
                          <div key={`jb-${song.id}-${i}`} className="dash-song-card" style={{minWidth: 180}} onClick={() => { setCurrentSong(song); setPlaying(true); }}>
                            <div className="dash-song-cover-wrapper">
                              <div className="dash-song-img" style={{backgroundImage: `url(${song.img})`}} />
                            </div>
                            <div className="dash-song-meta">
                              <div className="dash-song-title">{song.title}</div>
                              <div className="dash-song-artist">{song.artist}</div>
                              <div className="resume-bar"><div className="resume-fill" style={{width: `${30 + Math.random() * 60}%`}} /></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Listening Parties */}
                  <div style={{ marginTop: 32, paddingBottom: 40 }}>
                    <div className="dash-section-head">
                      <div className="dash-section-title">Listening Parties</div>
                      <div className="dash-section-nav">
                        <button className="dash-more-btn">See all</button>
                      </div>
                    </div>
                    <div className="shelf-scroll">
                      {[
                        {name: "Chill Vibes Room", host: "DJ_Aurora", listeners: 234, color: "#1a1a2e"},
                        {name: "Late Night R&B", host: "SoulSeeker", listeners: 89, color: "#16213e"},
                        {name: "Indie Discovery", host: "VinylHunter", listeners: 156, color: "#1a1a2e"},
                      ].map((party, i) => (
                        <div key={`party-${i}`} className="party-card" style={{background: party.color}}>
                          <div className="party-live-badge"><div className="party-live-dot" /> LIVE</div>
                          <div style={{fontSize: 18, fontWeight: 700}}>{party.name}</div>
                          <div className="party-listeners">Hosted by {party.host} · {party.listeners} listening</div>
                          <button className="party-join">Join</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {subActive === "Hot & New" && (
                <>
                  {/* Genres Section */}
                  <div className="dash-genre-pills-container">
                    <h2 className="dash-genre-title">Genres</h2>
                    <div className="dash-genre-pills">
                      {["Hip-Hop", "R&B / Soul", "Blues", "Classical", "Country", "Dance & Electronic", "Folk / Americana", "Global", "Gospel / Christian", "Jazz", "K-Pop", "Kids", "Latin", "Metal", "Pop", "Reggae / Dancehall", "Legacy", "Rock / Indie"].map((genre) => (
                        <button
                          key={genre}
                          onClick={() => setCat(genre === "Pop" ? "english" : genre)}
                          className={`dash-genre-pill ${cat?.toLowerCase() === (genre === "Pop" ? "english" : genre.toLowerCase()) ? 'active' : ''}`}
                        >
                          {genre}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Trending Albums */}
                  <div style={{ marginBottom: 32 }}>
                    <h2 className="dash-genre-title">Trending Albums</h2>
                    <div className="dash-monochrome-grid">
                      {languageFilteredSongs.slice(0, 6).map((song, i) => (
                        <div key={`trending-album-${song.id}-${i}`} className="dash-album-card" onClick={() => setPopupAlbum(song)}>
                          <img src={song.img} alt={song.title} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 6, marginBottom: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }} />
                          <div className="dash-album-title">{song.title}</div>
                          <div className="dash-album-meta">
                            <span 
                              onClick={(e) => {
                                e.stopPropagation();
                                setPopupArtist(song.artist);
                                setPopupAlbum(null);
                                setPopupGenre(null);
                              }}
                              style={{ textDecoration: 'underline', cursor: 'pointer' }}
                            >
                              {song.artist}
                            </span> • {new Date().getFullYear()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* New Tracks */}
                  <div style={{ marginBottom: 32 }}>
                    <h2 className="dash-genre-title">New Tracks</h2>
                    <div className="dash-tracks-list">
                      {languageFilteredSongs.slice(6, 12).map((song, i) => (
                        <div
                          key={`new-track-${song.id}-${i}`}
                          className="dash-track-row"
                          onClick={() => { setCurrentSong(song); setPlaying(true); }}
                        >
                          <div className="dash-track-left">
                            <img src={song.img} alt={song.title} style={{ width: 48, height: 48, borderRadius: 4, marginRight: 16, flexShrink: 0, objectFit: 'cover' }} />
                            <div className="dash-track-details">
                              <div className="dash-track-title-row">
                                <span className="dash-track-title">{song.title}</span>
                                <span className="dash-track-badge">HD</span>
                              </div>
                              <div className="dash-track-meta">
                                <span 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPopupArtist(song.artist);
                                    setPopupAlbum(null);
                                    setPopupGenre(null);
                                  }}
                                  style={{ textDecoration: 'underline', cursor: 'pointer' }}
                                >
                                  {song.artist}
                                </span> • {new Date().getFullYear()}
                              </div>
                            </div>
                          </div>
                          <div className="dash-track-duration">3:24</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* New Albums */}
                  <div style={{ marginBottom: 32, paddingBottom: 40 }}>
                    <h2 className="dash-genre-title">New Albums</h2>
                    <div className="dash-monochrome-grid">
                      {languageFilteredSongs.slice(12, 18).map((song, i) => (
                        <div key={`new-album-${song.id}-${i}`} className="dash-album-card" onClick={() => setPopupAlbum(song)}>
                          <img src={song.img} alt={song.title} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 6, marginBottom: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }} />
                          <div className="dash-album-title">{song.title}</div>
                          <div className="dash-album-meta">
                            <span 
                              onClick={(e) => {
                                e.stopPropagation();
                                setPopupArtist(song.artist);
                                setPopupAlbum(null);
                                setPopupGenre(null);
                              }}
                              style={{ textDecoration: 'underline', cursor: 'pointer' }}
                            >
                              {song.artist}
                            </span> • {new Date().getFullYear()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {subActive === "Editor's Picks" && (
                <div style={{ paddingBottom: 40 }}>
                  <h2 className="dash-genre-title">Editor's Picks</h2>
                  <div className="dash-monochrome-grid">
                    {languageFilteredSongs.slice(18, 30).map((song, i) => (
                      <div key={`ep-${song.id}-${i}`} className="dash-album-card" onClick={() => setPopupAlbum(song)}>
                        <img src={song.img} alt={song.title} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 6, marginBottom: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }} />
                        <div className="dash-album-title">{song.title}</div>
                        <div className="dash-album-meta">
                          <span 
                            onClick={(e) => {
                              e.stopPropagation();
                              setPopupArtist(song.artist);
                              setPopupAlbum(null);
                              setPopupGenre(null);
                            }}
                            style={{ textDecoration: 'underline', cursor: 'pointer' }}
                          >
                            {song.artist}
                          </span> • {new Date().getFullYear()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {subActive === "AOTY" && (
                <div style={{ paddingBottom: 40 }}>
                  <h2 className="dash-genre-title">Album of the Year Nominees</h2>
                  <div className="dash-monochrome-grid">
                    {languageFilteredSongs.slice(30, 42).map((song, i) => (
                      <div key={`aoty-${song.id}-${i}`} className="dash-album-card" onClick={() => setPopupAlbum(song)}>
                        <img src={song.img} alt={song.title} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 6, marginBottom: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }} />
                        <div className="dash-album-title">{song.title}</div>
                        <div className="dash-album-meta">
                          <span 
                            onClick={(e) => {
                              e.stopPropagation();
                              setPopupArtist(song.artist);
                              setPopupAlbum(null);
                              setPopupGenre(null);
                            }}
                            style={{ textDecoration: 'underline', cursor: 'pointer' }}
                          >
                            {song.artist}
                          </span> • {new Date().getFullYear()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {active === "Categories" && !popupAlbum && !popupGenre && !popupArtist && (
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

        {active === "Library" && !popupGenre && !popupArtist && !popupAlbum && (
          <div style={{ padding: "0 24px 24px" }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: "white" }}>Your Library</h2>
            
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {/* Liked Songs Playlist Card */}
              <div 
                style={{
                  background: "linear-gradient(135deg, #450af5 0%, #c4efd9 100%)",
                  width: "100%",
                  maxWidth: 400,
                  height: 240,
                  borderRadius: 8,
                  padding: 24,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  position: "relative",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4)"
                }}
              >
                <div style={{ position: "absolute", top: 24, right: 24, background: "rgba(0,0,0,0.3)", borderRadius: "50%", padding: 12, display: "flex", justifyContent: "center", alignItems: "center" }}>
                  <Heart size={32} fill="white" color="white" />
                </div>
                <h3 style={{ fontSize: 32, fontWeight: 800, color: "white", margin: 0 }}>Liked Songs</h3>
                <div style={{ marginTop: 8, color: "white", fontSize: 16 }}>
                  {likedSongs.size} {likedSongs.size === 1 ? "song" : "songs"}
                </div>
              </div>
            </div>

            {/* Liked Songs Tracks List */}
            <div style={{ marginTop: 40 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: "white", marginBottom: 16 }}>Tracks</h3>
              {Array.from(likedSongs).length === 0 ? (
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>No liked songs yet. Click the heart icon on any song to add it!</div>
              ) : (
                <div className="dash-tracks-list">
                  {Array.from(likedSongs).map((songId, i) => {
                    const song = allTracks.find(t => t.id === songId);
                    if (!song) return null;
                    return (
                      <div
                        key={`liked-track-${song.id}-${i}`}
                        className="dash-track-row"
                        onClick={() => { setCurrentSong(song); setPlaying(true); }}
                      >
                        <div className="dash-track-left">
                          <div style={{ width: 48, height: 48, overflow: 'hidden', borderRadius: 4, marginRight: 16, flexShrink: 0 }}>
                            <div style={{ width: '100%', height: '100%', backgroundImage: `url(${song.img})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                          </div>
                          <div className="dash-track-details">
                            <div className="dash-track-title-row">
                              <span className="dash-track-title">{song.title}</span>
                            </div>
                            <div className="dash-track-meta">
                              <span 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPopupArtist(song.artist);
                                  setPopupAlbum(null);
                                  setPopupGenre(null);
                                }}
                                style={{ textDecoration: 'underline', cursor: 'pointer' }}
                              >
                                {song.artist}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLike(song.id);
                            }}
                            style={{ background: "transparent", border: "none", color: "#1db954", cursor: "pointer", display: "flex" }}
                          >
                            <Heart size={18} fill="#1db954" />
                          </button>
                          <div className="dash-track-duration">3:24</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {active === "Recent" && !popupGenre && !popupArtist && !popupAlbum && (
          <div style={{ padding: "0 24px 24px" }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: "white" }}>Recently Played</h2>
            {recentTracks.length === 0 ? (
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>No recently played songs yet. Go play some music!</div>
            ) : (
              <div className="dash-monochrome-grid">
                {recentTracks.map((song, i) => (
                  <div key={`recent-${song.id}-${i}`} className="dash-album-card" onClick={() => { setCurrentSong(song); setPlaying(true); }}>
                    <div className="dash-album-cover-wrapper" style={{ width: '100%', aspectRatio: '1/1', overflow: 'hidden', borderRadius: 6, marginBottom: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                      <div style={{ width: '100%', height: '100%', backgroundImage: `url(${song.img})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                    </div>
                    <div className="dash-album-title">{song.title}</div>
                    <div className="dash-album-meta">
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          setPopupArtist(song.artist);
                          setPopupAlbum(null);
                          setPopupGenre(null);
                        }}
                        style={{ textDecoration: 'underline', cursor: 'pointer' }}
                      >
                        {song.artist}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== Settings Page ===== */}
        {active === "Settings" && !popupGenre && !popupArtist && !popupAlbum && (
          <div style={{ padding: "0 32px 40px" }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 32 }}>Settings</h2>
            <div className="settings-section">
              <div className="settings-title">Audio</div>
              <div className="settings-item">
                <div><div className="settings-label">Hi-Res Audio</div><div className="settings-desc">Enable lossless FLAC streaming when available</div></div>
                <button className={`settings-toggle ${settingsState.hiRes ? 'on' : ''}`} onClick={() => setSettingsState(s => ({...s, hiRes: !s.hiRes}))} />
              </div>
              <div className="settings-item">
                <div><div className="settings-label">Autoplay</div><div className="settings-desc">Keep playing similar tracks when your queue ends</div></div>
                <button className={`settings-toggle ${settingsState.autoplay ? 'on' : ''}`} onClick={() => setSettingsState(s => ({...s, autoplay: !s.autoplay}))} />
              </div>
              <div className="settings-item">
                <div><div className="settings-label">Crossfade</div><div className="settings-desc">Smooth transition between tracks</div></div>
                <button className={`settings-toggle ${settingsState.crossfade ? 'on' : ''}`} onClick={() => setSettingsState(s => ({...s, crossfade: !s.crossfade}))} />
              </div>
            </div>
            <div className="settings-section">
              <div className="settings-title">Privacy</div>
              <div className="settings-item">
                <div><div className="settings-label">Private Session</div><div className="settings-desc">Your activity won&apos;t appear in listening history</div></div>
                <button className={`settings-toggle ${settingsState.privacy ? 'on' : ''}`} onClick={() => setSettingsState(s => ({...s, privacy: !s.privacy}))} />
              </div>
              <div className="settings-item">
                <div><div className="settings-label">Last.fm Scrobbling</div><div className="settings-desc">Share your listening activity with Last.fm</div></div>
                <button className={`settings-toggle ${settingsState.scrobbling ? 'on' : ''}`} onClick={() => setSettingsState(s => ({...s, scrobbling: !s.scrobbling}))} />
              </div>
              <div className="settings-item">
                <div><div className="settings-label">Notifications</div><div className="settings-desc">Get notified about new releases from artists you follow</div></div>
                <button className={`settings-toggle ${settingsState.notifications ? 'on' : ''}`} onClick={() => setSettingsState(s => ({...s, notifications: !s.notifications}))} />
              </div>
            </div>
          </div>
        )}

        {/* ===== Profile Page ===== */}
        {active === "Profile" && !popupGenre && !popupArtist && !popupAlbum && (
          <div style={{ padding: "0 32px 40px", maxWidth: 640 }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 32 }}>Profile Settings</h2>
            
            {profileMessage && (
              <div style={{
                backgroundColor: 'rgba(29, 185, 84, 0.1)',
                border: '1px solid rgba(29, 185, 84, 0.3)',
                color: '#1db954',
                padding: '12px 16px',
                borderRadius: '8px',
                marginBottom: '24px',
                fontSize: '14px'
              }}>
                {profileMessage}
              </div>
            )}

            <div className="settings-section">
              <div className="settings-title">Avatar Image</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '16px 0' }}>
                {renderAvatar(80)}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{
                    background: '#ffffff',
                    color: '#000000',
                    padding: '8px 16px',
                    borderRadius: '500px',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'inline-block',
                    textAlign: 'center',
                    transition: 'opacity 0.2s'
                  }}>
                    Upload New Image
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleAvatarUpload} 
                      style={{ display: 'none' }} 
                    />
                  </label>
                  {customAvatar && (
                    <button 
                      onClick={() => {
                        setCustomAvatar(null);
                        localStorage.removeItem("sonic_user_avatar");
                        setProfileMessage("Avatar reset to default.");
                        if (user) {
                          updateProfile(user, { photoURL: "" })
                            .catch(err => console.error("Failed to clear photoURL", err));
                        }
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#ffffff',
                        padding: '8px 16px',
                        borderRadius: '500px',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'var(--transition)'
                      }}
                    >
                      Remove Avatar
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-title">Profile Details</div>
              <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label htmlFor="profile-email-input" style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>Email Address</label>
                  <input
                    id="profile-email-input"
                    type="text"
                    value={user?.email || ""}
                    disabled
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.4)',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label htmlFor="profile-display-name-input" style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>Display Name</label>
                  <input
                    id="profile-display-name-input"
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#ffffff',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    background: '#1db954',
                    color: '#ffffff',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '500px',
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: 'pointer',
                    width: 'fit-content',
                    alignSelf: 'flex-start',
                    boxShadow: '0 4px 12px rgba(29, 185, 84, 0.3)',
                    transition: 'var(--transition)'
                  }}
                >
                  Save Changes
                </button>
              </form>
            </div>

            {user?.email && (
              <div className="settings-section" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '24px' }}>
                <div className="settings-title">Security</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 600 }}>Reset Password</div>
                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
                      Send a secure password reset link to your email ({user.email})
                    </div>
                  </div>
                  <button
                    onClick={handleResetPassword}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#ffffff',
                      padding: '8px 16px',
                      borderRadius: '500px',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'var(--transition)'
                    }}
                  >
                    Reset Password
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== Donate Page ===== */}
        {active === "Donate" && !popupGenre && !popupArtist && !popupAlbum && (
          <div style={{ padding: "0 32px 40px" }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 16 }}>Support SONIC</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.6, maxWidth: 600, marginBottom: 32 }}>
              If SONIC has been useful to you and you&apos;re able to, consider making a donation. It helps pay for the server and domain, and you get to support us :)
            </p>
            <a href="https://ko-fi.com/monochrometf" target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--accent)', color: '#000', padding: '12px 24px', borderRadius: 32, fontWeight: 700, fontSize: 16, textDecoration: 'none', marginBottom: 16 }}>
              <Gift size={20} /> Donate on Ko-fi
            </a>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 24 }}>
              If you cannot financially support us, please consider starring the project on GitHub and sharing with friends!
            </p>
            <a href="https://github.com/monochrome-music/monochrome" target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.1)', color: '#fff', padding: '10px 20px', borderRadius: 32, fontWeight: 600, fontSize: 14, textDecoration: 'none', marginTop: 12 }}>
              <ExternalLink size={18} /> Star on GitHub
            </a>
          </div>
        )}

        {/* ===== Unreleased Page ===== */}
        {active === "Unreleased" && !popupGenre && !popupArtist && !popupAlbum && (
          <div style={{ padding: "0 32px 40px" }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 16 }}>Unreleased</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>Leaked and unreleased tracks from your favorite artists. These may be removed at any time.</p>
            {!showUnreleased ? (
              <button onClick={() => setShowUnreleased(true)} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '12px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Load Unreleased Projects
              </button>
            ) : (
              <div className="dash-monochrome-grid">
                {languageFilteredSongs.slice(50, 62).map((song, i) => (
                  <div key={`unreleased-${song.id}-${i}`} className="dash-album-card" onClick={() => setPopupAlbum(song)} style={{ opacity: 0.7 }}>
                    <div style={{ width: '100%', aspectRatio: '1/1', overflow: 'hidden', borderRadius: 6, marginBottom: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', position: 'relative' }}>
                      <img src={song.img} alt={song.title} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.7)' }} />
                      <span style={{ position: 'absolute', top: 8, right: 8, background: '#e74c3c', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>UNRELEASED</span>
                    </div>
                    <div className="dash-album-title">{song.title}</div>
                    <div className="dash-album-meta">{song.artist}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== About Page ===== */}
        {active === "About" && !popupGenre && !popupArtist && !popupAlbum && (
          <div style={{ padding: "0 32px 40px", maxWidth: 700 }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 16 }}>About SONIC</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.8, marginBottom: 24 }}>
              SONIC is a lightweight, privacy-focused music streaming client designed for high-fidelity audio playback. Built with modern web technologies, it provides a clean, distraction-free listening experience.
            </p>
            <div style={{ background: '#181818', borderRadius: 8, padding: 24, marginBottom: 24 }}>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>Version</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>2.5.0</div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.8 }}>
              This is an independent client and is not affiliated with or endorsed by TIDAL or any music streaming service. This application does not host, store, or distribute any media files.
            </p>
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
                backgroundImage: `linear-gradient(transparent 0%, rgba(0,0,0,0.8) 100%), url(${allTracks.find(t => matchArtist(t.artist, popupArtist))?.img || ''})`,
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
                  const firstSong = allTracks.find(t => matchArtist(t.artist, popupArtist));
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
                {allTracks.filter(t => matchArtist(t.artist, popupArtist)).slice(0, showPopularAll ? 20 : 5).map((song, i) => (
                  <div 
                    key={song.id} 
                    onClick={() => {
                      setCurrentSong(song);
                      setPlaying(true);
                    }}
                    onContextMenu={(e) => handleContextMenu(e, song)}
                    style={{ 
                      display: "flex", alignItems: "center", padding: "8px 16px", 
                      borderRadius: 4, cursor: "pointer", transition: "background 0.2s" 
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <div style={{ width: 32, textAlign: "right", marginRight: 16, color: "rgba(255,255,255,0.5)", fontSize: 16 }}>{i + 1}</div>
                    <img src={song.img} alt={song.title} style={{ width: 40, height: 40, borderRadius: 4, marginRight: 16, objectFit: 'cover' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ color: currentSong.id === song.id ? "#1db954" : "white", fontSize: 16, fontWeight: 500 }}>{song.title}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <button onClick={(e) => { e.stopPropagation(); toggleLike(song.id); }} style={{ background: "transparent", border: "none", color: likedSongs.has(song.id) ? "#1db954" : "rgba(255,255,255,0.5)", cursor: "pointer", display: "flex" }}>
                        <Heart size={16} fill={likedSongs.has(song.id) ? "currentColor" : "none"} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleContextMenu(e, song); }} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", display: "flex" }}>
                        <MoreHorizontal size={16} />
                      </button>
                    </div>
                    <div style={{ width: 48, textAlign: "right", color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
                      3:{(Math.floor(Math.random() * 40) + 10)}
                    </div>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setShowPopularAll(prev => !prev)} 
                style={{ background: "transparent", border: "none", color: "var(--text-secondary)", fontSize: 14, fontWeight: 700, cursor: "pointer", padding: "12px 0", transition: "color 0.2s" }}
                onMouseEnter={(e) => e.currentTarget.style.color = "#fff"}
                onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-secondary)"}
              >
                {showPopularAll ? "Show less" : "Show more"}
              </button>
            </div>
            
            {/* Albums Section */}
            <div style={{ padding: "48px 32px 0 32px" }}>
              <h3 style={{ fontSize: 24, fontWeight: 700, color: "white", marginBottom: 24 }}>Albums</h3>
              <div className="dash-monochrome-grid">
                {allTracks.filter(t => matchArtist(t.artist, popupArtist)).map((song, i) => (
                  <div 
                    key={`artist-album-${song.id}-${i}`} 
                    className="dash-album-card" 
                    onClick={() => {
                      setPopupAlbum(song);
                      setPopupArtist(null);
                    }}
                  >
                    <div className="dash-album-cover-wrapper" style={{ width: '100%', aspectRatio: '1/1', overflow: 'hidden', borderRadius: 6, marginBottom: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                      <div style={{ width: '100%', height: '100%', backgroundImage: `url(${song.img})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                    </div>
                    <div className="dash-album-title">{song.title}</div>
                    <div className="dash-album-meta">{popupArtist} • Album</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {popupAlbum && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="dash-album-view"
          >
            {/* Back Button */}
            <div style={{ padding: "24px 32px 0 32px" }}>
              <button
                onClick={() => setPopupAlbum(null)}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "white",
                  padding: "6px 12px",
                  borderRadius: 4,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  transition: "var(--transition)"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
              >
                <ChevronLeft size={16} /> Back
              </button>
            </div>

            {/* Album Header */}
            <div className="dash-album-header">
              <img src={popupAlbum.img} alt={popupAlbum.title} className="dash-album-cover" style={{ objectFit: 'cover' }} />
              <div className="dash-album-info">
                <h2>{popupAlbum.title}</h2>
                <div className="dash-album-info-meta">
                  {new Date().getFullYear()} • 1 track
                </div>
                <div className="dash-album-info-copyright">
                  By <span 
                    onClick={(e) => {
                      e.stopPropagation();
                      setPopupArtist(popupAlbum.artist);
                      setPopupAlbum(null);
                    }}
                    style={{ fontWeight: 600, color: "white", cursor: "pointer", textDecoration: "underline" }}
                  >
                    {popupAlbum.artist}
                  </span> • (P) {new Date().getFullYear()} Records
                </div>
                
                {/* Controls */}
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 24 }}>
                  <button 
                    onClick={() => {
                      setCurrentSong(popupAlbum);
                      setPlaying(true);
                    }}
                    style={{ 
                      width: 56, height: 56, borderRadius: "50%", background: "#ffffff", 
                      border: "none", display: "flex", justifyContent: "center", alignItems: "center", 
                      color: "black", cursor: "pointer", boxShadow: "0 4px 12px rgba(255, 255, 255, 0.3)" 
                    }}
                  >
                    <Play size={28} fill="currentColor" style={{ marginLeft: 4 }} />
                  </button>
                  <button style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer" }}><Shuffle size={20} /></button>
                  <button style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer" }}><Download size={20} /></button>
                  <button style={{ background: "transparent", border: "none", color: "white", cursor: "pointer", fontSize: 28, padding: "0 8px" }}>+</button>
                  <button style={{ background: "transparent", border: "none", color: "white", cursor: "pointer", display: "flex" }}><Heart size={24} /></button>
                  <button style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer" }}><MoreVertical size={20} /></button>
                </div>
              </div>
            </div>

            {/* Tracklist */}
            <div style={{ padding: "0 32px" }}>
              <div style={{ display: "flex", padding: "0 16px 8px 16px", color: "rgba(255,255,255,0.5)", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid rgba(255,255,255,0.1)", marginBottom: 16 }}>
                <div style={{ width: 32, marginRight: 16 }}>#</div>
                <div style={{ flex: 1 }}>Title</div>
                <div style={{ width: 80, textAlign: "right", marginRight: 32 }}>Duration</div>
                <div style={{ width: 48 }}>Menu</div>
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {[popupAlbum].map((song, i) => (
                  <div 
                    key={song.id} 
                    onClick={() => {
                      setCurrentSong(song);
                      setPlaying(true);
                    }}
                    style={{ 
                      display: "flex", alignItems: "center", padding: "12px 16px", 
                      borderRadius: 4, cursor: "pointer", transition: "background 0.2s",
                      background: currentSong.id === song.id ? "rgba(255,255,255,0.08)" : "transparent"
                    }}
                    onMouseEnter={(e) => { if (currentSong.id !== song.id) e.currentTarget.style.background = "rgba(255,255,255,0.04)" }}
                    onMouseLeave={(e) => { if (currentSong.id !== song.id) e.currentTarget.style.background = "transparent" }}
                  >
                    <div style={{ width: 32, marginRight: 16, color: "rgba(255,255,255,0.5)", fontSize: 14 }}>1-{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: currentSong.id === song.id ? "#ffffff" : "white", fontSize: 16, fontWeight: currentSong.id === song.id ? 600 : 500 }}>{song.title}</div>
                      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>{song.artist}</div>
                    </div>
                    <div style={{ width: 80, textAlign: "right", marginRight: 32, color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
                      3:11
                    </div>
                    <div style={{ width: 48, display: "flex", justifyContent: "flex-end", color: "rgba(255,255,255,0.5)" }}>
                      <MoreVertical size={16} />
                    </div>
                  </div>
                ))}
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
        <div className="dash-player-now" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }}
            onClick={() => setIsExpanded(true)}
          >
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
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '8px' }}>
            <motion.button
              className="dash-player-btn"
              onClick={(e) => {
                e.stopPropagation();
                toggleLike();
              }}
              whileTap={{ scale: 0.8 }}
              animate={currentIsLiked ? { scale: [1, 1.2, 1], color: "#e1306c" } : { color: "rgba(255,255,255,0.7)" }}
              transition={{ duration: 0.3 }}
              aria-label="like"
              title={currentIsLiked ? "Unlike" : "Like"}
            >
              <Heart size={16} fill={currentIsLiked ? 'currentColor' : 'none'} />
            </motion.button>
            <motion.button
              className="dash-player-btn"
              onClick={(e) => {
                e.stopPropagation();
                downloadTrack(e, currentSong);
              }}
              whileTap={{ scale: 0.8 }}
              style={{ color: "rgba(255,255,255,0.7)" }}
              aria-label="download"
              title="Download Current Track"
            >
              <Download size={16} />
            </motion.button>
          </div>
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
          <button
            className="dash-player-btn"
            aria-label="ab-loop"
            onClick={handleToggleABLoop}
            style={{ color: isABLoop ? 'var(--accent)' : 'inherit', fontSize: '11px', fontWeight: 'bold', padding: '2px 6px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px' }}
            title="A-B Loop"
          >
            A-B
          </button>
          <button className="dash-player-btn" aria-label="volume" onClick={() => setVolume(v => v === 0 ? 1 : 0)}>
            {volume === 0 ? <VolumeX size={16} /> : volume < 0.5 ? <Volume1 size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range"
            min="0" max="1" step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            style={{ width: 80, cursor: 'pointer', accentColor: '#1db954' }}
          />
          <button className="dash-player-btn" onClick={() => setShowQueue(q => !q)} style={{ color: showQueue ? 'var(--accent)' : 'inherit' }} title="Queue">
            <ListMusic size={16} />
          </button>
          <button className="dash-player-btn" onClick={() => setIsExpanded(true)} style={{ color: isExpanded ? 'var(--accent)' : 'inherit' }} title="Lyrics">
            <Mic size={16} />
          </button>
          <button className="dash-player-btn" title="Visualizer"><Waves size={16} /></button>
          <button className="dash-player-btn" title="Sleep Timer"><Timer size={16} /></button>
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

      {/* ===== Context Menu ===== */}
      {ctxMenu.show && (
        <>
          <div className="ctx-menu-overlay" onClick={() => setCtxMenu(prev => ({...prev, show: false}))} />
          <div className="ctx-menu" style={{left: ctxMenu.x, top: ctxMenu.y}}>
            <div className="ctx-menu-item" onClick={() => { if (ctxMenu.track) { setCurrentSong(ctxMenu.track); setPlaying(true); setIsShuffle(true); } setCtxMenu(prev => ({...prev, show: false})); }}>
              <Shuffle size={16} /> Shuffle play
            </div>
            <div className="ctx-menu-item" onClick={() => setCtxMenu(prev => ({...prev, show: false}))}>
              <Radio size={16} /> Infinite Radio
            </div>
            <div className="ctx-menu-item" onClick={() => setCtxMenu(prev => ({...prev, show: false}))}>
              <Disc3 size={16} /> Start Mix
            </div>
            <div className="ctx-menu-sep" />
            <div className="ctx-menu-item" onClick={() => { if (ctxMenu.track) playNext(ctxMenu.track); setCtxMenu(prev => ({...prev, show: false})); }}>
              <SkipForward size={16} /> Play next
            </div>
            <div className="ctx-menu-item" onClick={() => { if (ctxMenu.track) addToQueue(ctxMenu.track); setCtxMenu(prev => ({...prev, show: false})); }}>
              <ListMusic size={16} /> Add to queue
            </div>
            <div className="ctx-menu-sep" />
            <div className="ctx-menu-item" onClick={() => { if (ctxMenu.track) toggleLike(ctxMenu.track.id); setCtxMenu(prev => ({...prev, show: false})); }}>
              <Heart size={16} fill={ctxMenu.track && likedSongs.has(ctxMenu.track.id) ? '#1db954' : 'none'} color={ctxMenu.track && likedSongs.has(ctxMenu.track.id) ? '#1db954' : 'currentColor'} /> {ctxMenu.track && likedSongs.has(ctxMenu.track.id) ? 'Unlike' : 'Like'}
            </div>
            <div className="ctx-menu-item" onClick={() => setCtxMenu(prev => ({...prev, show: false}))}>
              <Pin size={16} /> Pin
            </div>
            <div className="ctx-menu-item" onClick={() => setCtxMenu(prev => ({...prev, show: false}))}>
              <ListMusic size={16} /> Add to playlist
            </div>
            <div className="ctx-menu-sep" />
            <div className="ctx-menu-item" onClick={() => setCtxMenu(prev => ({...prev, show: false}))}>
              <Music size={16} /> Request song
            </div>
            <div className="ctx-menu-item" onClick={() => { if (ctxMenu.track) { setPopupArtist(ctxMenu.track.artist); setPopupAlbum(null); } setCtxMenu(prev => ({...prev, show: false})); }}>
              <Users size={16} /> Go to artist
            </div>
            <div className="ctx-menu-item" onClick={() => { if (ctxMenu.track) { setPopupAlbum(ctxMenu.track); } setCtxMenu(prev => ({...prev, show: false})); }}>
              <Disc3 size={16} /> Go to album
            </div>
            <div className="ctx-menu-sep" />
            <div className="ctx-menu-item" onClick={() => { if (ctxMenu.track) navigator.clipboard.writeText(`${window.location.origin}/track/${ctxMenu.track.id}`); setCtxMenu(prev => ({...prev, show: false})); }}>
              <Copy size={16} /> Copy link
            </div>
            <div className="ctx-menu-item" onClick={() => { if (ctxMenu.track) downloadTrack(null, ctxMenu.track); setCtxMenu(prev => ({...prev, show: false})); }}>
              <Download size={16} /> Download
            </div>
            <div className="ctx-menu-item" onClick={() => setCtxMenu(prev => ({...prev, show: false}))}>
              <Info size={16} /> Track info
            </div>
            <div className="ctx-menu-item" onClick={() => setCtxMenu(prev => ({...prev, show: false}))}>
              <ExternalLink size={16} /> Open original URL
            </div>
            <div className="ctx-menu-sep" />
            <div className="ctx-menu-item" onClick={() => setCtxMenu(prev => ({...prev, show: false}))} style={{color: '#e74c3c'}}>
              <Ban size={16} /> Block track / album / artist
            </div>
          </div>
        </>
      )}

      {/* ===== Queue Panel ===== */}
      {showQueue && (
        <div className="queue-panel">
          <div className="queue-header">
            <h3>Up Next</h3>
            <button className="queue-close" onClick={() => setShowQueue(false)}><X size={20} /></button>
          </div>
          <div className="queue-list">
            {/* Currently Playing */}
            <div className="queue-track active" onClick={() => {}}>
              <img src={currentSong.img} alt="" className="queue-track-img" />
              <div className="queue-track-info">
                <div className="queue-track-title" style={{color: 'var(--accent)'}}>{currentSong.title}</div>
                <div className="queue-track-artist">{currentSong.artist}</div>
              </div>
              <div className="queue-track-duration" style={{color: 'var(--accent)'}}>Now</div>
            </div>
            {/* Queued tracks */}
            {queue.length === 0 ? (
              <div style={{padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14}}>
                Queue is empty. Right-click a track to add it.
              </div>
            ) : queue.map((t, i) => (
              <div key={`q-${t.id}-${i}`} className="queue-track" onClick={() => { setCurrentSong(t); setPlaying(true); setQueue(prev => prev.filter((_, idx) => idx !== i)); }}>
                <img src={t.img} alt="" className="queue-track-img" />
                <div className="queue-track-info">
                  <div className="queue-track-title">{t.title}</div>
                  <div className="queue-track-artist">{t.artist}</div>
                </div>
                <div className="queue-track-duration">3:24</div>
                <button className="queue-track-remove" onClick={(e) => { e.stopPropagation(); removeFromQueue(i); }}><X size={16} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== Search Overlay ===== */}
      {showSearchOverlay && (
        <div className="search-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowSearchOverlay(false); }}>
          <input
            className="search-overlay-input"
            placeholder="Search songs, artists, albums... (press Esc to close)"
            value={searchOverlayQuery}
            onChange={(e) => setSearchOverlayQuery(e.target.value)}
            autoFocus
          />
          <div className="search-tabs">
            {["Tracks", "Albums", "Artists", "Playlists", "Podcasts"].map(tab => (
              <button key={tab} className={`search-tab ${searchTab === tab ? 'active' : ''}`} onClick={() => setSearchTab(tab)}>{tab}</button>
            ))}
          </div>
          <div className="search-results">
            {searchOverlayResults.length === 0 && searchOverlayQuery.trim() && (
              <div style={{textAlign: 'center', color: 'var(--text-secondary)', padding: 40, fontSize: 16}}>Searching...</div>
            )}
            {searchTab === "Tracks" && searchOverlayResults.map((s, i) => (
              <div key={`sr-${s.id}-${i}`} className="dash-track-row" onClick={() => { setCurrentSong(s); setPlaying(true); setShowSearchOverlay(false); setSearchOverlayQuery(""); }} onContextMenu={(e) => handleContextMenu(e, s)}>
                <div className="dash-track-left">
                  <div style={{width: 32, textAlign: 'right', marginRight: 16, color: 'rgba(255,255,255,0.5)', fontSize: 14}}>{i + 1}</div>
                  <div style={{width: 40, height: 40, overflow: 'hidden', borderRadius: 4, marginRight: 12, flexShrink: 0}}>
                    <div style={{width: '100%', height: '100%', backgroundImage: `url(${s.img})`, backgroundSize: 'cover', backgroundPosition: 'center'}} />
                  </div>
                  <div className="dash-track-details">
                    <div className="dash-track-title">{s.title}</div>
                    <div className="dash-track-meta">{s.artist}</div>
                  </div>
                </div>
                <div className="dash-track-duration">3:24</div>
              </div>
            ))}
            {searchTab === "Albums" && (
              <div className="dash-monochrome-grid" style={{marginTop: 16}}>
                {searchOverlayResults.slice(0, 12).map((s, i) => (
                  <div key={`sa-${s.id}-${i}`} className="dash-album-card" onClick={() => { setPopupAlbum(s); setShowSearchOverlay(false); }}>
                    <div style={{width: '100%', aspectRatio: '1/1', overflow: 'hidden', borderRadius: 6, marginBottom: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.3)'}}>
                      <div style={{width: '100%', height: '100%', backgroundImage: `url(${s.img})`, backgroundSize: 'cover', backgroundPosition: 'center'}} />
                    </div>
                    <div className="dash-album-title">{s.title}</div>
                    <div className="dash-album-meta">{s.artist}</div>
                  </div>
                ))}
              </div>
            )}
            {searchTab === "Artists" && (
              <div className="dash-playlists artists-grid" style={{marginTop: 16}}>
                {Array.from(new Set(searchOverlayResults.map(s => s.artist))).slice(0, 12).map((artist, i) => {
                  const song = searchOverlayResults.find(s => s.artist === artist);
                  return (
                    <div key={`artist-search-${i}`} className="dash-artist-card" onClick={() => { setPopupArtist(artist); setShowSearchOverlay(false); }}>
                      <div className="dash-artist-img" style={{backgroundImage: `url(${song?.img || ''})`}} />
                      <div className="dash-artist-name">{artist}</div>
                      <div className="dash-artist-label">Artist</div>
                    </div>
                  );
                })}
              </div>
            )}
            {(searchTab === "Playlists" || searchTab === "Podcasts") && (
              <div style={{textAlign: 'center', color: 'var(--text-secondary)', padding: 40, fontSize: 16}}>
                No {searchTab.toLowerCase()} found for &ldquo;{searchOverlayQuery}&rdquo;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTimeReal(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}