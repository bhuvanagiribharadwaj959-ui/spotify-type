"use client";

import { useEffect, useRef, useMemo } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
  Heart,
  ChevronDown,
  MoreHorizontal,
  Download
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "./playing.css";

type DashboardTrack = {
  id: string;
  img: string;
  title: string;
  artist: string;
  language?: string;
  artistPic?: string;
};

type PlayingOverlayProps = {
  track: DashboardTrack;
  playing: boolean;
  progress: number;
  isExpanded: boolean;
  onClose: () => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  isRepeat: boolean;
  onToggleRepeat: () => void;
  currentTime?: number;
  duration?: number;
  lyrics?: string;
  isLoading?: boolean;
  onSeek?: (time: number) => void;
  isLiked?: boolean;
  onToggleLike?: () => void;
  isABLoop?: boolean;
  onToggleABLoop?: () => void;
  abLoopStart?: number | null;
  abLoopEnd?: number | null;
  onProgressClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onDownload?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  alternatives?: any[];
  onAlternativeSelect?: (url: string) => void;
  onSelectArtist?: (artistName: string) => void;
};

export default function PlayingOverlay({
  track,
  playing,
  progress,
  isExpanded,
  onClose,
  onTogglePlay,
  onNext,
  onPrev,
  isShuffle,
  onToggleShuffle,
  isRepeat,
  onToggleRepeat,
  currentTime = 0,
  duration = 0,
  lyrics = "",
  isLoading = false,
  onSeek,
  isLiked = false,
  onToggleLike,
  isABLoop = false,
  onToggleABLoop,
  abLoopStart = null,
  abLoopEnd = null,
  onProgressClick,
  onDownload,
  alternatives = [],
  onAlternativeSelect,
  onSelectArtist
}: PlayingOverlayProps) {

  const activeLineIndexRef = useRef<number>(-1);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isExpanded) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded, onClose]);

  const formatTimeReal = (seconds: number | string) => {
    const secs = typeof seconds === 'string' ? parseInt(seconds) : seconds;
    if (isNaN(secs) || secs < 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Robust LRC Parsing Engine
  const parsedLyrics = useMemo(() => {
    if (!lyrics) return [];
    const lines = lyrics.split('\n');
    const parsed: { time: number | null, text: string }[] = [];
    const timeRegex = /\[(\d+):(\d+(?:\.\d+)?)\]/;

    let hasTimestamps = false;
    for (const line of lines) {
      if (timeRegex.test(line)) {
        hasTimestamps = true;
        break;
      }
    }

    if (hasTimestamps) {
      for (const line of lines) {
        const match = line.match(timeRegex);
        if (match) {
          const mins = parseInt(match[1]);
          const secs = parseFloat(match[2]);
          const time = mins * 60 + secs;
          const text = line.replace(timeRegex, '').trim();
          parsed.push({ time, text });
        } else if (line.trim()) {
          parsed.push({ time: null, text: line.trim() });
        }
      }
    } else {
      for (const line of lines) {
        parsed.push({ time: null, text: line.trim() });
      }
    }
    return parsed;
  }, [lyrics]);

  // Performance-First Direct DOM Synchronization loop
  useEffect(() => {
    const audio = document.querySelector('audio');
    if (!audio || !isExpanded) return;

    // Reset active index tracking on song or lyrics change
    activeLineIndexRef.current = -1;

    const updateLyricsSync = () => {
      if (!parsedLyrics.length) return;
      const currTime = audio.currentTime;
      
      let activeIdx = -1;
      for (let i = 0; i < parsedLyrics.length; i++) {
        if (parsedLyrics[i].time !== null) {
          if (currTime >= parsedLyrics[i].time!) {
            activeIdx = i;
          } else {
            break;
          }
        }
      }

      if (activeIdx !== activeLineIndexRef.current) {
        // Remove active class from old lyric line
        if (activeLineIndexRef.current !== -1) {
          const oldEl = document.getElementById(`lyric-line-${activeLineIndexRef.current}`);
          if (oldEl) oldEl.classList.remove('active');
        }
        
        // Add active class to new lyric line
        if (activeIdx !== -1) {
          const newEl = document.getElementById(`lyric-line-${activeIdx}`);
          if (newEl) {
            newEl.classList.add('active');
            newEl.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            });
          }
        }
        activeLineIndexRef.current = activeIdx;
      }

      // Also update progress bar inside PlayingOverlay directly via DOM!
      const dur = audio.duration || 0;
      const percent = dur ? (currTime / dur) * 100 : 0;
      const fillEl = document.getElementById('playing-progress-fill');
      if (fillEl) {
        fillEl.style.width = `${percent}%`;
      }
      const timeTextEl = document.getElementById('playing-current-time');
      if (timeTextEl) {
        timeTextEl.innerText = formatTimeReal(currTime);
      }
    };

    audio.addEventListener('timeupdate', updateLyricsSync);
    // Initial sync call
    updateLyricsSync();

    return () => {
      audio.removeEventListener('timeupdate', updateLyricsSync);
    };
  }, [parsedLyrics, isExpanded]);

  return (
    <AnimatePresence>
      {isExpanded && (
        <motion.div
          className="playing-overlay-root"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {/* Ambient blurred reflection background */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${track.img})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(80px) opacity(0.35)',
            transform: 'scale(1.2)',
            zIndex: 0,
            pointerEvents: 'none'
          }} />

          {/* Top Navigation Bar */}
          <div className="playing-topbar" style={{ zIndex: 1 }}>
            <button className="playing-icon-btn" onClick={onClose} aria-label="Minimize">
              <ChevronDown size={32} />
            </button>
            <div className="playing-topbar-title">
              <span 
                style={{ cursor: 'pointer', textDecoration: 'underline' }} 
                onClick={() => onSelectArtist?.(track.artist)}
              >
                {track.artist}
              </span>
              {" - "}{track.title}
            </div>
            <button className="playing-icon-btn">
              <MoreHorizontal size={24} />
            </button>
          </div>

          {/* Split Screen Container */}
          <div className="playing-content" style={{ zIndex: 1, display: 'flex', flex: 1, overflow: 'hidden' }}>
            
            {/* Left Column: Cover Art, Details & Controls */}
            <div className="playing-left-column" style={{
              flex: 4,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '0 40px',
              gap: '32px'
            }}>
              {/* Cover Art Box */}
              <div className="playing-cover-wrapper" style={{ 
                width: '100%', 
                maxWidth: '400px', 
                aspectRatio: '1/1', 
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 25px 60px rgba(0,0,0,0.7)'
              }}>
                <img src={track.img} alt={track.title} className="playing-cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>

              {/* Title & Artist details */}
              <div style={{ width: '100%', maxWidth: '400px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-1px', lineHeight: 1.2 }}>{track.title}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {track.artistPic ? (
                    <img src={track.artistPic} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.2)' }} />
                  ) : (
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Volume2 size={16} color="white" />
                    </div>
                  )}
                  <span 
                    style={{ fontSize: '1.25rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => onSelectArtist?.(track.artist)}
                  >
                    {track.artist}
                  </span>
                </div>
              </div>

              {/* Left Column contains only Cover Art and Details. Duplicate player controls are removed since the bottom player is fully active and visible below. */}
            </div>

            {/* Right Column: Synced Lyrics Scrolling View */}
            <div className="playing-lyrics-container" ref={lyricsContainerRef} style={{
              flex: 6,
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              height: '100%',
              paddingRight: '24px',
              maskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 80%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 80%, transparent 100%)'
            }}>
              <div className="playing-lyrics" style={{ padding: '100px 20px 180px 20px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {isLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px', gap: '24px' }}>
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <motion.path d="M2 6c.6 0 1.2-.2 1.7-.6C4.8 4.3 6.3 4.3 7.4 5.4c.5.4 1.1.6 1.7.6s1.2-.2 1.7-.6C11.9 4.3 13.4 4.3 14.5 5.4c.5.4 1.1.6 1.7.6s1.2-.2 1.7-.6C19.1 4.3 20.6 4.3 21.7 5.4c.5.4 1.2.6 1.7.6" animate={{ y: [-4, 4, -4] }} transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut" }} />
                      <motion.path d="M2 12c.6 0 1.2-.2 1.7-.6C4.8 10.3 6.3 10.3 7.4 11.4c.5.4 1.1.6 1.7.6s1.2-.2 1.7-.6C11.9 10.3 13.4 10.3 14.5 11.4c.5.4 1.1.6 1.7.6s1.2-.2 1.7-.6C19.1 10.3 20.6 10.3 21.7 11.4c.5.4 1.2.6 1.7.6" animate={{ y: [4, -4, 4] }} transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut" }} />
                      <motion.path d="M2 18c.6 0 1.2-.2 1.7-.6C4.8 16.3 6.3 16.3 7.4 17.4c.5.4 1.1.6 1.7.6s1.2-.2 1.7-.6C11.9 16.3 13.4 16.3 14.5 17.4c.5.4 1.1.6 1.7.6s1.2-.2 1.7-.6C19.1 16.3 20.6 16.3 21.7 17.4c.5.4 1.2.6 1.7.6" animate={{ y: [-4, 4, -4] }} transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut" }} />
                    </svg>
                    <motion.h1 
                      className="lyric-line active" 
                      style={{ fontSize: '28px', margin: 0, textAlign: 'center' }}
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                    >
                      Extracting Audio & Lyrics...
                    </motion.h1>
                    <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
                      Hang tight, we're pulling the highest quality stream.
                    </div>
                  </div>
                ) : parsedLyrics.length > 0 ? (
                  parsedLyrics.map((line, i) => {
                    return line.text ? (
                      <h1
                        key={i}
                        id={`lyric-line-${i}`}
                        className="lyric-line"
                        onClick={() => {
                          if (line.time !== null && onSeek) {
                            onSeek(line.time);
                          }
                        }}
                        style={{ cursor: line.time !== null ? "pointer" : "default" }}
                      >
                        {line.text}
                      </h1>
                    ) : (
                      <br key={i} />
                    );
                  })
                ) : (
                  <h1 className="lyric-line">No lyrics found</h1>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
