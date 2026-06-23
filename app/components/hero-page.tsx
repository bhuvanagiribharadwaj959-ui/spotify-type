"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Mic,
  Volume2,
  Sliders,
  Globe,
  Music,
  Play,
  User,
  Compass,
  ArrowRight,
  ChevronRight,
  Sparkles,
  Waves,
  RotateCcw
} from "lucide-react";
import Link from "next/link";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth } from "../lib/firebase";
import PixelParticleImage from "./PixelParticleImage";
import "./hero-page.css";

export default function HeroPage() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [activeTab, setActiveTab] = useState("Home");
  const [particleSrc, setParticleSrc] = useState<string>("text:SONIC");
  const [rotation, setRotation] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (isHovered) return;
    const timer = setInterval(() => {
      setRotation((prev) => prev - (360 / 21));
    }, 2000); // 2 seconds
    return () => clearInterval(timer);
  }, [isHovered]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoadingUser(false);
    });
    return () => unsubscribe();
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result;
        if (typeof result === "string") {
          setParticleSrc(result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResetParticles = () => {
    setParticleSrc("text:SONIC");
  };

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }
    }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  // High-fidelity English pop singer & DJ artist assets
  const circle2Image = "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=800&auto=format&fit=crop";
  const circle3Image = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop";

  const image1 = "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=800&auto=format&fit=crop"; // concert lights
  const image2 = "https://images.unsplash.com/photo-1507838153414-b4b713384a76?q=80&w=800&auto=format&fit=crop"; // vinyl record
  const image3 = "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=800&auto=format&fit=crop"; // laser beam
  const image4 = "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop"; // electric guitarist

  // 7 Static, high-fidelity original English pop/indie album cover arts (Vibrant, colorful, and instant)
  const fannedCovers = [
    "https://c.saavncdn.com/077/After-Hours-English-2020-20240207070330-500x500.jpg", // Blinding Lights (The Weeknd)
    "https://c.saavncdn.com/665/Future-Nostalgia-English-2020-20260306223201-500x500.jpg", // Levitating (Dua Lipa)
    "https://c.saavncdn.com/243/The-Cruelest-Summer-English-2023-20231109123211-500x500.jpg", // Cruel Summer (Taylor Swift)
    "https://c.saavncdn.com/435/Before-the-Dawn-Heals-Us-French-2005-20231007191910-500x500.jpg", // Midnight City (M83)
    "https://c.saavncdn.com/372/Starboy-English-2016-500x500.jpg", // Starboy (The Weeknd)
    "https://c.saavncdn.com/653/Dream-Your-Life-Away-English-2014-20190607044515-500x500.jpg", // Riptide (Vance Joy)
    "https://c.saavncdn.com/834/I-Love-You--English-2013-20220323205211-500x500.jpg"  // Sweater Weather (The Neighbourhood)
  ];

  return (
    <div className="hero-page-wrapper">
      {/* Header */}
      <header className="hero-header">
        <Link href="/" className="brand-container">
          <div className="brand-logo-icon" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "white", borderRadius: "8px", width: "32px", height: "32px" }}>
            <Waves size={20} color="black" />
          </div>
          <span className="brand-logo">SONIC</span>
        </Link>



        <div className="header-actions">
          {loadingUser ? (
            <div style={{ width: 100, height: 38, background: "rgba(255,255,255,0.03)", borderRadius: 30 }} />
          ) : currentUser ? (
            <Link href="/dashboard" className="btn-signup">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn-login">
                Log In
              </Link>
              <Link href="/login?mode=signup" className="btn-signup">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero Body */}
      <main className="hero-body">
        {/* Huge Transparent Outline Text Background */}
        <div className="bg-sonic-text">SONIC</div>

        {/* Side Toolbars */}
        <div className="sidebar-left">
          <div className="sidebar-icon-btn">
            <Mic size={16} />
          </div>
          <div className="sidebar-icon-btn">
            <Volume2 size={16} />
          </div>
          <div className="sidebar-icon-btn">
            <Sliders size={16} />
          </div>
          <div className="sidebar-line"></div>
        </div>

        <div className="sidebar-right">
          <a href="https://instagram.com" target="_blank" rel="noreferrer" className="sidebar-icon-btn" aria-label="Instagram">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
            </svg>
          </a>
          <a href="https://twitter.com" target="_blank" rel="noreferrer" className="sidebar-icon-btn" aria-label="Twitter">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path>
            </svg>
          </a>
          <a href="https://github.com" target="_blank" rel="noreferrer" className="sidebar-icon-btn" aria-label="Website">
            <Globe size={16} />
          </a>
          <div className="sidebar-line"></div>
        </div>

        {/* Circles Stack Container */}
        <motion.div
          className="circles-stack-container"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          {/* Giant brand title behind circles - clean Inter font, no glitch overlay */}
          <div className="hero-center-title">
            <span>SONIC</span>
          </div>

          {/* Circle 1: Content card style */}
          <motion.div
            className="hero-circle circle-1"
            variants={fadeIn}
          >
            <div className="circle-arrow">
              <ArrowUpRight size={28} />
            </div>
            <p className="circle-description">
              The platform helps aspiring artists bring their music to the audience
            </p>
          </motion.div>

          {/* Circle 2: Main singer grayscale photo */}
          <motion.div
            className="hero-circle circle-2"
            style={{ backgroundImage: `url(${circle2Image})` }}
            variants={fadeIn}
          >
            <div className="circle-2-overlay" />
          </motion.div>

          {/* Circle 3: Secondary artist grayscale photo */}
          <motion.div
            className="hero-circle circle-3"
            style={{ backgroundImage: `url(${circle3Image})` }}
            variants={fadeIn}
          >
            <button className="learn-more-btn-pill">
              <span>Learn More</span>
              <div className="learn-more-arrow-circle">
                <ArrowRight size={12} />
              </div>
            </button>
          </motion.div>
        </motion.div>



        {/* Scroll hint / footer logo */}
        <div className="hero-footer-hint">
          Scroll Down to Discover
        </div>
      </main>

      {/* Immersive Dashboard-Style Middle Showcase Sections */}
      <section className="info-sections-container">

        {/* REDESIGNED SECTION 1: Open Source Songs (Image 4 3D Fanned Album Deck Style) */}
        <div className="section-fanned-showcase" style={{ maxWidth: '1300px', margin: '0 auto', width: '100%', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%', marginBottom: '0px' }}>
            <div>
              <h2 style={{ fontSize: '56px', fontWeight: 600, margin: 0, letterSpacing: '-2px', color: '#fff' }}>Open Source Songs</h2>
              <p style={{ color: '#a0a0a0', margin: '12px 0 0 0', fontSize: '18px', maxWidth: '600px' }}>
                Turn your ideas into high-quality music in seconds. Stream, download, and remix stems with no licensing restrictions.
              </p>
            </div>
          </div>

          {/* 3D Curved Fanned Deck of Album Covers */}
          <div
            className="fanned-deck-wrapper"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{ perspective: '1200px', margin: '10px 0 30px' }}
          >
            {/* Spotlight background behind center card */}
            <div className="fanned-glow-spotlight"></div>

            <div
              className="fanned-deck-container"
              style={{
                transform: `rotateY(${rotation}deg)`,
                transformStyle: 'preserve-3d',
                perspective: 'none',
                transition: 'transform 0.8s cubic-bezier(0.25, 0.8, 0.25, 1)',
                width: '100%',
                height: '100%',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {[...fannedCovers, ...fannedCovers, ...fannedCovers].map((coverUrl, index) => {
                const angle = index * (360 / 21);
                const worldAngle = ((angle + rotation) % 360 + 360) % 360;
                // Increased radius to 1300 to relax the curvature
                const z = -1300 * Math.cos(worldAngle * Math.PI / 180);

                // Opacity fades out smoothly so we only see the back arc
                const opacity = Math.max(0, Math.min(1, (-z - 500) / 300));
                // Relaxed dynamic scale
                const dynamicScale = 1 + (z + 1300) / 2000;

                const angleFixed = angle.toFixed(3);
                const scaleFixed = dynamicScale.toFixed(3);
                const opacityFixed = opacity.toFixed(3);

                const songInfo = [
                  { title: "Blinding Lights", license: "The Weeknd • Synthpop" },
                  { title: "Levitating", license: "Dua Lipa • Disco Pop" },
                  { title: "Cruel Summer", license: "Taylor Swift • Synthpop" },
                  { title: "Midnight City", license: "M83 • Synthwave" },
                  { title: "Starboy", license: "The Weeknd • R&B" },
                  { title: "Riptide", license: "Vance Joy • Indie Folk" },
                  { title: "Sweater Weather", license: "The Neighbourhood • Indie" }
                ];
                // Map index to the 7 unique song metadata objects
                const info = songInfo[index % 7];

                return (
                  <div
                    key={index}
                    className="fanned-deck-card"
                    style={{
                      backgroundImage: `url(${coverUrl})`,
                      position: 'absolute',
                      transform: `rotateY(${angleFixed}deg) translateZ(-1300px) scale(${scaleFixed})`,
                      opacity: opacityFixed,
                      // The container handles the positioning rotation. The card just handles its own opacity fade.
                      transition: 'opacity 0.8s cubic-bezier(0.25, 0.8, 0.25, 1), box-shadow 0.6s, border-color 0.6s'
                    }}
                  >
                    <div className="fanned-card-overlay">
                      <div className="fanned-card-label">
                        <span className="card-song-name">{info.title}</span>
                        <span className="card-song-license">{info.license}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>


        </div>



        {/* Section 3: Explore your favorite artists (Bento Grid) */}
        <div className="info-section" style={{ flexDirection: 'column', alignItems: 'flex-start', maxWidth: '1300px', margin: '0 auto', gap: '40px' }}>

          {/* Header row from the mockup */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%' }}>
            <div>
              <h2 style={{ fontSize: '56px', fontWeight: 600, margin: 0, letterSpacing: '-2px', color: '#fff' }}>Explore your favorite artists</h2>
              <p style={{ color: '#a0a0a0', margin: '12px 0 0 0', fontSize: '18px' }}>Curated list of the most popular creators right now.</p>
            </div>
            <button style={{ background: '#fff', color: '#000', border: 'none', borderRadius: '30px', padding: '14px 28px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'transform 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
              Enter Store <span style={{ fontSize: '18px' }}>→</span>
            </button>
          </div>

          {/* 3-column Spotify Wrapped Style Layout */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '24px',
            width: '100%'
          }}>
            {[
              { name: "Charlie Puth", bg: "#ff2a2a", nameColor: "#ffc837", img: "https://cdn-images.dzcdn.net/images/artist/c355b366638e0c5f20f4b265f0f12646/1000x1000-000000-80-0-0.jpg", hrs: 48, descColor: "#8f0000" },
              { name: "Zara Larsson", bg: "#006450", nameColor: "#9dddd0", img: "https://cdn-images.dzcdn.net/images/artist/26e260152661dea1897a6eea198f9981/1000x1000-000000-80-0-0.jpg", hrs: 46, descColor: "#00382d" },
              { name: "Post Malone", bg: "#493254", nameColor: "#f1a24d", img: "https://cdn-images.dzcdn.net/images/artist/a5a8cca44e7eab2db7d44e039bed2574/1000x1000-000000-80-0-0.jpg", hrs: 37, descColor: "#f25c54" },
              { name: "The Weeknd", bg: "#391be0", nameColor: "#84d2f6", img: "https://cdn-images.dzcdn.net/images/artist/581693b4724a7fcfa754455101e13a44/1000x1000-000000-80-0-0.jpg", hrs: 89, descColor: "#a0c4ff" },
              { name: "Kehlani", bg: "#ff5a1f", nameColor: "#ffd4ba", img: "https://cdn-images.dzcdn.net/images/artist/2bf1fa3d1cc1716f784dadf112d16d9e/1000x1000-000000-80-0-0.jpg", hrs: 67, descColor: "#8c2205" },
              { name: "Lizzo", bg: "#ffd6df", nameColor: "#e81c3b", img: "https://cdn-images.dzcdn.net/images/artist/fc39273a1d7b5818d8bc53d1134cd1d8/1000x1000-000000-80-0-0.jpg", hrs: 67, descColor: "#e81c3b" }
            ].map((card, i) => (
              <div key={i} style={{
                backgroundColor: card.bg,
                borderRadius: '8px',
                padding: '24px',
                position: 'relative',
                height: '450px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transition: 'transform 0.3s',
                cursor: 'pointer',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                transform: `translateY(${i % 2 !== 0 ? '40px' : '0'})`
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', zIndex: 2 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: card.nameColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 14, color: card.bg, fontWeight: 900 }}>S</span>
                  </div>
                  <span style={{ color: card.nameColor, fontWeight: 700, fontSize: '15px', letterSpacing: '-0.5px' }}>SONIC</span>
                </div>

                {/* Artist Image (Absolute positioning) */}
                <div style={{
                  position: 'absolute',
                  top: i % 2 === 0 ? '40px' : '90px', // stagger the image position
                  right: 0,
                  width: '55%',
                  height: '45%',
                  backgroundImage: `url(${card.img})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  zIndex: 1,
                  boxShadow: '-8px 8px 24px rgba(0,0,0,0.4)'
                }} />

                {/* Text Content */}
                <div style={{ marginTop: 'auto', zIndex: 2 }}>
                  <div style={{ color: card.nameColor, fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>Top Artist</div>
                  <h3 style={{ 
                    color: card.nameColor, 
                    fontSize: '64px', 
                    fontWeight: 900, 
                    margin: 0, 
                    lineHeight: '0.9',
                    letterSpacing: '-3px',
                    width: '85%',
                    wordWrap: 'break-word',
                    textTransform: 'none'
                  }}>
                    {card.name.split(' ').map((word, wIdx) => (
                      <div key={wIdx}>{word}</div>
                    ))}
                  </h3>
                  <p style={{ color: card.descColor, fontSize: '14px', marginTop: '16px', maxWidth: '85%', lineHeight: 1.3, fontWeight: 600 }}>
                    You spent {card.hrs} hours with your favorite artist {card.name}, and the pleasure is all theirs.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Centered Large-Scale Interactive Sandbox Section (Clean style, NO code walkthrough) */}
      <section className="sandbox-section" style={{ paddingTop: '100px' }}>
        <div className="sandbox-centered-layout">
          {/* Centered Massive Canvas Sandbox */}
          <div className="sandbox-visual-container">
            <div className="sandbox-canvas-wrapper">
              <PixelParticleImage
                src={particleSrc}
                width={800}
                height={380}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
