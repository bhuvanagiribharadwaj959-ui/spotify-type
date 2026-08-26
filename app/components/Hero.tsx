'use client'

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react'
import './Hero.css'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const links = ['Library', 'Create', 'Artists', 'Gallery']

const artists = [
  {
    name: 'The Weeknd',
    genre: 'After Hours · R&B',
    image: 'https://c.saavncdn.com/358/Starboy-English-2016-20240207050743-500x500.jpg',
    accent: '#ffffff',
  },
  {
    name: 'Taylor Swift',
    genre: 'Showgirl · Pop & Folk',
    image: 'https://c.saavncdn.com/126/The-Life-of-a-Showgirl-English-2025-20251003103620-500x500.jpg',
    accent: '#ffffff',
  },
  {
    name: 'Travis Scott',
    genre: 'Utopia · Trap & Hip Hop',
    image: 'https://c.saavncdn.com/882/UTOPIA-English-2023-20230728085013-500x500.jpg',
    accent: '#ffffff',
  },
  {
    name: 'SZA',
    genre: 'SOS · Alt Soul & R&B',
    image: 'https://c.saavncdn.com/607/People-English-2022-20221207081653-500x500.jpg',
    accent: '#ffffff',
  },
  {
    name: 'Ed Sheeran',
    genre: 'Mathematics · Pop',
    image: 'https://c.saavncdn.com/760/Sapphire-English-2025-20250623223610-500x500.jpg',
    accent: '#ffffff',
  },
  {
    name: 'Ariana Grande',
    genre: 'Eternal Sunshine · Pop',
    image: 'https://c.saavncdn.com/036/eternal-sunshine-English-2024-20240308113754-500x500.jpg',
    accent: '#ffffff',
  },
]

const tracks = [
  { title: 'The Fate of Ophelia', artist: 'Taylor Swift', dur: '3:45', art: 'https://c.saavncdn.com/126/The-Life-of-a-Showgirl-English-2025-20251003103620-500x500.jpg' },
  { title: 'FE!N', artist: 'Travis Scott', dur: '3:34', art: 'https://c.saavncdn.com/882/UTOPIA-English-2023-20230728085013-500x500.jpg' },
  { title: 'Big Dawgs', artist: 'Hanumankind', dur: '3:50', art: 'https://c.saavncdn.com/883/Big-Dawgs-English-2024-20240707053259-500x500.jpg' },
  { title: 'Calm Down', artist: 'Rema', dur: '3:39', art: 'https://c.saavncdn.com/596/Calm-Down-English-2022-20220826054039-500x500.jpg' },
  { title: 'Espresso', artist: 'Sabrina Carpenter', dur: '2:55', art: 'https://c.saavncdn.com/111/Espresso-English-2024-20240412064803-500x500.jpg' },
  { title: 'APT.', artist: 'Rosé & Bruno Mars', dur: '2:49', art: 'https://c.saavncdn.com/138/APT-English-2024-20241204043232-500x500.jpg' },
  { title: 'Starboy', artist: 'The Weeknd', dur: '3:50', art: 'https://c.saavncdn.com/358/Starboy-English-2016-20240207050743-500x500.jpg' },
  { title: 'Shape of You', artist: 'Ed Sheeran', dur: '3:53', art: 'https://c.saavncdn.com/126/Shape-of-You-English-2017-500x500.jpg' },
  { title: 'Die With A Smile', artist: 'Lady Gaga & Bruno Mars', dur: '4:11', art: 'https://c.saavncdn.com/060/Die-With-A-Smile-English-2024-20240816103634-500x500.jpg' },
  { title: 'As It Was', artist: 'Harry Styles', dur: '2:47', art: 'https://c.saavncdn.com/720/As-It-Was-English-2022-20220401035858-500x500.jpg' },
]

