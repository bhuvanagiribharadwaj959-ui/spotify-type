"use client";

import { useRef, useState, useEffect, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../lib/firebase";
import PixelParticleImage from "./PixelParticleImage";
import {
  Bell,
  Heart,
  Pause,
  Play,
  Search,
  SkipBack,
  SkipForward,
  Clock,
  TrendingUp,
  Sparkles,
  Music2,
  Mic,
  Volume2,
  Users,
  Layers,
  Settings,
  Activity,
} from "lucide-react";
import "./hero-page.css";
import Link from "next/link";

const headingWords = ["Your", "music.", "Your", "world.", "Unfiltered."];

function TiltCard({
  children,
  className = "",
  max = 8,
  style,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `rotateY(${x * max}deg) rotateX(${-y * max}deg) translateZ(0)`;
  };

  const handleLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = "rotateY(0) rotateX(0) translateZ(0)";
  };

  return (
    <div
      ref={ref}
      className={`card ${className}`}
      style={style}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {children}
    </div>
  );
}

type FeatureStat = {
  icon: ReactNode;
  title: string;
  desc: string;
};

function InteractiveFeature({
  badge,
  title,
  desc,
  stats,
  reverse,
  children,
}: {
  badge: string;
  title: ReactNode;
  desc: string;
  stats?: FeatureStat[];
  reverse?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`interactive-feature ${reverse ? "reverse" : ""}`}>
      <div className="if-content">
        <div className="if-badge">{badge}</div>
        <h2 className="if-title">{title}</h2>
        <p className="if-desc">{desc}</p>

        {stats && stats.length > 0 && (
          <div className="if-stats-grid">
            {stats.map((stat, i) => (
              <div key={i} className="if-stat-card">
                <div className="if-stat-icon">{stat.icon}</div>
                <div>
                  <h4 className="if-stat-title">{stat.title}</h4>
                  <p className="if-stat-desc">{stat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
      <div className="if-visual">
        <div className="mock-window-header">
          <div className="mock-dot r" />
          <div className="mock-dot y" />
          <div className="mock-dot g" />
        </div>
        <div className="mock-window-body">
          {children}
        </div>
      </div>
    </div>
  );
}

function MiniTrack({
  title,
  artist,
  cover,
  delayClass,
}: {
  title: string;
  artist: string;
  cover: string;
  delayClass: string;
}) {
  const [liked, setLiked] = useState(false);
  const [playing, setPlaying] = useState(false);

  return (
    <TiltCard className={`mini-card ${delayClass}`} max={6}>
      <img className="mini-art mini-art-image" src={cover} alt={`${title} cover`} />
      <div className="mini-info">
        <div className="mini-title">{title}</div>
        <div className="mini-artist">{artist}</div>
      </div>
      <div className="mini-actions">
        <button
          aria-label="Like"
          className={`heart ${liked ? "liked" : ""}`}
          onClick={() => setLiked((v) => !v)}
        >
          <Heart size={16} fill={liked ? "#1db954" : "none"} />
        </button>
        <button
          aria-label="Play"
          className="play-btn-mini"
          onClick={() => setPlaying((v) => !v)}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
      </div>
    </TiltCard>
  );
}

function PlaylistCard({
  title,
  artist,
  cover,
  delay,
}: {
  title: string;
  artist: string;
  cover: string;
  delay: string;
}) {
  const [liked, setLiked] = useState(false);
  const [playing, setPlaying] = useState(false);

  return (
    <TiltCard className={`playlist-card ${delay}`} max={5}>
      <div className="playlist-cover">
        <img className="playlist-cover-image" src={cover} alt={`${title} cover`} />
        <button
          className="play-btn-cover"
          onClick={() => setPlaying((v) => !v)}
          aria-label="Play playlist"
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
      </div>
      <div className="playlist-meta">
        <h3 className="playlist-title">{title}</h3>
        <p className="playlist-desc">{artist}</p>
        <button
          className={`like-playlist ${liked ? "liked" : ""}`}
          onClick={() => setLiked((v) => !v)}
          aria-label="Like playlist"
        >
          <Heart size={18} fill={liked ? "#1db954" : "none"} />
        </button>
      </div>
    </TiltCard>
  );
}

function ArtistCard({
  name,
  song,
  cover,
  delay,
}: {
  name: string;
  song: string;
  cover: string;
  delay: string;
}) {
  const [following, setFollowing] = useState(false);

  return (
    <TiltCard className={`artist-card ${delay}`} max={5}>
      <img className="artist-avatar artist-avatar-image" src={cover} alt={`${song} cover`} />
      <h3 className="artist-name">{name}</h3>
      <p className="artist-genre">{song}</p>
      <button
        className={`follow-btn ${following ? "following" : ""}`}
        onClick={() => setFollowing((v) => !v)}
      >
        {following ? "Following" : "Follow"}
      </button>
    </TiltCard>
  );
}

function AlbumCard({
  title,
  artist,
  cover,
  delay,
}: {
  title: string;
  artist: string;
  cover: string;
  delay: string;
}) {
  const [playing, setPlaying] = useState(false);

  return (
    <TiltCard className={`album-card ${delay}`} max={5}>
      <div className="album-cover">
        <img className="album-cover-image" src={cover} alt={`${title} cover`} />
        <button
          className="play-btn-cover"
          onClick={() => setPlaying((v) => !v)}
          aria-label="Play album"
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
      </div>
      <h3 className="album-title">{title}</h3>
      <p className="album-artist">{artist}</p>
    </TiltCard>
  );
}

function HeroVisual() {
  return (
    <div className="hero-particle-shell">
      <PixelParticleImage
        src="https://zgcbpjrvzmocydnlpexx.supabase.co/storage/v1/object/public/songs/hero-model.jpg"
        width={600}
        height={750}
      />
    </div>
  );
}

export default function FullPage() {
  const [npPlaying, setNpPlaying] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="full-page-root">
      <div className="aurora" />
      <div className="aurora-secondary" />

      <nav className="navbar">
        <div className="logo" style={{ gap: '10px' }}>
          <img src="https://zgcbpjrvzmocydnlpexx.supabase.co/storage/v1/object/public/songs/logo.png" alt="Sonic" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
          <span>Sonic</span>
        </div>
        <div className="nav-links">
          <Link href="/dashboard" className="nav-link" style={{ textDecoration: 'none' }}>Dashboard</Link>
          <Link href="/create" className="nav-link" style={{ textDecoration: 'none' }}>Studio</Link>
          <Link href="/login" className="nav-link" style={{ textDecoration: 'none' }}>Login</Link>
          <Link href="/sign-up" className="nav-link" style={{ textDecoration: 'none' }}>Sign Up</Link>
        </div>
        <div className="nav-right">

        </div>
      </nav>

      <section className="hero">
        <div className="left">
          <div className="eyebrow">🎵 Trending this week</div>

          <h1 className="h1">
            {headingWords.map((w, i) => (
              <span
                key={i}
                className={`word ${w === "Unfiltered." ? "italic" : ""}`}
                style={{ animationDelay: `${0.4 + i * 0.08}s` }}
              >
                {w}
              </span>
            ))}
          </h1>

          <p className="subtext">
            Discover 100 million songs, playlists crafted for every mood, and artists
            who move you — all in one immersive place.
          </p>

          <div className="cta-row">
            <Link href={mounted && user ? "/dashboard" : "/sign-up"} className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Start Listening Free</Link>
          </div>

          <div className="social-proof">
            <div className="avatars">
              <div className="av av1" />
              <div className="av av2" />
              <div className="av av3" />
            </div>
            <span className="social-text">Join 600M+ listeners worldwide</span>
          </div>
        </div>

        <div className="visual">
          {mounted && <HeroVisual />}
        </div>
      </section>


      {/* Feature 1: Sequencer */}
      <InteractiveFeature
        badge="✨ The Studio"
        title={<>Build beats with<br /><span>Loop Sequencer</span></>}
        desc="Drag and drop loops, arrange clips on a timeline, and build your next hit track directly in the browser with our latency-free sequencer."
        stats={[
          { icon: <Layers size={18} />, title: "Multi-Channel Grid", desc: "Sequence drums, synths, and bass lines across multiple channels." },
          { icon: <Activity size={18} />, title: "Real-time Playback", desc: "No bounce delays. Listen to your changes instantly." }
        ]}
      >
        <div className="daw-studio">
          <div className="daw-toolbar">
            <div className="daw-play-btn"><Play size={12} fill="#1db954" stroke="none" /></div>
            <div className="daw-tempo">120 BPM</div>
            <div className="daw-time">00:01:24</div>
          </div>
          <div className="daw-timeline">
            <div className="daw-playhead" />
            {['Synth Lead', '808 Drums', 'Sub Bass', 'Vox FX'].map((trackName, t) => (
              <div key={t} className="daw-track-row">
                <div className="daw-track-header">
                  <span>{trackName}</span>
                </div>
                <div className="daw-track-pads">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className={`seq-pad ${((i + t) % 3 === 0 || (i * t) % 4 === 1) ? 'active' : ''}`} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </InteractiveFeature>

      {/* Feature 2: AI Assisted */}
      <InteractiveFeature
        badge="🧠 AI Composition"
        title={<>Never hit a<br /><span>Creative Block</span></>}
        desc="Generate melodies, chord progressions, or entire stems with our advanced AI assistant. Get smart mixing presets instantly."
        reverse={true}
        stats={[
          { icon: <Sparkles size={18} />, title: "Melody Generation", desc: "Create catchy hooks and vocal lines with our AI model." },
          { icon: <Music2 size={18} />, title: "Chord Progressions", desc: "Auto-harmonize your tracks with rich chord structures." }
        ]}
      >
        <div className="ai-node-graph">
          <svg className="ai-svg-lines">
            <path d="M 50,110 L 160,110" className="ai-flow-line" />
            <path d="M 160,110 L 270,55" className="ai-flow-line" />
            <path d="M 160,110 L 270,165" className="ai-flow-line" />
          </svg>
          <div className="ai-node-item" style={{ width: '90px' }}>
            <div className="ai-node-title">Prompt</div>
            <div className="ai-node-value">"Lofi Beat"</div>
          </div>
          <div className="ai-node-item core">
            <div className="ai-node-title">AI Engine</div>
            <div className="ai-node-status">Generating...</div>
          </div>
          <div className="ai-node-item" style={{ width: '90px' }}>
            <div className="ai-node-title">Output</div>
            <div className="ai-node-miniwave">
              <span style={{ height: '10px' }} /><span style={{ height: '22px' }} /><span style={{ height: '14px' }} />
            </div>
          </div>
        </div>
      </InteractiveFeature>

      {/* Feature 3: Record & Upload */}
      <InteractiveFeature
        badge="🎙️ Capture Ideas"
        title={<>High-Fidelity<br /><span>Recording</span></>}
        desc="Record your vocals or instruments directly into Sonic. Upload your own stems and easily slice, pitch, and time-stretch them."
        stats={[
          { icon: <Mic size={18} />, title: "Direct Audio Capture", desc: "Record clean audio straight from any connected device." },
          { icon: <Volume2 size={18} />, title: "Gain & Mixer Tools", desc: "Adjust input gain and mix levels directly inside the editor." }
        ]}
      >
        <div className="wave-editor">
          <div className="editor-top">
            <div className="rec-indicator"><span className="rec-dot" /> REC</div>
            <div className="gain-control"><Volume2 size={14} /> 0.8 dB</div>
          </div>
          <div className="waveform-container">
            <div className="waveform-track green">
              <svg className="wave-svg" viewBox="0 0 300 40">
                <path d="M 0,20 Q 15,2 30,20 T 60,20 T 90,20 T 120,20 T 150,20 T 180,20 T 210,20 T 240,20 T 270,20 T 300,20" stroke="#1db954" strokeWidth="2" fill="none" />
              </svg>
            </div>
            <div className="waveform-track violet">
              <svg className="wave-svg" viewBox="0 0 300 40">
                <path d="M 0,20 Q 15,35 30,20 T 60,20 T 90,20 T 120,20 T 150,20 T 180,20 T 210,20 T 240,20 T 270,20 T 300,20" stroke="#7c3aed" strokeWidth="2" fill="none" />
              </svg>
            </div>
          </div>
        </div>
      </InteractiveFeature>

      {/* Feature 4: Sample Library */}
      <InteractiveFeature
        badge="🎹 Infinite Sounds"
        title={<>Curated<br /><span>Sample Library</span></>}
        desc="Access thousands of royalty-free one-shots, loops, and instruments. Easily find the perfect kick or synth patch."
        reverse={true}
        stats={[
          { icon: <Bell size={18} />, title: "10k+ Free Files", desc: "Fresh hits, kicks, loops, and vocal chops update weekly." },
          { icon: <Settings size={18} />, title: "Advanced Search", desc: "Filter by BPM, key, scale, or specific instrumentation." }
        ]}
      >
        <div className="sample-browser">
          <div className="sample-sidebar">
            <div className="sidebar-item active">All Samples</div>
            <div className="sidebar-item">Drum Hits</div>
            <div className="sidebar-item">Melodies</div>
            <div className="sidebar-item">FX Stems</div>
          </div>
          <div className="sample-main">
            <div className="sample-search"><Search size={12} /> Search 10,000+ files...</div>
            <div className="sample-list">
              {['808 Kick Classic.wav', 'Lo-Fi Piano Cmin.wav', 'Vocal Chop Dry.wav'].map((name, idx) => (
                <div key={idx} className="sample-row">
                  <Play size={10} fill="#a3a3a3" stroke="none" />
                  <span style={{ fontSize: '11px' }}>{name}</span>
                  <span className="sample-time">1.2s</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </InteractiveFeature>

      {/* Feature 5: Collaboration */}
      <InteractiveFeature
        badge="🌍 Real-time Collab"
        title={<>Create<br /><span>Together</span></>}
        desc="Invite your friends to your project. Edit the timeline together, leave comments, and mix in real-time, no matter where you are."
        stats={[
          { icon: <Users size={18} />, title: "Simultaneous Edits", desc: "Work together on the same project timeline without latency." },
          { icon: <TrendingUp size={18} />, title: "Auto Cloud-Sync", desc: "Your adjustments sync to the cloud instantly." }
        ]}
      >
        <div className="collab-board">
          <div className="collab-users-bar">
            <span className="collab-avatar av1">A</span>
            <span className="collab-avatar av2">J</span>
            <span className="collab-avatar av3">+3</span>
          </div>
          <div className="collab-timeline-container">
            <div className="collab-cursor c1">
              <div className="c-ptr" />
              <div className="c-tag">Alex is slicing...</div>
            </div>
            <div className="collab-cursor c2">
              <div className="c-ptr" />
              <div className="c-tag">Jordan is tuning...</div>
            </div>
            <div className="collab-track-block yellow">Intro Synth Loop</div>
            <div className="collab-track-block green">Chorus Hook Stems</div>
          </div>
        </div>
      </InteractiveFeature>

      <section className="section" style={{ display: 'flex', justifyContent: 'center' }}>
        <h1 className="sonic-big-text">SONIC</h1>
      </section>

    </div>
  );
}
