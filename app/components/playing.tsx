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
  onAlternativeSelect
}: PlayingOverlayProps) {
  
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
          if (text) {
            parsed.push({ time, text });
          }
        } else if (line.trim()) {
          parsed.push({ time: null, text: line.trim() });
        } else {
          parsed.push({ time: null, text: '' });
        }
      }
    } else {
      const validLines = lines.filter(l => l.trim());
      const total = validLines.length;
      let currentIndex = 0;
      // Estimate start and end times
      const startOffset = duration * 0.1;
      const playableDuration = duration * 0.8;

      for (const line of lines) {
        const text = line.trim();
        if (text) {
          const time = total > 1 ? startOffset + (playableDuration * (currentIndex / (total - 1))) : startOffset;
          parsed.push({ time, text });
          currentIndex++;
        } else {
          parsed.push({ time: null, text: '' });
        }
      }
    }
    return parsed;
  }, [lyrics, duration]);

  const activeLineIndex = useMemo(() => {
    if (!parsedLyrics.length) return -1;
    let activeIdx = -1;
    for (let i = 0; i < parsedLyrics.length; i++) {
      if (parsedLyrics[i].time !== null) {
        if (currentTime >= parsedLyrics[i].time!) {
          activeIdx = i;
        } else {
          break;
        }
      }
    }
    return activeIdx;
  }, [currentTime, parsedLyrics]);

  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (activeLineRef.current && lyricsContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeLineIndex]);

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
          {/* Top Navigation */}
          <div className="playing-topbar">
            <button className="playing-icon-btn" onClick={onClose} aria-label="Minimize">
              <ChevronDown size={32} />
            </button>
            <div className="playing-topbar-title">
              {track.artist} - {track.title}
            </div>
            <button className="playing-icon-btn">
              <MoreHorizontal size={24} />
            </button>
          </div>

          <div className="playing-content">
            {/* Left Side: Lyrics */}
            <div className="playing-lyrics-container" ref={lyricsContainerRef}>
              <div className="playing-lyrics">
                {isLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px', gap: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', height: '60px' }}>
                      <motion.span style={{ width: '8px', background: 'var(--accent)', borderRadius: '4px', margin: '0 4px' }} animate={{ height: ["10px", "40px", "10px"] }} transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }} />
                      <motion.span style={{ width: '8px', background: 'var(--accent)', borderRadius: '4px', margin: '0 4px' }} animate={{ height: ["10px", "60px", "10px"] }} transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut", delay: 0.1 }} />
                      <motion.span style={{ width: '8px', background: 'var(--accent)', borderRadius: '4px', margin: '0 4px' }} animate={{ height: ["10px", "30px", "10px"] }} transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut", delay: 0.2 }} />
                      <motion.span style={{ width: '8px', background: 'var(--accent)', borderRadius: '4px', margin: '0 4px' }} animate={{ height: ["10px", "50px", "10px"] }} transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut", delay: 0.3 }} />
                    </div>
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
                    const isActive = i === activeLineIndex;
                    return line.text ? (
                      <h1
                        key={i}
                        ref={isActive ? activeLineRef : null}
                        className={`lyric-line ${isActive ? "active" : ""}`}
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

            {/* Right Side: Info & Cover */}
            <div className="playing-info-container" style={{ justifyContent: 'center', flexDirection: 'column', gap: '2rem' }}>
              <div className="playing-cover-wrapper" style={{ width: '100%', maxWidth: '400px', height: 'auto', aspectRatio: '1/1', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
                <img src={track.img} alt={track.title} className="playing-cover" />
              </div>


            </div>
          </div>

          {/* Player Bottom Bar */}
          <div className="playing-player">
            <div className="dash-player-left" style={{ cursor: 'pointer' }} onClick={onClose}>
              <img src={track.img} alt="" className="dash-player-img" />
              <div className="dash-player-info">
                <div className="dash-player-title">{track.title}</div>
                <div className="dash-player-artist">{track.artist}</div>
              </div>
            </div>

            <div className="dash-player-controls">
              <div className="dash-player-buttons">
                <button className="dash-player-btn" onClick={onToggleShuffle} style={{ color: isShuffle ? 'var(--accent)' : 'inherit' }}><Shuffle size={16} /></button>
                <button className="dash-player-btn" onClick={onPrev}><SkipBack size={18} /></button>
                <motion.button
                  className="dash-player-main"
                  whileTap={{ scale: 0.9 }}
                  onClick={onTogglePlay}
                >
                  {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                </motion.button>
                <button className="dash-player-btn" onClick={onNext}><SkipForward size={18} /></button>
                <button className="dash-player-btn" onClick={onToggleRepeat} style={{ color: isRepeat ? 'var(--accent)' : 'inherit' }}><Repeat size={16} /></button>
                <button className="dash-player-btn" aria-label="ab-loop" onClick={onToggleABLoop} style={{ color: isABLoop ? 'var(--accent)' : 'inherit', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '12px', fontWeight: 600 }}>
                  -<Repeat size={14} />-
                </button>
                <motion.button
                  className="dash-player-btn"
                  onClick={onToggleLike}
                  whileTap={{ scale: 0.8 }}
                  animate={isLiked ? { scale: [1, 1.2, 1], color: "#e1306c" } : { color: "rgba(255,255,255,0.7)" }}
                  transition={{ duration: 0.3 }}
                  aria-label="like"
                >
                  <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
                </motion.button>
                <motion.button
                  className="dash-player-btn"
                  onClick={onDownload}
                  whileTap={{ scale: 0.8 }}
                  style={{ color: "rgba(255,255,255,0.7)" }}
                  aria-label="download"
                  title="Download Current Track"
                >
                  <Download size={16} />
                </motion.button>
              </div>
              <div className="dash-player-progress">
                <span>{formatTimeReal(currentTime)}</span>
                <div className="dash-player-bar" style={{ cursor: 'pointer', position: 'relative' }} onClick={onProgressClick}>
                  <motion.div
                    className="dash-player-fill"
                    style={{ width: `${progress}%` }}
                    layout
                  />
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
              <button className="dash-player-btn"><Volume2 size={16} /></button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
