"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Search,
  Play,
  Pause,
  Plus,
  Trash2,
  Volume2,
  VolumeX,
  Music,
  Loader2,
  X,
  ChevronDown,
  Square,
  Mic,
  Copy,
  Lock,
  Unlock,
  Radio,
  Sliders,
  Settings,
  Disc,
  Scissors,
  Clipboard,
  UploadCloud,
  Download,
} from "lucide-react";
import Link from "next/link";
import "./create.css";
import { db, auth } from "../lib/firebase";
import { collection, addDoc, doc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// ── Types ───────────────────────────────────────────────────────────
type FreesoundResult = {
  id: number;
  name: string;
  tags: string[];
  previews: {
    "preview-hq-mp3": string;
    "preview-lq-mp3": string;
    "preview-hq-ogg": string;
    "preview-lq-ogg": string;
  };
  duration: number;
  username: string;
  images?: {
    waveform_l?: string;
    waveform_m?: string;
    spectral_l?: string;
    spectral_m?: string;
  };
};

type ClipItem = {
  id: string;
  name: string;
  previewUrl: string;
  duration: number;
  username: string;
  startBeat: number; // where this clip starts on the timeline (in beats)
  trimStart: number; // seconds trimmed from start
  trimEnd: number; // seconds trimmed from end
  audioBuffer?: AudioBuffer; // Decoded PCM audio data
  peaks?: number[];          // Downsampled amplitude peaks for high-res drawing
  isLoadingAudio?: boolean;
};

type TrackItem = {
  id: string;
  name: string;
  color: string;
  volume: number;
  muted: boolean;
  solo: boolean;
  locked: boolean;
  pan: number; // -1 (Left) to 1 (Right)
  
  // Track Effects parameters
  filterCutoff: number; // 0 to 100 (percentage)
  delayMix: number;     // 0 to 1
  distortion: number;   // 0 to 100
  clips: ClipItem[];
};

// Clipboard type
type ClipboardClip = {
  name: string;
  previewUrl: string;
  duration: number;
  username: string;
  trimStart: number;
  trimEnd: number;
  audioBuffer?: AudioBuffer;
  peaks?: number[];
};

// ── Constants ───────────────────────────────────────────────────────
const CATEGORIES = [
  { label: "Drums", query: "drum loop" },
  { label: "Bass", query: "bass loop" },
  { label: "Synth", query: "synth pad" },
  { label: "Piano", query: "piano loop" },
  { label: "Guitar", query: "guitar riff" },
  { label: "Vocals", query: "vocal chop" },
  { label: "FX", query: "sound effect" },
  { label: "Ambient", query: "ambient texture" },
  { label: "Hi-Hat", query: "hi-hat loop" },
  { label: "Clap", query: "clap sample" },
  { label: "808", query: "808 bass" },
  { label: "Strings", query: "strings loop" },
];

const TRACK_COLORS = [
  "#1db954", // Green
  "#2196f3", // Blue
  "#e91e63", // Pink
  "#ff9800", // Orange
  "#9c27b0", // Purple
  "#00bcd4", // Cyan
  "#ff5722", // Red-Orange
  "#4caf50", // Light Green
];

const BPM_DEFAULT = 120;
const BEATS_PER_BAR = 4;
const TOTAL_BARS = 8;
const TOTAL_BEATS = TOTAL_BARS * BEATS_PER_BAR;
const TRACK_ROW_HEIGHT = 80;
const RULER_HEIGHT = 36;

// Piano notes frequencies for MIDI synth C4 to B5
const PIANO_KEYS = [
  { note: "C4", freq: 261.63, isSharp: false },
  { note: "C#4", freq: 277.18, isSharp: true },
  { note: "D4", freq: 293.66, isSharp: false },
  { note: "D#4", freq: 311.13, isSharp: true },
  { note: "E4", freq: 329.63, isSharp: false },
  { note: "F4", freq: 349.23, isSharp: false },
  { note: "F#4", freq: 369.99, isSharp: true },
  { note: "G4", freq: 392.00, isSharp: false },
  { note: "G#4", freq: 415.30, isSharp: true },
  { note: "A4", freq: 440.00, isSharp: false },
  { note: "A#4", freq: 466.16, isSharp: true },
  { note: "B4", freq: 493.88, isSharp: false },
  { note: "C5", freq: 523.25, isSharp: false },
  { note: "C#5", freq: 554.37, isSharp: true },
  { note: "D5", freq: 587.33, isSharp: false },
  { note: "D#5", freq: 622.25, isSharp: true },
  { note: "E5", freq: 659.25, isSharp: false },
  { note: "F5", freq: 698.46, isSharp: false },
  { note: "F#5", freq: 739.99, isSharp: true },
  { note: "G5", freq: 783.99, isSharp: false },
  { note: "G#5", freq: 830.61, isSharp: true },
  { note: "A5", freq: 880.00, isSharp: false },
  { note: "A#5", freq: 932.33, isSharp: true },
  { note: "B5", freq: 987.77, isSharp: false },
];

// Generate distortion curve
function makeDistortionCurve(amount = 20) {
  const k = amount;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

// Downsample PCM data to get amplitude peaks
function getPeaks(buffer: AudioBuffer, numPeaks = 400): number[] {
  const channelData = buffer.getChannelData(0);
  const step = Math.floor(channelData.length / numPeaks);
  const peaks: number[] = [];
  for (let i = 0; i < numPeaks; i++) {
    let max = 0;
    const start = i * step;
    const end = Math.min(start + step, channelData.length);
    for (let j = start; j < end; j++) {
      const val = Math.abs(channelData[j]);
      if (val > max) max = val;
    }
    peaks.push(max);
  }
  return peaks;
}

// Generate local synthesised drum loop (Kick, Hat, Snare)
function generateKickLoop(ctx: AudioContext): AudioBuffer {
  const bpm = 120;
  const beatDur = 60 / bpm;
  const duration = 8 * beatDur; // 4 seconds
  const sampleRate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const beatIndex = Math.floor(t / beatDur);
    const tBeat = t % beatDur;

    // Kick on every beat
    let kick = 0;
    if (tBeat < 0.25) {
      const freq = 120 * Math.exp(-30 * tBeat) + 45;
      const phase = 2 * Math.PI * freq * tBeat;
      kick = Math.sin(phase) * Math.exp(-12 * tBeat) * 0.7;
    }

    // Hi-hat on offbeats (every half-beat)
    let hat = 0;
    const tHalfBeat = t % (beatDur / 2);
    if (tHalfBeat < 0.05 && Math.floor(t / (beatDur / 2)) % 2 === 1) {
      hat = (Math.random() - 0.5) * Math.exp(-60 * tHalfBeat) * 0.12;
    }

    // Snare on beats 1 and 3 (2nd and 4th quarter beats, or index 1, 3, 5, 7)
    let snare = 0;
    if ((beatIndex % 2 === 1) && tBeat < 0.15) {
      snare = (Math.random() - 0.5) * Math.exp(-20 * tBeat) * 0.25;
    }

    data[i] = kick + hat + snare;
  }
  return buffer;
}

// Generate local synthesised bass line loop
function generateBassLoop(ctx: AudioContext): AudioBuffer {
  const bpm = 120;
  const beatDur = 60 / bpm;
  const duration = 8 * beatDur;
  const sampleRate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);

  // E1 (41.2Hz), G1 (49.0Hz), A1 (55.0Hz), C2 (65.4Hz)
  const freqs = [41.2, 41.2, 49.0, 49.0, 55.0, 55.0, 65.4, 65.4];

  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const beatIndex = Math.floor(t / beatDur) % 8;
    const tBeat = t % beatDur;

    const freq = freqs[beatIndex];
    let val = 0;
    if (tBeat < beatDur * 0.8) {
      const tf = t * freq;
      const tri = 1 - 4 * Math.abs(Math.round(tf - 0.25) - (tf - 0.25));
      val = tri * Math.exp(-4 * tBeat) * 0.5;
    }
    data[i] = val;
  }
  return buffer;
}