const WHITE_KEYS = [
  { note: 'C4', freq: 261.63, key: 'A' },
  { note: 'D4', freq: 293.66, key: 'S' },
  { note: 'E4', freq: 329.63, key: 'D' },
  { note: 'F4', freq: 349.23, key: 'F' },
  { note: 'G4', freq: 392.00, key: 'G' },
  { note: 'A4', freq: 440.00, key: 'H' },
  { note: 'B4', freq: 493.88, key: 'J' },
  { note: 'C5', freq: 523.25, key: 'K' },
  { note: 'D5', freq: 587.33, key: 'L' },
  { note: 'E5', freq: 659.25, key: ';' },
  { note: 'F5', freq: 698.46, key: 'Z' },
  { note: 'G5', freq: 783.99, key: 'X' },
  { note: 'A5', freq: 880.00, key: 'C' },
  { note: 'B5', freq: 987.77, key: 'V' },
  { note: 'C6', freq: 1046.50, key: 'B' },
]

const BLACK_KEYS = [
  { note: 'C#4', freq: 277.18, key: 'W', afterWhiteIndex: 0 },
  { note: 'D#4', freq: 311.13, key: 'E', afterWhiteIndex: 1 },
  { note: 'F#4', freq: 369.99, key: 'T', afterWhiteIndex: 3 },
  { note: 'G#4', freq: 415.30, key: 'Y', afterWhiteIndex: 4 },
  { note: 'A#4', freq: 466.16, key: 'U', afterWhiteIndex: 5 },
  { note: 'C#5', freq: 554.37, key: 'O', afterWhiteIndex: 7 },
  { note: 'D#5', freq: 622.25, key: 'P', afterWhiteIndex: 8 },
  { note: 'F#5', freq: 739.99, key: '1', afterWhiteIndex: 10 },
  { note: 'G#5', freq: 830.61, key: '2', afterWhiteIndex: 11 },
  { note: 'A#5', freq: 932.33, key: '3', afterWhiteIndex: 12 },
]

const PAD_NOTES = [
  { note: 'C4', freq: 261.63, key: '1', color: '#ffffff' },
  { note: 'D4', freq: 293.66, key: '2', color: '#ffffff' },
  { note: 'E4', freq: 329.63, key: '3', color: '#ffffff' },
  { note: 'F4', freq: 349.23, key: '4', color: '#ffffff' },
  { note: 'G4', freq: 392.00, key: '5', color: '#ffffff' },
  { note: 'A4', freq: 440.00, key: '6', color: '#ffffff' },
  { note: 'B4', freq: 493.88, key: '7', color: '#ffffff' },
  { note: 'C5', freq: 523.25, key: '8', color: '#ffffff' },
  { note: 'D5', freq: 587.33, key: 'Q', color: '#ffffff' },
  { note: 'E5', freq: 659.25, key: 'W', color: '#ffffff' },
  { note: 'F5', freq: 698.46, key: 'E', color: '#ffffff' },
  { note: 'G5', freq: 783.99, key: 'R', color: '#ffffff' },
  { note: 'A5', freq: 880.00, key: 'T', color: '#ffffff' },
  { note: 'B5', freq: 987.77, key: 'Y', color: '#ffffff' },
  { note: 'C6', freq: 1046.50, key: 'U', color: '#ffffff' },
  { note: 'D6', freq: 1174.66, key: 'I', color: '#ffffff' },
]

function playSound(freq: number, isPianoMode: boolean = true) {
  if (typeof window === 'undefined') return
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    const now = ctx.currentTime

    if (isPianoMode) {
      // Acoustic piano synthesis (harmonics + attack transient + natural sustain)
      const masterGain = ctx.createGain()
      masterGain.gain.setValueAtTime(0.4, now)
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8)

      const harmonics = [
        { mult: 1, gain: 0.6 },
        { mult: 2, gain: 0.25 },
        { mult: 3, gain: 0.1 },
        { mult: 4, gain: 0.05 },
      ]

      harmonics.forEach(({ mult, gain: hGain }) => {
        const osc = ctx.createOscillator()
        const oscGain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq * mult, now)

        oscGain.gain.setValueAtTime(hGain, now)
        oscGain.gain.exponentialRampToValueAtTime(0.0001, now + (1.8 / mult))

        osc.connect(oscGain)
        oscGain.connect(masterGain)

        osc.start(now)
        osc.stop(now + 1.8)
      })

      // Percussive hammer attack click
      const attackOsc = ctx.createOscillator()
      const attackGain = ctx.createGain()
      attackOsc.type = 'sine'
      attackOsc.frequency.setValueAtTime(freq * 0.5, now)
      attackGain.gain.setValueAtTime(0.15, now)
      attackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)

      attackOsc.connect(attackGain)
      attackGain.connect(masterGain)
      attackOsc.start(now)
      attackOsc.stop(now + 0.04)

      masterGain.connect(ctx.destination)
    } else {
      // Electronic synth tone
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, now)

      gain.gain.setValueAtTime(0.35, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.75)
    }
  } catch (err) {
    console.error('Audio play error', err)
  }
}

const artistRotation = [
  { name: 'The Weeknd', tag: 'After Hours', listeners: '115M', depth: 0, image: 'https://c.saavncdn.com/358/Starboy-English-2016-20240207050743-500x500.jpg' },
  { name: 'Taylor Swift', tag: 'Pop & Folk', listeners: '105M', depth: 42, image: 'https://c.saavncdn.com/126/The-Life-of-a-Showgirl-English-2025-20251003103620-500x500.jpg' },
  { name: 'Travis Scott', tag: 'Trap & Hip-Hop', listeners: '72M', depth: 18, image: 'https://c.saavncdn.com/882/UTOPIA-English-2023-20230728085013-500x500.jpg' },
  { name: 'SZA', tag: 'Alt-Soul & R&B', listeners: '68M', depth: 56, image: 'https://c.saavncdn.com/607/People-English-2022-20221207081653-500x500.jpg' },
  { name: 'Ariana Grande', tag: 'Pop', listeners: '89M', depth: 30, image: 'https://c.saavncdn.com/036/eternal-sunshine-English-2024-20240308113754-500x500.jpg' },
]

const tiles = [
  { id: 'showgirl', image: 'https://c.saavncdn.com/126/The-Life-of-a-Showgirl-English-2025-20251003103620-500x500.jpg', label: 'The Life of a Showgirl', span: 'row-span-2' },
  { id: 'utopia', image: 'https://c.saavncdn.com/882/UTOPIA-English-2023-20230728085013-500x500.jpg', label: 'UTOPIA', span: '' },
  { id: 'starboy', image: 'https://c.saavncdn.com/358/Starboy-English-2016-20240207050743-500x500.jpg', label: 'Starboy', span: '' },
  { id: 'sunshine', image: 'https://c.saavncdn.com/036/eternal-sunshine-English-2024-20240308113754-500x500.jpg', label: 'eternal sunshine', span: 'row-span-2' },
  { id: 'diewithasmile', image: 'https://c.saavncdn.com/060/Die-With-A-Smile-English-2024-20240816103634-500x500.jpg', label: 'Die With A Smile', span: '' },
  { id: 'espresso', image: 'https://c.saavncdn.com/111/Espresso-English-2024-20240412064803-500x500.jpg', label: 'Espresso', span: '' },
]