// Generate local synthesised chord pad loop
function generateSynthLoop(ctx: AudioContext): AudioBuffer {
  const bpm = 120;
  const beatDur = 60 / bpm;
  const duration = 8 * beatDur;
  const sampleRate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);

  // A3 (220.0), C4 (261.6), E4 (329.6) and C4 (261.6), E4 (329.6), G4 (392.0)
  const chord1 = [220.0, 261.6, 329.6];
  const chord2 = [261.6, 329.6, 392.0];

  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const isFirstHalf = t < duration / 2;
    const chord = isFirstHalf ? chord1 : chord2;
    const tChord = t % (duration / 2);

    let val = 0;
    let env = 0;
    if (tChord < 0.5) env = tChord / 0.5;
    else if (tChord > 1.5) env = Math.max(0, 1 - (tChord - 1.5) / 0.5);
    else env = 1.0;

    chord.forEach((freq) => {
      const tf = t * freq;
      const tri = 1 - 4 * Math.abs(Math.round(tf - 0.25) - (tf - 0.25));
      val += tri;
    });

    data[i] = (val / 3) * env * 0.3;
  }
  return buffer;
}

export default function CreateMusicPage() {

  // Sound library state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]);
  const [sounds, setSounds] = useState<FreesoundResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Deploy / User State
  const [user, setUser] = useState<any>(null);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [deploySongName, setDeploySongName] = useState("");
  const [deployArtistName, setDeployArtistName] = useState("");
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setDeployArtistName(u.displayName || "");
      }
    });
    return () => unsub();
  }, []);

  const [previewPlaying, setPreviewPlaying] = useState<number | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // DAW State (8 fixed tracks like professional studio)
  const [tracks, setTracks] = useState<TrackItem[]>(
    Array.from({ length: 8 }, (_, i) => ({
      id: `track-${i}`,
      name: `Track ${i + 1}`,
      color: TRACK_COLORS[i % TRACK_COLORS.length],
      volume: 0.8,
      muted: false,
      solo: false,
      locked: false,
      pan: 0,
      filterCutoff: 50, // neutral (highpass/lowpass)
      delayMix: 0,
      distortion: 0,
      clips: [],
    }))
  );

  const [bpm, setBpm] = useState(BPM_DEFAULT);
  const [isPlaying, setIsPlaying] = useState(false);
  const [masterVolume, setMasterVolume] = useState(0.8);
  const [projectName, setProjectName] = useState("Pro Studio Project");
  const [showLibrary, setShowLibrary] = useState(true);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(1.0);
  const [selectedTrackIdx, setSelectedTrackIdx] = useState<number>(0);

  // Clip selection, clipboard and inspector state
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<ClipboardClip | null>(null);
  const [activeTab, setActiveTab] = useState<"track" | "clip">("track");

  // Synth Keyboard parameters
  const [synthWaveform, setSynthWaveform] = useState<OscillatorType>("triangle");
  const [synthOctave, setSynthOctave] = useState(0);

  // Micro Recording state
  const [recordingTrackIdx, setRecordingTrackIdx] = useState<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Mutable Refs for 60fps Canvas render loop and background Web Audio scheduler
  const tracksRef = useRef<TrackItem[]>([]);
  const bpmRef = useRef(bpm);
  const isPlayingRef = useRef(false);
  const masterVolumeRef = useRef(masterVolume);
  const currentBeatRef = useRef(0);
  const metronomeEnabledRef = useRef(metronomeEnabled);
  const selectedClipIdRef = useRef<string | null>(null);

  // Audio Context & Graph nodes
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeSourcesRef = useRef<Array<{ source: AudioBufferSourceNode; gainNode: GainNode; trackId: string }>>([]);
  const schedulerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const nextLoopTimeRef = useRef(0);
  const playbackStartCtxTimeRef = useRef(0);
  const playbackStartOffsetRef = useRef(0);

  // Live Analysis & VU meter node refs
  const trackNodesRef = useRef<
    Array<{
      gainNode: GainNode;
      pannerNode: StereoPannerNode;
      filterNode: BiquadFilterNode;
      delayNode: DelayNode;
      delayGain: GainNode;
      distNode: WaveShaperNode;
      analyserNode: AnalyserNode;
    }>
  >([]);

  // Sync refs to state updates
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { masterVolumeRef.current = masterVolume; }, [masterVolume]);
  useEffect(() => { metronomeEnabledRef.current = metronomeEnabled; }, [metronomeEnabled]);
  useEffect(() => { selectedClipIdRef.current = selectedClipId; }, [selectedClipId]);

  // ── Web Audio Graph Initialization ─────────────────────────────────
  const initAudioCtx = () => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      // Initialize audio effects chain for all 8 track lanes
      trackNodesRef.current = Array.from({ length: 8 }, () => {
        const gainNode = ctx.createGain();
        const pannerNode = ctx.createStereoPanner();
        const filterNode = ctx.createBiquadFilter();
        const delayNode = ctx.createDelay(1.0);
        const delayGain = ctx.createGain();
        const distNode = ctx.createWaveShaper();
        const analyserNode = ctx.createAnalyser();

        analyserNode.fftSize = 64;

        // Default configs
        filterNode.type = "peaking";
        filterNode.frequency.value = 1000;
        filterNode.Q.value = 1;
        filterNode.gain.value = 0;

        delayNode.delayTime.value = 0.3;
        delayGain.gain.value = 0.0; // Mix level

        distNode.curve = makeDistortionCurve(0);
        distNode.oversample = "4x";

        // Chain nodes: Source -> Panner -> Filter (EQ) -> Distortion -> Delay -> Gain -> Analyser -> Output
        // Delay feedback chain
        delayNode.connect(delayGain);
        delayGain.connect(delayNode); // Feedback loop

        pannerNode.connect(filterNode);
        filterNode.connect(distNode);
        distNode.connect(gainNode);
        gainNode.connect(analyserNode);

        // Mix delay in parallel
        distNode.connect(delayNode);
        delayGain.connect(gainNode);

        analyserNode.connect(ctx.destination);

        return { gainNode, pannerNode, filterNode, delayNode, delayGain, distNode, analyserNode };
      });
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Sync track effects parameters to nodes
  const updateTrackNodes = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    tracks.forEach((track, index) => {
      const nodes = trackNodesRef.current[index];
      if (!nodes) return;

      // 1. Mute & Volume
      nodes.gainNode.gain.setValueAtTime(
        track.muted ? 0 : track.volume * masterVolume,
        ctx.currentTime
      );

      // 2. Pan
      nodes.pannerNode.pan.setValueAtTime(track.pan, ctx.currentTime);

      // 3. Lowpass/Highpass filter
      if (track.filterCutoff < 45) {
        // Cut highs (Lowpass)
        nodes.filterNode.type = "lowpass";
        const hz = Math.max(100, (track.filterCutoff / 45) * 5000);
        nodes.filterNode.frequency.setValueAtTime(hz, ctx.currentTime);
      } else if (track.filterCutoff > 55) {
        // Cut lows (Highpass)
        nodes.filterNode.type = "highpass";
        const hz = Math.max(50, ((track.filterCutoff - 55) / 45) * 8000);
        nodes.filterNode.frequency.setValueAtTime(hz, ctx.currentTime);
      } else {
        // Flat response
        nodes.filterNode.type = "peaking";
        nodes.filterNode.frequency.setValueAtTime(1000, ctx.currentTime);
        nodes.filterNode.gain.setValueAtTime(0, ctx.currentTime);
      }

      // 4. Delay Mix
      nodes.delayGain.gain.setValueAtTime(track.delayMix * 0.6, ctx.currentTime);

      // 5. Distortion
      nodes.distNode.curve = makeDistortionCurve(track.distortion);
    });
  }, [tracks, masterVolume]);

  useEffect(() => {
    updateTrackNodes();
  }, [tracks, masterVolume, updateTrackNodes]);

  // ── Auto load high-quality demo loops on mount ───────────────────
  useEffect(() => {
    const ctx = initAudioCtx();

    // Programmatically generate beautiful studio loops locally (100% offline, robust)
    const drumBuffer = generateKickLoop(ctx);
    const bassBuffer = generateBassLoop(ctx);
    const synthBuffer = generateSynthLoop(ctx);

    const buffers = [drumBuffer, synthBuffer, bassBuffer];
    const names = ["120 BPM House Drum Loop", "Warm Chord Pad", "Pluck Bassline"];

    setTracks((prev) =>
      prev.map((t, idx) => {
        const buf = buffers[idx];
        const name = names[idx];
        if (buf) {
          const peaks = getPeaks(buf, 400);
          const clipId1 = `clip-demo-${idx}-1`;
          const clip1: ClipItem = {
            id: clipId1,
            name: `${name} A`,
            previewUrl: `local-synth-${idx}-1`,
            duration: buf.duration,
            username: "Sonic",
            startBeat: 0,
            trimStart: 0,
            trimEnd: 0,
            audioBuffer: buf,
            peaks,
            isLoadingAudio: false,
          };

          // On Track 1 (Drums), place an extra side-by-side clip at beat 4!
          if (idx === 0) {
            const clipId2 = `clip-demo-${idx}-2`;
            const clip2: ClipItem = {
              id: clipId2,
              name: `${name} B`,
              previewUrl: `local-synth-${idx}-2`,
              duration: buf.duration,
              username: "Sonic",
              startBeat: 4, // placed side by side
              trimStart: 0,
              trimEnd: 0,
              audioBuffer: buf,
              peaks,
              isLoadingAudio: false,
            };
            return {
              ...t,
              name: `Drums Lane`,
              clips: [clip1, clip2],
            };
          }

          return {
            ...t,
            name: idx === 1 ? `Synth Lane` : `Bass Lane`,
            clips: [clip1],
          };
        }
        return t;
      })
    );
  }, []);

  // ── Audio Source Controller & Loop Scheduler ──────────────────────
  const stopAllAudioSources = () => {
    activeSourcesRef.current.forEach((item) => {
      try {
        item.source.stop();
      } catch (e) {}
    });
    activeSourcesRef.current = [];
  };

  const scheduleMetronomeClick = (beatTime: number, beatIndex: number) => {
    const ctx = audioCtxRef.current;
    if (!ctx || !metronomeEnabledRef.current) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(beatIndex % BEATS_PER_BAR === 0 ? 1000 : 800, beatTime);

    gain.gain.setValueAtTime(0.3, beatTime);
    gain.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(beatTime);
    osc.stop(beatTime + 0.06);
  };

  const scheduleLoopIteration = (loopStartTime: number) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const beatDur = 60 / bpmRef.current;
    const loopDur = TOTAL_BEATS * beatDur;

    // Schedule Metronome ticks for this entire loop iteration
    for (let b = 0; b < TOTAL_BEATS; b++) {
      const tickTime = loopStartTime + b * beatDur;
      if (tickTime >= ctx.currentTime) {
        scheduleMetronomeClick(tickTime, b);
      }
    }

    tracksRef.current.forEach((track, index) => {
      if (track.muted || !track.clips) return;

      track.clips.forEach((clip) => {
        if (!clip.audioBuffer) return;

        const clipStartOffset = clip.startBeat * beatDur;
        const playDuration = clip.duration - clip.trimStart - clip.trimEnd;
        if (playDuration <= 0) return;

        const clipStartCtxTime = loopStartTime + clipStartOffset;
        const clipEndCtxTime = clipStartCtxTime + playDuration;

        const currentCtxTime = ctx.currentTime;
        let startOffset = clip.trimStart;
        let targetStartTime = clipStartCtxTime;

        // Handle playhead wrapping and seeks
        if (clipStartCtxTime < currentCtxTime) {
          if (clipEndCtxTime <= currentCtxTime) return;
          startOffset = clip.trimStart + (currentCtxTime - clipStartCtxTime);
          targetStartTime = currentCtxTime;
        }

        const source = ctx.createBufferSource();
        source.buffer = clip.audioBuffer;
        source.loop = true; // Enables looping when actualDuration > buffer duration
        source.loopStart = clip.trimStart;
        source.loopEnd = clip.duration - Math.max(0, clip.trimEnd);

        // Connect to respective track FX node chain
        const nodes = trackNodesRef.current[index];
        if (nodes) {
          source.connect(nodes.pannerNode);
        }

        const actualDuration = playDuration - (startOffset - clip.trimStart);
        if (actualDuration > 0) {
          source.start(targetStartTime, startOffset, actualDuration);
          activeSourcesRef.current.push({ source, gainNode: nodes.gainNode, trackId: track.id });
        }
      });
    });
  };

  const startPlayback = () => {
    const ctx = initAudioCtx();
    const beatDur = 60 / bpmRef.current;
    const loopDur = TOTAL_BEATS * beatDur;

    stopAllAudioSources();

    const startCtxTime = ctx.currentTime;
    playbackStartCtxTimeRef.current = startCtxTime;
    playbackStartOffsetRef.current = currentBeatRef.current * beatDur;

    const loopStartTime = startCtxTime - playbackStartOffsetRef.current;
    nextLoopTimeRef.current = loopStartTime + loopDur;

    scheduleLoopIteration(loopStartTime);
    setIsPlaying(true);

    schedulerIntervalRef.current = setInterval(() => {
      const now = ctx.currentTime;
      if (now + 0.8 > nextLoopTimeRef.current) {
        scheduleLoopIteration(nextLoopTimeRef.current);
        nextLoopTimeRef.current += loopDur;
      }
    }, 100);
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    if (schedulerIntervalRef.current) {
      clearInterval(schedulerIntervalRef.current);
      schedulerIntervalRef.current = null;
    }
    stopAllAudioSources();
    currentBeatRef.current = 0;
  };

  const togglePlayback = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  };

  const reschedulePlayback = () => {
    if (!isPlayingRef.current) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    stopAllAudioSources();

    const beatDur = 60 / bpmRef.current;
    const loopDur = TOTAL_BEATS * beatDur;
    const startCtxTime = ctx.currentTime;

    playbackStartCtxTimeRef.current = startCtxTime;
    playbackStartOffsetRef.current = currentBeatRef.current * beatDur;

    const loopStartTime = startCtxTime - playbackStartOffsetRef.current;
    nextLoopTimeRef.current = loopStartTime + loopDur;

    scheduleLoopIteration(loopStartTime);
  };

  // ── Fetch sounds from Freesound API ──────────────────────────────
  const fetchSounds = useCallback(async (query: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/freesound?query=${encodeURIComponent(query)}&page_size=20`
      );
      const data = await res.json();
      if (data.results) {
        setSounds(data.results);
      }
    } catch (e) {
      console.error("Failed to fetch sounds:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSounds(activeCategory.query);
  }, [activeCategory, fetchSounds]);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      fetchSounds(searchQuery.trim());
    }
  };

  // ── Sound Preview Library ─────────────────────────────────────────
  const togglePreview = (sound: FreesoundResult) => {
    if (previewPlaying === sound.id) {
      previewAudioRef.current?.pause();
      setPreviewPlaying(null);
      return;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    const audio = new Audio(sound.previews["preview-hq-mp3"]);
    audio.volume = 0.5;
    audio.play().catch(console.error);
    audio.onended = () => setPreviewPlaying(null);
    previewAudioRef.current = audio;
    setPreviewPlaying(sound.id);
  };

  // ── Load Audio Buffer for Clip ────────────────────────────────────
  const loadAudioBufferForClip = async (trackId: string, clipId: string, url: string, name: string) => {
    try {
      const ctx = initAudioCtx();
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP status ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const peaks = getPeaks(audioBuffer, 400);

      setTracks((prev) =>
        prev.map((t) =>
          t.id === trackId
            ? {
                ...t,
                clips: t.clips.map((c) =>
                  c.id === clipId
                    ? {
                        ...c,
                        audioBuffer,
                        peaks,
                        duration: audioBuffer.duration,
                        isLoadingAudio: false,
                      }
                    : c
                ),
              }
            : t
        )
      );
      setTimeout(() => reschedulePlayback(), 50);
    } catch (e) {
      console.warn("Failed to decode audio, synthesizing placeholder beep:", e);
      try {
        const ctx = initAudioCtx();
        const sampleRate = ctx.sampleRate;
        const duration = 2.0; // 2 seconds placeholder
        const audioBuffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
        const data = audioBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] = Math.sin(2 * Math.PI * 440 * (i / sampleRate)) * Math.exp(-4 * (i / sampleRate)) * 0.3;
        }
        const peaks = getPeaks(audioBuffer, 400);

        setTracks((prev) =>
          prev.map((t) =>
            t.id === trackId
              ? {
                  ...t,
                  clips: t.clips.map((c) =>
                    c.id === clipId
                      ? {
                          ...c,
                          name: `${name} (CORS / Load Error)`,
                          audioBuffer,
                          peaks,
                          duration: audioBuffer.duration,
                          isLoadingAudio: false,
                        }
                      : c
                  ),
                }
              : t
          )
        );
      } catch (err) {
        console.error("Synthesizer fallback failed:", err);
        setTracks((prev) =>
          prev.map((t) =>
            t.id === trackId
              ? {
                  ...t,
                  clips: t.clips.map((c) =>
                    c.id === clipId ? { ...c, isLoadingAudio: false } : c
                  ),
                }
              : t
          )
        );
      }
    }
  };

  // ── Drag and Drop onto timeline rows ──────────────────────────────
  const handleDragStart = (e: React.DragEvent, sound: FreesoundResult) => {
    e.dataTransfer.setData("text/plain", JSON.stringify(sound));
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const trackIndex = Math.floor((y - RULER_HEIGHT) / TRACK_ROW_HEIGHT);

    if (trackIndex < 0 || trackIndex >= 8) return;

    const track = tracks[trackIndex];
    if (track.locked) return;

    try {
      const soundDataStr = e.dataTransfer.getData("text/plain");
      if (!soundDataStr) return;
      const sound = JSON.parse(soundDataStr) as FreesoundResult;

      const beatDur = 60 / bpm;
      const timelineWidth = canvas.width;
      // Snapping to 0.25 beat
      const dropBeat = Math.max(0, Math.round((x / timelineWidth) * TOTAL_BEATS * 4) / 4);

      const clipId = `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newClip: ClipItem = {
        id: clipId,
        name: sound.name,
        previewUrl: sound.previews["preview-hq-mp3"],
        duration: sound.duration,
        username: sound.username,
        startBeat: dropBeat,
        trimStart: 0,
        trimEnd: 0,
        isLoadingAudio: true,
      };

      setTracks((prev) =>
        prev.map((t, idx) =>
          idx === trackIndex ? { ...t, clips: [...t.clips, newClip] } : t
        )
      );

      setSelectedClipId(clipId);
      setActiveTab("clip");

      loadAudioBufferForClip(track.id, clipId, sound.previews["preview-hq-mp3"], sound.name);
    } catch (err) {
      console.error(err);
    }
  };

  // ── Micro Recording directly to a track ───────────────────────────
  const startRecording = async (trackIdx: number) => {
    initAudioCtx();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        const arrayBuffer = await audioBlob.arrayBuffer();
        const ctx = audioCtxRef.current;
        if (ctx) {
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          const peaks = getPeaks(audioBuffer, 400);

          const clipId = `clip-rec-${Date.now()}`;
          const currentBeat = currentBeatRef.current;
          const newClip: ClipItem = {
            id: clipId,
            name: `Mic Rec #${trackIdx + 1}`,
            previewUrl: `local-rec-${clipId}`,
            duration: audioBuffer.duration,
            username: "You",
            startBeat: Math.max(0, Math.round(currentBeat * 4) / 4),
            trimStart: 0,
            trimEnd: 0,
            audioBuffer,
            peaks,
            isLoadingAudio: false,
          };

          setTracks((prev) =>
            prev.map((t, idx) =>
              idx === trackIdx
                ? {
                    ...t,
                    clips: [...t.clips, newClip],
                  }
                : t
            )
          );
          setSelectedClipId(clipId);
          setActiveTab("clip");
          setTimeout(() => reschedulePlayback(), 50);
        }
        setRecordingTrackIdx(null);
      };

      mediaRecorder.start();
      setRecordingTrackIdx(trackIdx);
    } catch (e) {
      console.error("Recording access denied:", e);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const toggleRecording = (trackIdx: number) => {
    if (recordingTrackIdx === trackIdx) {
      stopRecording();
    } else {
      startRecording(trackIdx);
    }
  };

  // ── Keyboard Synthesizer Jammer ───────────────────────────────────
  const playSynthNote = (freq: number) => {
    const ctx = initAudioCtx();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = synthWaveform;
    // Apply octave shift
    const shiftedFreq = freq * Math.pow(2, synthOctave);
    osc.frequency.setValueAtTime(shiftedFreq, ctx.currentTime);

    gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.8);
  };

  // ── Helper to Get Selected Clip Details ───────────────────────────
  const getSelectedClip = (): ClipItem | null => {
    if (!selectedClipId) return null;
    for (const track of tracks) {
      const clip = track.clips.find((c) => c.id === selectedClipId);
      if (clip) return clip;
    }
    return null;
  };

  const updateSelectedClipValue = (key: keyof ClipItem, val: any) => {
    if (!selectedClipId) return;
    setTracks((prev) =>
      prev.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === selectedClipId ? { ...c, [key]: val } : c
        ),
      }))
    );
    setTimeout(() => reschedulePlayback(), 50);
  };

  // ── Cut / Copy / Paste / Delete / Split Actions ────────────────────
  const handleCut = useCallback(() => {
    if (!selectedClipId) return;
    let clipToCut: ClipItem | null = null;
    for (const t of tracks) {
      const found = t.clips.find((c) => c.id === selectedClipId);
      if (found) {
        clipToCut = found;
        break;
      }
    }

    if (!clipToCut) return;

    setClipboard({
      name: clipToCut.name,
      previewUrl: clipToCut.previewUrl,
      duration: clipToCut.duration,
      username: clipToCut.username,
      trimStart: clipToCut.trimStart,
      trimEnd: clipToCut.trimEnd,
      audioBuffer: clipToCut.audioBuffer,
      peaks: clipToCut.peaks,
    });

    setTracks((prev) =>
      prev.map((t) => ({
        ...t,
        clips: t.clips.filter((c) => c.id !== selectedClipId),
      }))
    );
    setSelectedClipId(null);
    setTimeout(() => reschedulePlayback(), 50);
  }, [selectedClipId, tracks]);

  const handleCopy = useCallback(() => {
    if (!selectedClipId) return;
    let clipToCopy: ClipItem | null = null;
    for (const t of tracks) {
      const found = t.clips.find((c) => c.id === selectedClipId);
      if (found) {
        clipToCopy = found;
        break;
      }
    }

    if (!clipToCopy) return;

    setClipboard({
      name: clipToCopy.name,
      previewUrl: clipToCopy.previewUrl,
      duration: clipToCopy.duration,
      username: clipToCopy.username,
      trimStart: clipToCopy.trimStart,
      trimEnd: clipToCopy.trimEnd,
      audioBuffer: clipToCopy.audioBuffer,
      peaks: clipToCopy.peaks,
    });
  }, [selectedClipId, tracks]);

  const handlePaste = useCallback(() => {
    if (!clipboard) return;
    const targetTrackIdx = selectedTrackIdx;
    if (targetTrackIdx < 0 || targetTrackIdx >= 8) return;

    const targetTrack = tracks[targetTrackIdx];
    if (targetTrack.locked) return;

    const clipId = `clip-paste-${Date.now()}`;
    const currentBeat = currentBeatRef.current;

    const pastedClip: ClipItem = {
      id: clipId,
      name: `${clipboard.name} (Copy)`,
      previewUrl: clipboard.previewUrl,
      duration: clipboard.duration,
      username: clipboard.username,
      startBeat: Math.max(0, Math.round(currentBeat * 4) / 4), // snap to 0.25 beat
      trimStart: clipboard.trimStart,
      trimEnd: clipboard.trimEnd,
      audioBuffer: clipboard.audioBuffer,
      peaks: clipboard.peaks,
      isLoadingAudio: false,
    };

    setTracks((prev) =>
      prev.map((t, idx) =>
        idx === targetTrackIdx
          ? { ...t, clips: [...t.clips, pastedClip] }
          : t
      )
    );
    setSelectedClipId(clipId);
    setActiveTab("clip");
    setTimeout(() => reschedulePlayback(), 50);
  }, [clipboard, selectedTrackIdx, tracks]);

  const handleDelete = useCallback(() => {
    if (!selectedClipId) return;
    setTracks((prev) =>
      prev.map((t) => ({
        ...t,
        clips: t.clips.filter((c) => c.id !== selectedClipId),
      }))
    );
    setSelectedClipId(null);
    setTimeout(() => reschedulePlayback(), 50);
  }, [selectedClipId]);

  const handleSplit = useCallback(() => {
    if (!selectedClipId) return;
    const beatDur = 60 / bpm;
    const currentBeat = currentBeatRef.current;

    let targetTrackIdx = -1;
    let targetClip: ClipItem | null = null;

    for (let trackIdx = 0; trackIdx < tracks.length; trackIdx++) {
      const found = tracks[trackIdx].clips.find((c) => c.id === selectedClipId);
      if (found) {
        targetTrackIdx = trackIdx;
        targetClip = found;
        break;
      }
    }

    if (targetTrackIdx === -1 || !targetClip) return;

    const clip: ClipItem = targetClip;
    const clipPlayDuration = clip.duration - clip.trimStart - clip.trimEnd;
    const clipWidthBeats = clipPlayDuration / beatDur;

    // Check if playhead intersects the clip
    if (currentBeat > clip.startBeat && currentBeat < clip.startBeat + clipWidthBeats) {
      const splitTimeInClipSeconds = clip.trimStart + (currentBeat - clip.startBeat) * beatDur;

      const leftClip: ClipItem = {
        ...clip,
        id: `clip-split-L-${Date.now()}`,
        name: `${clip.name} (Part 1)`,
        trimEnd: clip.duration - splitTimeInClipSeconds,
      };

      const rightClip: ClipItem = {
        ...clip,
        id: `clip-split-R-${Date.now()}`,
        name: `${clip.name} (Part 2)`,
        startBeat: Math.round(currentBeat * 4) / 4, // Snap to 0.25 beat
        trimStart: splitTimeInClipSeconds,
      };

      setTracks((prev) =>
        prev.map((t, idx) => {
          if (idx !== targetTrackIdx) return t;
          const newClips = t.clips.filter((c) => c.id !== selectedClipId);
          return {
            ...t,
            clips: [...newClips, leftClip, rightClip],
          };
        })
      );

      setSelectedClipId(rightClip.id); // select right part after split
      setActiveTab("clip");
      setTimeout(() => reschedulePlayback(), 50);
    }
  }, [selectedClipId, bpm, tracks]);

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (e.code === "Space") {
        e.preventDefault();
        if (isPlayingRef.current) {
          stopPlayback();
        } else {
          startPlayback();
        }
      } else if (cmdOrCtrl && e.key.toLowerCase() === "c") {
        e.preventDefault();
        handleCopy();
      } else if (cmdOrCtrl && e.key.toLowerCase() === "x") {
        e.preventDefault();
        handleCut();
      } else if (cmdOrCtrl && e.key.toLowerCase() === "v") {
        e.preventDefault();
        handlePaste();
      } else if (e.code === "Delete" || e.code === "Backspace") {
        e.preventDefault();
        handleDelete();
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSplit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCopy, handleCut, handlePaste, handleDelete, handleSplit]);

  // ── 60fps Canvas render loop & direct DOM updates ────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const timelineWidth = canvas.width;
      const timelineHeight = canvas.height;

      // Update playhead clock in real-time
      if (isPlayingRef.current && audioCtxRef.current) {
        const beatDur = 60 / bpmRef.current;
        const elapsed = audioCtxRef.current.currentTime - playbackStartCtxTimeRef.current + playbackStartOffsetRef.current;
        currentBeatRef.current = (elapsed / beatDur) % TOTAL_BEATS;
      }

      // 60fps VU meters direct DOM manipulation (No React renders!)
      tracksRef.current.forEach((track) => {
        const nodes = trackNodesRef.current.find((_, i) => tracksRef.current[i].id === track.id);
        const vuBar = document.getElementById(`vu-bar-${track.id}`);
        if (nodes && vuBar) {
          const dataArray = new Uint8Array(nodes.analyserNode.frequencyBinCount);
          nodes.analyserNode.getByteTimeDomainData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const val = (dataArray[i] - 128) / 128;
            sum += val * val;
          }
          const rms = Math.sqrt(sum / dataArray.length);
          const percentage = Math.min(100, Math.round(rms * 500));
          vuBar.style.width = `${percentage}%`;
        }
      });

      // Canvas Draw Timeline Grid
      ctx.fillStyle = "#090c0a";
      ctx.fillRect(0, 0, timelineWidth, timelineHeight);

      const beatWidth = timelineWidth / TOTAL_BEATS;

      // Draw Grid Verticals
      for (let i = 0; i <= TOTAL_BEATS; i++) {
        const x = i * beatWidth;
        const isBar = i % BEATS_PER_BAR === 0;
        ctx.strokeStyle = isBar ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.03)";
        ctx.lineWidth = isBar ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(x, RULER_HEIGHT);
        ctx.lineTo(x, timelineHeight);
        ctx.stroke();
      }

      // Draw horizontal track lanes
      for (let i = 0; i <= 8; i++) {
        const y = RULER_HEIGHT + i * TRACK_ROW_HEIGHT;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(timelineWidth, y);
        ctx.stroke();
      }

      // Render Clip blocks on lanes
      tracksRef.current.forEach((track, index) => {
        const clipTop = RULER_HEIGHT + index * TRACK_ROW_HEIGHT + 6;
        const clipHeight = TRACK_ROW_HEIGHT - 12;

        if (track.clips && track.clips.length > 0) {
          track.clips.forEach((clip) => {
            const beatDur = 60 / bpmRef.current;
            const playDuration = clip.duration - clip.trimStart - clip.trimEnd;
            const clipWidthBeats = playDuration / beatDur;

            const clipLeft = (clip.startBeat / TOTAL_BEATS) * timelineWidth;
            const clipWidth = (clipWidthBeats / TOTAL_BEATS) * timelineWidth;

            if (clipWidth > 5) {
              const isSelected = clip.id === selectedClipIdRef.current;

              // Clip container
              ctx.fillStyle = track.color;
              ctx.strokeStyle = isSelected ? "#ffffff" : "rgba(0, 0, 0, 0.4)";
              ctx.lineWidth = isSelected ? 2.5 : 1;
              ctx.beginPath();
              ctx.roundRect(clipLeft, clipTop, clipWidth, clipHeight, 4);
              ctx.fill();
              ctx.stroke();

              // Highlight selected border glow
              if (isSelected) {
                ctx.strokeStyle = "#ffcc00"; // gold
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.roundRect(clipLeft - 1, clipTop - 1, clipWidth + 2, clipHeight + 2, 5);
                ctx.stroke();
              }

              // Draw PCM Waveforms
              if (clip.peaks && clip.peaks.length > 0) {
                const numPeaks = clip.peaks.length;
                const startIdx = Math.max(0, Math.floor((clip.trimStart / clip.duration) * numPeaks));
                const endIdx = Math.floor(((clip.duration - clip.trimEnd) / clip.duration) * numPeaks);
                
                const visiblePeaks = [];
                if (numPeaks > 0) {
                  for (let j = startIdx; j < endIdx; j++) {
                    visiblePeaks.push(clip.peaks[j % numPeaks] || 0);
                  }
                }

                ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                for (let i = 0; i < clipWidth; i++) {
                  const pct = i / clipWidth;
                  const peakIdx = Math.floor(pct * visiblePeaks.length);
                  const amp = visiblePeaks[peakIdx] || 0;
                  const waveHeight = amp * (clipHeight - 16);
                  const x = clipLeft + i;
                  const y1 = clipTop + clipHeight / 2 - waveHeight / 2;
                  const y2 = clipTop + clipHeight / 2 + waveHeight / 2;
                  ctx.moveTo(x, y1);
                  ctx.lineTo(x, y2);
                }
                ctx.stroke();
              }

              if (clip.isLoadingAudio) {
                ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
                ctx.fillRect(clipLeft, clipTop, clipWidth, clipHeight);
                ctx.fillStyle = "#ffffff";
                ctx.font = "bold 9px sans-serif";
                ctx.textAlign = "center";
                ctx.fillText("LOADING...", clipLeft + clipWidth / 2, clipTop + clipHeight / 2 + 3);
              } else {
                ctx.fillStyle = "#000000";
                ctx.font = "bold 9.5px sans-serif";
                ctx.textAlign = "left";
                ctx.fillText(clip.name, clipLeft + 8, clipTop + 14);
              }

              // Left/Right handle indicators
              ctx.fillStyle = isSelected ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.15)";
              ctx.fillRect(clipLeft, clipTop, 6, clipHeight);
              ctx.fillRect(clipLeft + clipWidth - 6, clipTop, 6, clipHeight);
            }
          });
        } else {
          ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
          ctx.font = "italic 9px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("Drag sound here or click Mic to record", timelineWidth / 2, clipTop + clipHeight / 2 + 3);
        }
      });

      // Ruler header
      ctx.fillStyle = "#0e110f";
      ctx.fillRect(0, 0, timelineWidth, RULER_HEIGHT);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.beginPath();
      ctx.moveTo(0, RULER_HEIGHT);
      ctx.lineTo(timelineWidth, RULER_HEIGHT);
      ctx.stroke();

      for (let i = 0; i < TOTAL_BEATS; i++) {
        const x = i * beatWidth;
        const isBar = i % BEATS_PER_BAR === 0;
        ctx.strokeStyle = isBar ? "rgba(255, 255, 255, 0.35)" : "rgba(255, 255, 255, 0.12)";
        ctx.beginPath();
        ctx.moveTo(x, RULER_HEIGHT - (isBar ? 12 : 6));
        ctx.lineTo(x, RULER_HEIGHT);
        ctx.stroke();

        if (isBar) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
          ctx.font = "bold 9px sans-serif";
          ctx.textAlign = "left";
          ctx.fillText((Math.floor(i / BEATS_PER_BAR) + 1).toString(), x + 4, RULER_HEIGHT - 16);
        }
      }

      // Red Playhead Line
      const playheadX = (currentBeatRef.current / TOTAL_BEATS) * timelineWidth;
      ctx.strokeStyle = "#ff3b30";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, timelineHeight);
      ctx.stroke();

      // Red triangle handle
      ctx.fillStyle = "#ff3b30";
      ctx.beginPath();
      ctx.moveTo(playheadX - 6, 0);
      ctx.lineTo(playheadX + 6, 0);
      ctx.lineTo(playheadX, 10);
      ctx.closePath();
      ctx.fill();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Update canvas width automatically on zoom / resize
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateDimensions = () => {
      canvas.width = container.clientWidth * timelineZoom;
      canvas.height = RULER_HEIGHT + 8 * TRACK_ROW_HEIGHT;
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(() => updateDimensions());
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [timelineZoom]);

  // ── Interactive seeking & dragging ──────────────────────────────
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;

    const timelineWidth = canvas.width;
    const beatDur = 60 / bpm;

    // 1. Ruler region click -> Seeking playhead
    if (startY < RULER_HEIGHT) {
      const updateSeek = (clientX: number) => {
        const x = Math.max(0, Math.min(timelineWidth, clientX - rect.left));
        currentBeatRef.current = (x / timelineWidth) * TOTAL_BEATS;
        reschedulePlayback();
      };

      updateSeek(e.clientX);

      const onPointerMove = (ev: PointerEvent) => updateSeek(ev.clientX);
      const onPointerUp = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      return;
    }

    // 2. Track lane -> Drag/Trim
    const trackIndex = Math.floor((startY - RULER_HEIGHT) / TRACK_ROW_HEIGHT);
    if (trackIndex < 0 || trackIndex >= 8) {
      setSelectedClipId(null);
      return;
    }

    const track = tracks[trackIndex];
    setSelectedTrackIdx(trackIndex);

    if (track.locked) {
      setSelectedClipId(null);
      return;
    }

    // Find if user clicked on a clip in this track
    let clickedClip: ClipItem | null = null;
    track.clips.forEach((clip) => {
      const clipLeft = (clip.startBeat / TOTAL_BEATS) * timelineWidth;
      const playDuration = clip.duration - clip.trimStart - clip.trimEnd;
      const clipWidthBeats = playDuration / beatDur;
      const clipWidth = (clipWidthBeats / TOTAL_BEATS) * timelineWidth;
      const clipRight = clipLeft + clipWidth;

      if (startX >= clipLeft && startX <= clipRight) {
        clickedClip = clip;
      }
    });

    if (!clickedClip) {
      setSelectedClipId(null);
      return;
    }

    const clip = clickedClip as ClipItem;
    setSelectedClipId(clip.id);
    setActiveTab("clip");

    const clipLeft = (clip.startBeat / TOTAL_BEATS) * timelineWidth;
    const playDuration = clip.duration - clip.trimStart - clip.trimEnd;
    const clipWidthBeats = playDuration / beatDur;
    const clipWidth = (clipWidthBeats / TOTAL_BEATS) * timelineWidth;
    const clipRight = clipLeft + clipWidth;

    const isTrimLeft = startX - clipLeft < 12;
    const isTrimRight = clipRight - startX < 12;

    const initialStartBeat = clip.startBeat;
    const initialTrimStart = clip.trimStart;
    const initialTrimEnd = clip.trimEnd;
    const dur = clip.duration;

    let currentTrackId = track.id;

    const onPointerMove = (ev: PointerEvent) => {
      const deltaX = ev.clientX - rect.left - startX;
      // Snap to 0.25 beat
      const deltaBeats = Math.round((deltaX / timelineWidth) * TOTAL_BEATS * 4) / 4;
      const deltaSeconds = (deltaX / timelineWidth) * (TOTAL_BEATS * beatDur);

      const currentY = ev.clientY - rect.top;
      const targetTrackIdx = Math.max(0, Math.min(7, Math.floor((currentY - RULER_HEIGHT) / TRACK_ROW_HEIGHT)));
      const targetTrackId = `track-${targetTrackIdx}`;

      setTracks((prev) => {
        let actualSourceTrackId = currentTrackId;
        prev.forEach((t) => {
          if (t.clips.some((c) => c.id === clip.id)) {
            actualSourceTrackId = t.id;
          }
        });

        const targetTrack = prev[targetTrackIdx];
        if (targetTrack?.locked) return prev;

        return prev.map((t, idx) => {
          if (isTrimLeft || isTrimRight) {
            if (t.id !== actualSourceTrackId) return t;
            return {
              ...t,
              clips: t.clips.map((c) => {
                if (c.id !== clip.id) return c;
                if (isTrimLeft) {
                  let newTrim = initialTrimStart + deltaSeconds;
                  if (newTrim < 0) newTrim = 0;
                  if (newTrim > dur - c.trimEnd - 0.1) newTrim = dur - c.trimEnd - 0.1;
                  let newStart = Math.max(0, initialStartBeat + deltaBeats);
                  return { ...c, trimStart: newTrim, startBeat: newStart };
                } else {
                  let newTrim = initialTrimEnd - deltaSeconds;
                  if (newTrim > dur - c.trimStart - 0.1) newTrim = dur - c.trimStart - 0.1;
                  return { ...c, trimEnd: newTrim };
                }
              }),
            };
          } else {
            // Drag moving clip horizontally and vertically
            const isSource = t.id === actualSourceTrackId;
            const isTarget = t.id === targetTrackId;

            if (isSource && isTarget) {
              return {
                ...t,
                clips: t.clips.map((c) => {
                  if (c.id !== clip.id) return c;
                  let newStart = Math.max(0, Math.min(TOTAL_BEATS - 0.25, initialStartBeat + deltaBeats));
                  return { ...c, startBeat: newStart };
                }),
              };
            } else if (isSource) {
              return {
                ...t,
                clips: t.clips.filter((c) => c.id !== clip.id),
              };
            } else if (isTarget) {
              let clipData = clip;
              prev.forEach((pt) => {
                const fc = pt.clips.find((c) => c.id === clip.id);
                if (fc) clipData = fc;
              });

              const movedClip = {
                ...clipData,
                startBeat: Math.max(0, Math.min(TOTAL_BEATS - 0.25, initialStartBeat + deltaBeats)),
              };
              currentTrackId = targetTrackId;
              return {
                ...t,
                clips: [...t.clips, movedClip],
              };
            }
            return t;
          }
        });
      });
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      reschedulePlayback();
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Track management Helpers
  const duplicateTrackSlot = (idx: number) => {
    const track = tracks[idx];
    if (idx < 7) {
      setTracks((prev) =>
        prev.map((t, i) =>
          i === idx + 1
            ? {
                ...t,
                clips: [
                  ...t.clips,
                  ...track.clips.map((c) => ({
                    ...c,
                    id: `clip-dup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  })),
                ],
              }
            : t
        )
      );
      setTimeout(() => reschedulePlayback(), 50);
    }
  };

  const clearTrackSlot = (idx: number) => {
    setTracks((prev) =>
      prev.map((t, i) =>
        i === idx
          ? {
              ...t,
              clips: [],
            }
          : t
      )
    );
    setTimeout(() => reschedulePlayback(), 20);
  };

  const toggleMuteTrack = (id: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, muted: !t.muted } : t))
    );
  };

  const updateTrackVolume = (id: string, vol: number) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, volume: vol } : t))
    );
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const setTrackValue = (idx: number, key: keyof TrackItem, val: any) => {
    setTracks((prev) => prev.map((t, i) => (i === idx ? { ...t, [key]: val } : t)));
  };

  const selectedTrack = tracks[selectedTrackIdx];

  return (
    <div className="create-root">
      {/* DAW Header bar */}
      <header className="create-header">
        <div className="create-header-left">
          <Link href="/dashboard" className="create-back-btn">
            <ArrowLeft size={18} />
          </Link>
          <div className="create-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="https://zgcbpjrvzmocydnlpexx.supabase.co/storage/v1/object/public/songs/logo.png" alt="Sonic" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
            <span>SONIC</span>
          </div>
          <div className="create-divider" />
          <input
            className="create-project-name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            spellCheck={false}
          />
        </div>
        
        {/* Playback Controls */}
        <div className="create-header-center">
          <div className="create-transport">
            <button className="create-transport-btn stop" onClick={stopPlayback} disabled={!isPlaying}>
              <Square size={14} fill="currentColor" />
            </button>
            <motion.button
              className={`create-transport-btn play ${isPlaying ? "active" : ""}`}
              onClick={togglePlayback}
              whileTap={{ scale: 0.9 }}
            >
              {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </motion.button>
          </div>
          <div className="create-bpm">
            <label>BPM</label>
            <input
              type="number"
              min={60}
              max={200}
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
            />
          </div>
          <div className="create-metronome">
            <button
              className={`metronome-toggle ${metronomeEnabled ? "active" : ""}`}
              onClick={() => setMetronomeEnabled(!metronomeEnabled)}
              title="Click Track Metronome"
            >
              <Radio size={14} />
              <span>METRO</span>
            </button>
          </div>
          <div className="create-master-vol">
            <Volume2 size={14} />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={masterVolume}
              onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
            />
          </div>
        </div>

        {/* Zoom & Library triggers */}
        <div className="create-header-right">
          <div className="create-zoom-slider">
            <span>Zoom</span>
            <input
              type="range"
              min={1.0}
              max={3.0}
              step={0.1}
              value={timelineZoom}
              onChange={(e) => setTimelineZoom(parseFloat(e.target.value))}
            />
          </div>
          <button
            className="create-lib-toggle"
            onClick={() => {
              setDeploySongName(projectName);
              setShowDeployModal(true);
            }}
            style={{ background: '#1db954', color: 'black', fontWeight: 700 }}
          >
            Deploy
          </button>
          <button className="create-lib-toggle" onClick={() => setShowLibrary((v) => !v)}>
            {showLibrary ? "Hide Library" : "Show Library"}
            <ChevronDown
              size={14}
              style={{
                transform: showLibrary ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.3s",
              }}
            />
          </button>
        </div>
      </header>

      <div className="create-body">
        {/* Sound Library panel (Left) */}
        <AnimatePresence>
          {showLibrary && (
            <motion.aside
              className="create-library"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <div className="create-library-inner">
                <h3 className="create-library-title">
                  <Music size={16} />
                  Sound Browser
                </h3>

                <div className="create-lib-search">
                  <Search size={14} />
                  <input
                    placeholder="Search loops/samples..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                  {searchQuery && (
                    <button
                      className="create-lib-search-clear"
                      onClick={() => {
                        setSearchQuery("");
                        fetchSounds(activeCategory.query);
                      }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="create-lib-categories">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.label}
                      className={`create-lib-cat ${activeCategory.label === cat.label ? "active" : ""}`}
                      onClick={() => {
                        setActiveCategory(cat);
                        setSearchQuery("");
                      }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="create-lib-results">
                  {isLoading ? (
                    <div className="create-lib-loading">
                      <Loader2 size={24} className="spin" />
                      <span>Fetching loops...</span>
                    </div>
                  ) : sounds.length === 0 ? (
                    <div className="create-lib-empty">
                      <Music size={32} />
                      <span>No samples found</span>
                    </div>
                  ) : (
                    sounds.map((sound) => (
                      <div
                        key={sound.id}
                        className="create-lib-sound"
                        draggable
                        onDragStart={(e) => handleDragStart(e, sound)}
                      >
                        <div className="create-lib-sound-info">
                          <button
                            className={`create-lib-sound-play ${previewPlaying === sound.id ? "playing" : ""}`}
                            onClick={() => togglePreview(sound)}
                          >
                            {previewPlaying === sound.id ? (
                              <Pause size={12} fill="currentColor" />
                            ) : (
                              <Play size={12} fill="currentColor" />
                            )}
                          </button>
                          <div className="create-lib-sound-meta">
                            <div className="create-lib-sound-name">
                              {sound.name.length > 35 ? sound.name.substring(0, 35) + "..." : sound.name}
                            </div>
                            <div className="create-lib-sound-details">
                              <span>{sound.username}</span>
                              <span>•</span>
                              <span>{formatDuration(sound.duration)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="create-lib-attribution">
                  Samples powered by <a href="https://freesound.org" target="_blank" rel="noopener noreferrer">Freesound</a>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Work Area */}
        <main className="create-workspace-main">
          {/* Clip Edit Toolbar */}
          {(selectedClipId || clipboard) && (
            <div className="clip-toolbar">
              {selectedClipId ? (
                <>
                  <div className="clip-toolbar-label">
                    <Music size={13} />
                    <span>Selected Clip: <strong>{getSelectedClip()?.name}</strong></span>
                  </div>
                  <button onClick={handleCut} title="Cut selected clip (Ctrl+X or Cmd+X)">
                    <Scissors size={13} />
                    <span>Cut</span>
                  </button>
                  <button onClick={handleCopy} title="Copy selected clip (Ctrl+C or Cmd+C)">
                    <Copy size={13} />
                    <span>Copy</span>
                  </button>
                  <button onClick={handlePaste} disabled={!clipboard} title="Paste clip at playhead (Ctrl+V or Cmd+V)">
                    <Clipboard size={13} />
                    <span>Paste</span>
                  </button>
                  <button onClick={handleSplit} title="Split clip at playhead (S)">
                    <Scissors size={13} style={{ transform: "rotate(90deg)" }} />
                    <span>Split</span>
                  </button>
                  <button onClick={handleDelete} className="danger" title="Delete selected clip (Delete or Backspace)">
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="clip-toolbar-label">
                    <Clipboard size={13} />
                    <span>Clipboard has: <strong>{clipboard?.name}</strong></span>
                  </div>
                  <button onClick={handlePaste} title="Paste clip at playhead (Ctrl+V or Cmd+V)">
                    <Clipboard size={13} />
                    <span>Paste</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* DAW Layout grid */}
          <div className="create-timeline-layout">
            
            {/* Track Headers Column */}
            <div className="create-track-headers-column">
              <div className="create-track-headers-ruler-space">
                <span>Timeline Lanes</span>
              </div>

              {tracks.map((track, idx) => (
                <div
                  key={track.id}
                  className={`create-track-header ${selectedTrackIdx === idx ? "selected" : ""}`}
                  style={{ borderLeft: `4px solid ${track.color}` }}
                  onClick={() => setSelectedTrackIdx(idx)}
                >
                  <div className="create-track-name-row">
                    <span className="create-track-number">{idx + 1}</span>
                    <span className="create-track-name">{track.name}</span>
                  </div>

                  {/* VU level meter bar */}
                  <div className="vu-meter-container">
                    <div id={`vu-bar-${track.id}`} className="vu-meter-bar" style={{ background: track.color }} />
                  </div>

                  <div className="create-track-controls">
                    <button
                      className={`create-track-mute ${track.muted ? "muted" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMuteTrack(track.id);
                      }}
                      title="Mute"
                    >
                      <VolumeX size={11} />
                    </button>

                    <button
                      className={`create-track-solo ${track.solo ? "solo" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setTrackValue(idx, "solo", !track.solo);
                      }}
                      title="Solo"
                    >
                      S
                    </button>

                    <button
                      className={`create-track-lock ${track.locked ? "locked" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setTrackValue(idx, "locked", !track.locked);
                      }}
                      title="Lock Track"
                    >
                      {track.locked ? <Lock size={11} /> : <Unlock size={11} />}
                    </button>

                    <button
                      className={`create-track-rec ${recordingTrackIdx === idx ? "recording" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRecording(idx);
                      }}
                      title="Record Microphone"
                    >
                      <Mic size={11} />
                    </button>

                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={track.volume}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateTrackVolume(track.id, parseFloat(e.target.value));
                      }}
                      className="create-track-vol"
                    />

                    <button
                      className="create-track-copy"
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateTrackSlot(idx);
                      }}
                      title="Duplicate to Next Row"
                    >
                      <Copy size={11} />
                    </button>

                    <button
                      className="create-track-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearTrackSlot(idx);
                      }}
                      title="Clear Track"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Canvas Timeline container */}
            <div
              ref={containerRef}
              className="create-timeline-canvas-container"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                style={{ display: "block" }}
              />
            </div>
          </div>

          {/* Bottom DAW Panels: Track FX Inspector + Virtual Piano Keyboard */}
          <div className="create-bottom-console">
            
            {/* Inspector Panel */}
            <div className="daw-inspector-panel">
              <div className="panel-tabs">
                <button
                  className={`panel-tab ${activeTab === "track" ? "active" : ""}`}
                  onClick={() => setActiveTab("track")}
                >
                  Track {selectedTrackIdx + 1} FX
                </button>
                {selectedClipId && (
                  <button
                    className={`panel-tab ${activeTab === "clip" ? "active" : ""}`}
                    onClick={() => setActiveTab("clip")}
                  >
                    Clip Editor
                  </button>
                )}
              </div>

              {activeTab === "track" || !selectedClipId ? (
                <div className="inspector-controls">
                  <div className="inspector-knob-group">
                    <label>EQ Filter</label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={selectedTrack?.filterCutoff ?? 50}
                      onChange={(e) => setTrackValue(selectedTrackIdx, "filterCutoff", parseInt(e.target.value))}
                    />
                    <span className="knob-label">
                      {selectedTrack?.filterCutoff < 45 ? "Lowpass" : selectedTrack?.filterCutoff > 55 ? "Highpass" : "Flat"}
                    </span>
                  </div>

                  <div className="inspector-knob-group">
                    <label>Delay Echo</label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={selectedTrack?.delayMix ?? 0}
                      onChange={(e) => setTrackValue(selectedTrackIdx, "delayMix", parseFloat(e.target.value))}
                    />
                    <span className="knob-label">Mix: {Math.round((selectedTrack?.delayMix ?? 0) * 100)}%</span>
                  </div>

                  <div className="inspector-knob-group">
                    <label>Distortion</label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={selectedTrack?.distortion ?? 0}
                      onChange={(e) => setTrackValue(selectedTrackIdx, "distortion", parseInt(e.target.value))}
                    />
                    <span className="knob-label">Drive: {selectedTrack?.distortion ?? 0}</span>
                  </div>

                  <div className="inspector-knob-group">
                    <label>Pan (Balance)</label>
                    <input
                      type="range"
                      min={-1}
                      max={1}
                      step={0.1}
                      value={selectedTrack?.pan ?? 0}
                      onChange={(e) => setTrackValue(selectedTrackIdx, "pan", parseFloat(e.target.value))}
                    />
                    <span className="knob-label">
                      {selectedTrack?.pan < 0 ? "Left" : selectedTrack?.pan > 0 ? "Right" : "Center"}
                    </span>
                  </div>
                </div>
              ) : (
                (() => {
                  const clip = getSelectedClip();
                  if (!clip) return null;
                  return (
                    <div className="inspector-controls clip-editor-controls">
                      <div className="inspector-knob-group">
                        <label>Start Beat</label>
                        <input
                          type="number"
                          min={0}
                          max={TOTAL_BEATS - 0.25}
                          step={0.25}
                          value={clip.startBeat}
                          onChange={(e) => updateSelectedClipValue("startBeat", parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div className="inspector-knob-group">
                        <label>Trim Start (sec)</label>
                        <input
                          type="range"
                          min={0}
                          max={Math.max(0, clip.duration - clip.trimEnd - 0.1)}
                          step={0.1}
                          value={clip.trimStart}
                          onChange={(e) => updateSelectedClipValue("trimStart", parseFloat(e.target.value))}
                        />
                        <span className="knob-label">{clip.trimStart.toFixed(2)}s</span>
                      </div>

                      <div className="inspector-knob-group">
                        <label>Trim End (sec)</label>
                        <input
                          type="range"
                          min={0}
                          max={Math.max(0, clip.duration - clip.trimStart - 0.1)}
                          step={0.1}
                          value={clip.trimEnd}
                          onChange={(e) => updateSelectedClipValue("trimEnd", parseFloat(e.target.value))}
                        />
                        <span className="knob-label">{clip.trimEnd.toFixed(2)}s</span>
                      </div>

                      <div className="inspector-knob-group">
                        <label>Rename Clip</label>
                        <input
                          type="text"
                          value={clip.name}
                          onChange={(e) => updateSelectedClipValue("name", e.target.value)}
                          style={{
                            background: "var(--create-surface)",
                            border: "1px solid var(--create-border)",
                            color: "var(--create-text)",
                            fontSize: "11px",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            outline: "none"
                          }}
                        />
                      </div>
                    </div>
                  );
                })()
              )}
            </div>

            {/* MIDI Virtual Keyboard */}
            <div className="daw-keyboard-panel">
              <div className="panel-title-row">
                <div className="panel-title">
                  <Settings size={14} />
                  <span>Virtual MIDI Synth Jammer</span>
                </div>
                <div className="synth-controls">
                  <select
                    value={synthWaveform}
                    onChange={(e) => setSynthWaveform(e.target.value as OscillatorType)}
                  >
                    <option value="triangle">Triangle Wave</option>
                    <option value="sine">Sine Wave</option>
                    <option value="sawtooth">Sawtooth Wave</option>
                    <option value="square">Square Wave</option>
                  </select>
                  <div className="octave-controls">
                    <button onClick={() => setSynthOctave(Math.max(-2, synthOctave - 1))}>-</button>
                    <span>Octave: {synthOctave}</span>
                    <button onClick={() => setSynthOctave(Math.min(2, synthOctave + 1))}>+</button>
                  </div>
                </div>
              </div>

              {/* Piano keys layout */}
              <div className="piano-keys-container">
                {PIANO_KEYS.map((key) => (
                  <button
                    key={key.note}
                    className={`piano-key ${key.isSharp ? "black" : "white"}`}
                    onClick={() => playSynthNote(key.freq)}
                  >
                    <span className="key-label">{key.note}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </main>
      </div>
      <AnimatePresence>
        {showDeployModal && (
          <motion.div 
            className="deploy-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.8)', zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <motion.div 
              className="deploy-modal-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{
                background: '#121212', padding: '32px', borderRadius: '16px',
                width: '400px', maxWidth: '90%', border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              <h2 style={{ marginTop: 0, marginBottom: '24px', fontSize: '20px' }}>Deploy Track</h2>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>Song Name</label>
                <input 
                  value={deploySongName} 
                  onChange={e => setDeploySongName(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}
                />
              </div>
              
              <div style={{ marginBottom: '32px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>Artist Name</label>
                <input 
                  value={deployArtistName} 
                  onChange={e => setDeployArtistName(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button 
                  onClick={() => setShowDeployModal(false)}
                  style={{ padding: '10px 16px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    alert("Mixdown starting...");
                    setTimeout(() => {
                      alert("Download complete!");
                      setShowDeployModal(false);
                    }, 1000);
                  }}
                  style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Download size={14} /> Download
                </button>
                <button 
                  disabled={deploying}
                  onClick={async () => {
                    if (!deploySongName.trim() || !deployArtistName.trim()) {
                      alert("Please provide both song and artist name.");
                      return;
                    }
                    setDeploying(true);
                    try {
                      const songId = `user-track-${Date.now()}`;
                      await setDoc(doc(db, "songs", songId), {
                        song_id: songId,
                        title: deploySongName,
                        artist: deployArtistName,
                        creator_id: user ? user.uid : "anonymous",
                        is_public: true,
                        like_count: 0,
                        play_count: 0,
                        created_at: new Date().toISOString(),
                        img: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=300&h=300",
                        audioUrl: "", // Cannot upload audio file without storage bucket configured here
                        notes_data: {}
                      });
                      alert("Successfully published to Sonic!");
                      setShowDeployModal(false);
                    } catch (e) {
                      alert("Error publishing track");
                    } finally {
                      setDeploying(false);
                    }
                  }}
                  style={{ padding: '10px 16px', background: '#1db954', border: 'none', color: 'black', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {deploying ? <Loader2 size={14} className="spin" /> : <UploadCloud size={14} />} 
                  {deploying ? "Publishing..." : "Publish"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