function Reveal({ children, delay = 0, y = 32, className }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, filter: 'blur(12px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

export default function Hero() {
  const router = useRouter()
  const ref = useRef<HTMLElement>(null)
  const songsRef = useRef<HTMLDivElement>(null)
  const [artistIndex, setArtistIndex] = useState(0)
  const artist = artists[artistIndex]

  const [activePad, setActivePad] = useState<number | null>(null)
  const [activeNoteName, setActiveNoteName] = useState<string | null>(null)
  const [mode, setMode] = useState<'piano' | 'pads'>('piano')
  const [statusText, setStatusText] = useState<string>('READY · PLAY PIANO KEYS OR PADS')
  const [waveformPulse, setWaveformPulse] = useState<number>(0)

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [0, -90])
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.96])
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])

  const { scrollYProgress: songsScrollProgress } = useScroll({ target: songsRef, offset: ['start end', 'end start'] })
  const songsX = useTransform(songsScrollProgress, [0, 1], ['2%', '-58%'])

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [5, -5]), { stiffness: 120, damping: 18 })
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-7, 7]), { stiffness: 120, damping: 18 })

  useEffect(() => {
    const timer = window.setInterval(() => setArtistIndex((index) => (index + 1) % artists.length), 4000)
    return () => window.clearInterval(timer)
  }, [])

  const triggerNote = (noteObj: { note: string; freq: number }, isPiano = true, padIdx?: number) => {
    playSound(noteObj.freq, isPiano)
    setActiveNoteName(noteObj.note)
    if (padIdx !== undefined) setActivePad(padIdx)
    setStatusText(`PLAYING NOTE: ${noteObj.note} (${noteObj.freq.toFixed(1)} Hz)`)
    setWaveformPulse((prev) => prev + 1)
    setTimeout(() => {
      setActiveNoteName((curr) => (curr === noteObj.note ? null : curr))
      if (padIdx !== undefined) setActivePad((curr) => (curr === padIdx ? null : curr))
    }, 350)
  }

  const handlePadPress = (index: number) => {
    const p = PAD_NOTES[index]
    if (!p) return
    triggerNote(p, mode === 'piano', index)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const k = e.key.toUpperCase()

      // Check Piano White Keys
      const whiteMatch = WHITE_KEYS.find((w) => w.key === k)
      if (whiteMatch) {
        triggerNote(whiteMatch, true)
        return
      }

      // Check Piano Black Keys
      const blackMatch = BLACK_KEYS.find((b) => b.key === k)
      if (blackMatch) {
        triggerNote(blackMatch, true)
        return
      }

      // Check Pad Notes
      const padIdx = PAD_NOTES.findIndex((p) => p.key === k)
      if (padIdx !== -1) {
        handlePadPress(padIdx)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode])

  const handleMove = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    mouseX.set((event.clientX - rect.left) / rect.width - 0.5)
    mouseY.set((event.clientY - rect.top) / rect.height - 0.5)
  }

  return (
    <div className="sonic-page-root">
      {/* 1. HERO SECTION */}
      <section
        id="top"
        ref={ref}
        onPointerMove={handleMove}
        onPointerLeave={() => {
          mouseX.set(0)
          mouseY.set(0)
        }}
        className="sonic-hero"
      >
        <div className="sonic-hero__spotlight" />
        <div className="sonic-hero__left-light" />
        <div className="sonic-hero__fade" />

        <motion.nav
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="sonic-hero__nav"
        >
          <a href="#top" className="sonic-hero__brand" aria-label="SONIC home">
            <span className="sonic-hero__brand-mark">S</span>
            <span>SONIC</span>
          </a>
          <div className="sonic-hero__links">
            {links.map((link) => <a key={link} href={`#${link.toLowerCase()}`}>{link}</a>)}
          </div>
          <button onClick={() => router.push('/dashboard')} className="sonic-hero__open-app">Open app</button>
        </motion.nav>

        <motion.div style={{ y, scale, opacity }} className="sonic-hero__content">
          <div className="sonic-hero__copy">
            <p className="sonic-hero__eyebrow">Open music, without limits</p>
            <h1 className="sonic-hero__title">
              Hear what&apos;s<br />
              <span className="sonic-gradient-text">next.</span>
            </h1>
            <p className="sonic-hero__description">
              A new home for the music that moves you — discover, collect, and create without missing a beat.
            </p>
            <div className="sonic-hero__actions">
              <Link href="/dashboard" className="sonic-hero__button sonic-hero__button--primary">Start listening</Link>
              <a href="#create" className="sonic-hero__button sonic-hero__button--secondary">Explore studio</a>
            </div>
          </div>

          <motion.div
            style={{ rotateX, rotateY, transformStyle: 'preserve-3d', perspective: 1200 }}
            className="sonic-artist-stage"
          >
            <div className="sonic-artist-stage__frame" />
            <div className="sonic-artist-stage__shadow" />
            <AnimatePresence mode="wait">
              <motion.figure
                key={artist.name}
                initial={{ opacity: 0, x: 45, rotateY: -10, scale: 0.92 }}
                animate={{ opacity: 1, x: 0, rotateY: 0, scale: 1 }}
                exit={{ opacity: 0, x: -45, rotateY: 10, scale: 0.94 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="sonic-artist-card"
                style={{ transform: 'translateZ(50px)' }}
              >
                <img src={artist.image} alt={`Official artwork representing ${artist.name}`} className="sonic-artist-card__image" />
                <div className="sonic-artist-card__shade" />
                <figcaption className="sonic-artist-card__caption">
                  <p className="sonic-artist-card__label">Now in rotation</p>
                  <div className="sonic-artist-card__details">
                    <div>
                      <p className="sonic-artist-card__name">{artist.name}</p>
                      <p className="sonic-artist-card__genre">{artist.genre}</p>
                    </div>
                    <span className="sonic-artist-card__accent" style={{ backgroundColor: artist.accent }} />
                  </div>
                </figcaption>
              </motion.figure>
            </AnimatePresence>

            <div className="sonic-artist-stat" style={{ transform: 'translateZ(90px)' }}>
              <p>1,000+</p>
              <span>open tracks</span>
            </div>
            <div className="sonic-artist-dots" style={{ transform: 'translateZ(85px)' }}>
              {artists.map((item, index) => (
                <button
                  key={item.name}
                  aria-label={`Show ${item.name}`}
                  aria-current={index === artistIndex}
                  onClick={() => setArtistIndex(index)}
                  className={index === artistIndex ? 'is-active' : ''}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* 2. LIBRARY / OPEN-SOURCE SONGS SECTION */}
      <section id="library" ref={songsRef} className="sonic-section">
        <div className="sonic-container">
          <Reveal>
            <p className="sonic-eyebrow sonic-eyebrow--cyan">Open library</p>
            <h2 className="sonic-heading">
              <span className="sonic-gradient-text">1000+</span> open-source
              <br />
              songs, free forever.
            </h2>
            <p className="sonic-lead">
              Every track is community-licensed and open to remix. Stream, download stems, and
              build on what others made — no gatekeeping.
            </p>
          </Reveal>
        </div>

        <motion.div style={{ x: songsX }} className="sonic-tracks-scroll">
          {tracks.map((t) => (
            <div key={t.title} className="sonic-track-card">
              <div className="sonic-track-card__art">
                <img
                  src={t.art}
                  alt={`${t.title} cover artwork`}
                  loading="lazy"
                />
              </div>
              <div className="sonic-track-card__meta">
                <div className="sonic-track-card__info">
                  <p className="sonic-track-card__title">{t.title}</p>
                  <p className="sonic-track-card__artist">{t.artist}</p>
                </div>
                <span className="sonic-track-card__duration">{t.dur}</span>
              </div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* 3. CREATE / CREATION STUDIO SECTION - ORIGINAL PIANO & SYNTH STUDIO */}
      <section id="create" className="sonic-section">
        <div className="sonic-container sonic-wide-container">
          <Reveal className="sonic-studio-top-text">
            <div>
              <p className="sonic-eyebrow sonic-eyebrow--pink">Interactive Sound Studio</p>
              <h2 className="sonic-heading">
                Make your <span className="sonic-gradient-text">own music.</span>
              </h2>
            </div>
            <p className="sonic-lead">
              An interactive acoustic piano console right in your browser. Play piano keys with your mouse or keyboard (A-K / W,E,T,Y,U) to compose original tunes.
            </p>
          </Reveal>

          <Reveal delay={0.15} className="w-full">
            <div className="sonic-glass-panel sonic-studio-wide-panel">
              <div className="sonic-studio-header">
                <div className="sonic-studio-title-wrap">
                  <span className="sonic-pulse-dot" />
                  <p className="sonic-studio-title">REAL-TIME WEB AUDIO PIANO CONSOLE</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="sonic-studio-status-badge">
                    {statusText}
                  </div>
                </div>
              </div>



              {/* Original Piano Keyboard View */}
              <div className="sonic-piano-casing">
                <div className="sonic-piano-brand-bar">
                  <span className="sonic-piano-brand-name">SONIC GRAND PIANO · 25 KEYS (C4 - C6)</span>
                  <span className="text-xs text-white/50 font-mono">PRESS KEYS OR CLICK TO PLAY</span>
                </div>

                <div className="sonic-piano-keys-wrapper">
                  {/* Render White Keys */}
                  <div className="sonic-piano-white-keys">
                    {WHITE_KEYS.map((keyData) => {
                      const isPressed = activeNoteName === keyData.note
                      return (
                        <button
                          key={keyData.note}
                          type="button"
                          onMouseDown={() => triggerNote(keyData, true)}
                          className={`sonic-piano-key sonic-piano-key--white ${isPressed ? 'is-pressed' : ''}`}
                        >
                          <span className="sonic-piano-key__badge">{keyData.key}</span>
                          <span className="sonic-piano-key__note">{keyData.note}</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Render Black Keys */}
                  <div className="sonic-piano-black-keys">
                    {BLACK_KEYS.map((keyData) => {
                      const isPressed = activeNoteName === keyData.note
                      const leftPercent = ((keyData.afterWhiteIndex + 1) / 15) * 100
                      return (
                        <button
                          key={keyData.note}
                          type="button"
                          onMouseDown={() => triggerNote(keyData, true)}
                          style={{ left: `calc(${leftPercent}% - 2.1%)` }}
                          className={`sonic-piano-key sonic-piano-key--black ${isPressed ? 'is-pressed' : ''}`}
                        >
                          <span className="sonic-piano-key__badge">{keyData.key}</span>
                          <span className="sonic-piano-key__note">{keyData.note}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 4. ARTISTS / FAVORITE ARTISTS SECTION */}
      <section id="artists" className="sonic-section">
        <div className="sonic-container">
          <Reveal>
            <p className="sonic-eyebrow sonic-eyebrow--purple">Your rotation</p>
            <h2 className="sonic-heading max-w-2xl">
              The <span className="sonic-gradient-text">artists</span> you can’t stop replaying.
            </h2>
          </Reveal>

          <div className="sonic-artists-grid">
            {artistRotation.map((a, i) => (
              <motion.div
                key={a.name}
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: -a.depth }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.9, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -a.depth - 12 }}
                className="sonic-artist-item"
              >
                <div className="sonic-artist-item__avatar">
                  <div className="sonic-artist-item__img-wrap">
                    <img
                      src={a.image}
                      alt={`Portrait of ${a.name}`}
                      loading="lazy"
                    />
                  </div>
                  <div className="sonic-artist-item__ring" />
                </div>
                <div className="sonic-artist-item__info">
                  <p className="sonic-artist-item__name">{a.name}</p>
                  <p className="sonic-artist-item__tag">
                    {a.tag} · {a.listeners}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. GALLERY SECTION & FOOTER */}
      <section id="gallery" className="sonic-section">
        <div className="sonic-container">
          <Reveal>
            <p className="sonic-eyebrow sonic-eyebrow--cyan">Take a look</p>
            <h2 className="sonic-heading">
              A universe you can <span className="sonic-gradient-text">see.</span>
            </h2>
          </Reveal>

          <div className="sonic-gallery-grid">
            {tiles.map((t, i) => (
              <Reveal
                key={t.id}
                delay={(i % 3) * 0.1}
                className={`sonic-gallery-tile ${t.span}`}
              >
                <div className="sonic-gallery-tile__wrap">
                  <img
                    src={t.image}
                    alt={`${t.label} cover artwork`}
                    loading="lazy"
                  />
                </div>
                <span className="sonic-gallery-tile__label">{t.label}</span>
              </Reveal>
            ))}
          </div>

          <Reveal className="sonic-cta-wrap">
            <div className="sonic-cta-box">
              <h3 className="sonic-cta-title">
                Your sound starts <span className="sonic-gradient-text">here.</span>
              </h3>
              <p className="sonic-cta-desc">
                Join millions on SONIC — stream, create, and share in one glass-smooth space.
              </p>
              <button onClick={() => router.push('/dashboard')} className="sonic-cta-button">
                Get SONIC free
              </button>
            </div>
          </Reveal>
        </div>

        <footer className="sonic-footer">
          <div className="sonic-footer__brand">
            <span className="sonic-footer__mark">S</span>
            <span className="sonic-footer__title">SONIC</span>
          </div>
          <p className="sonic-footer__copyright">© 2026 SONIC · Open music for everyone</p>
        </footer>
      </section>
    </div>
  )
}
