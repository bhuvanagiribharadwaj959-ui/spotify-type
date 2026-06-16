"use client";

import { useRef, useEffect, useCallback } from "react";

interface Particle {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  vx: number;
  vy: number;
  r: number;
  g: number;
  b: number;
  a: number;
  size: number;
  alive: boolean;
  respawnTimer: number;
  friction: number;
  ease: number;
}

interface SmokeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  life: number;
  maxLife: number;
  hue: number;
}

export default function PixelParticleImage({
  src,
  width = 480,
  height = 600,
}: {
  src: string;
  width?: number;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });
  const particlesRef = useRef<Particle[]>([]);
  const smokeRef = useRef<SmokeParticle[]>([]);
  const rafRef = useRef<number>(0);
  const imageLoadedRef = useRef(false);

  const GRID = 5;          // sample every Nth pixel
  const PARTICLE_SIZE = 1.8; // base radius of circles
  const MOUSE_RADIUS = 120;
  const PUSH_FORCE = 8.0;
  const FRICTION = 0.90;
  const EASE = 0.04;
  const DESTROY_DIST = 1000;
  const RESPAWN_DELAY = 60; // frames

  const initParticles = useCallback(
    (ctx: CanvasRenderingContext2D, img: HTMLImageElement, W: number, H: number) => {
      // Draw image to a temp canvas for pixel sampling
      const tmpCanvas = document.createElement("canvas");
      tmpCanvas.width = W;
      tmpCanvas.height = H;
      const tmpCtx = tmpCanvas.getContext("2d")!;

      // Calculate aspect-ratio-correct dimensions (object-fit: contain style)
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const canvasAspect = W / H;
      let drawW: number, drawH: number, offsetX: number, offsetY: number;

      if (imgAspect > canvasAspect) {
        drawW = W;
        drawH = W / imgAspect;
        offsetX = 0;
        offsetY = (H - drawH) / 2;
      } else {
        drawH = H;
        drawW = H * imgAspect;
        offsetX = (W - drawW) / 2;
        offsetY = 0;
      }

      tmpCtx.drawImage(img, offsetX, offsetY, drawW, drawH);
      const imageData = tmpCtx.getImageData(0, 0, W, H);
      const pixels = imageData.data;

      const particles: Particle[] = [];

      for (let y = 0; y < H; y += GRID) {
        for (let x = 0; x < W; x += GRID) {
          const idx = (y * W + x) * 4;
          const r = pixels[idx];
          const g = pixels[idx + 1];
          const b = pixels[idx + 2];
          const a = pixels[idx + 3];

          // Skip fully transparent or near-black background pixels
          if (a < 30) continue;
          // Skip very dark pixels (part of black background)
          if (r < 12 && g < 12 && b < 12) continue;

          // Skip edges to remove any potential white lines from the image border
          const margin = 8;
          if (
            x < offsetX + margin ||
            x > offsetX + drawW - margin ||
            y < offsetY + margin ||
            y > offsetY + drawH - margin
          ) {
            continue;
          }

          particles.push({
            x: x,
            y: y,
            homeX: x,
            homeY: y,
            vx: 0,
            vy: 0,
            r,
            g,
            b,
            a,
            size: PARTICLE_SIZE,
            alive: true,
            respawnTimer: 0,
            friction: FRICTION + Math.random() * 0.04,
            ease: EASE + Math.random() * 0.02,
          });
        }
      }

      particlesRef.current = particles;
      imageLoadedRef.current = true;
    },
    []
  );

  const spawnSmoke = useCallback((W: number, H: number) => {
    const smoke = smokeRef.current;
    // Only spawn if under limit
    if (smoke.length > 60) return;

    // Spawn near the bottom and sides of the image
    const side = Math.random();
    let sx: number, sy: number;
    if (side < 0.4) {
      // Bottom
      sx = W * 0.2 + Math.random() * W * 0.6;
      sy = H * 0.85 + Math.random() * H * 0.15;
    } else if (side < 0.7) {
      // Left side
      sx = W * 0.05 + Math.random() * W * 0.2;
      sy = H * 0.4 + Math.random() * H * 0.5;
    } else {
      // Right side
      sx = W * 0.75 + Math.random() * W * 0.2;
      sy = H * 0.4 + Math.random() * H * 0.5;
    }

    smoke.push({
      x: sx,
      y: sy,
      vx: (Math.random() - 0.5) * 0.8,
      vy: -0.3 - Math.random() * 0.7,
      radius: 15 + Math.random() * 35,
      opacity: 0,
      life: 0,
      maxLife: 120 + Math.random() * 100,
      hue: 140 + Math.random() * 30, // green hue range
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const W = width;
    const H = height;

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;

    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.scale(dpr, dpr);

    // Load image
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = () => {
      initParticles(ctx, img, W, H);
    };

    // Mouse handlers
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.x = -9999;
      mouseRef.current.y = -9999;
      mouseRef.current.active = false;
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    let frameCount = 0;

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, W, H);
      frameCount++;

      const mouse = mouseRef.current;
      const particles = particlesRef.current;

      if (!imageLoadedRef.current) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      // --- Draw smoke behind particles ---
      if (frameCount % 3 === 0) {
        spawnSmoke(W, H);
      }

      const smoke = smokeRef.current;
      for (let i = smoke.length - 1; i >= 0; i--) {
        const s = smoke[i];
        s.life++;
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.995;

        // Fade in then out
        const lifeRatio = s.life / s.maxLife;
        if (lifeRatio < 0.15) {
          s.opacity = (lifeRatio / 0.15) * 0.12;
        } else {
          s.opacity = 0.12 * (1 - (lifeRatio - 0.15) / 0.85);
        }

        if (s.life >= s.maxLife) {
          smoke.splice(i, 1);
          continue;
        }

        const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.radius);
        grad.addColorStop(0, `hsla(${s.hue}, 70%, 45%, ${s.opacity})`);
        grad.addColorStop(0.5, `hsla(${s.hue}, 60%, 35%, ${s.opacity * 0.5})`);
        grad.addColorStop(1, `hsla(${s.hue}, 50%, 25%, 0)`);

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // --- Update & draw particles ---
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (!p.alive) {
          p.respawnTimer--;
          if (p.respawnTimer <= 0) {
            // Respawn at home
            p.alive = true;
            p.x = p.homeX + (Math.random() - 0.5) * 30;
            p.y = p.homeY + (Math.random() - 0.5) * 30;
            p.vx = 0;
            p.vy = 0;
          }
          continue;
        }

        // Distance to mouse
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (mouse.active && dist < MOUSE_RADIUS) {
          // Push away from cursor
          const angle = Math.atan2(dy, dx);
          const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
          p.vx += Math.cos(angle) * force * PUSH_FORCE;
          p.vy += Math.sin(angle) * force * PUSH_FORCE;
        }

        // Spring back to home
        p.vx += (p.homeX - p.x) * p.ease;
        p.vy += (p.homeY - p.y) * p.ease;

        // Apply friction
        p.vx *= p.friction;
        p.vy *= p.friction;

        // Update position
        p.x += p.vx;
        p.y += p.vy;

        // Check if too far from home → "destroy"
        const homeDx = p.x - p.homeX;
        const homeDy = p.y - p.homeY;
        const homeDist = Math.sqrt(homeDx * homeDx + homeDy * homeDy);

        if (homeDist > DESTROY_DIST) {
          p.alive = false;
          p.respawnTimer = RESPAWN_DELAY + Math.floor(Math.random() * 30);
          continue;
        }

        // Draw particle as a circle
        const brightness = (p.r + p.g + p.b) / 3;
        const currentSize = p.size * (0.6 + (brightness / 255) * 0.8);
        
        ctx.globalAlpha = p.a / 255;
        ctx.fillStyle = `rgb(${p.r}, ${p.g}, ${p.b})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [src, width, height, initParticles, spawnSmoke]);

  return (
    <div className="pixel-particle-wrapper">
      <canvas
        ref={canvasRef}
        className="pixel-particle-canvas"
        style={{
          cursor: "crosshair",
        }}
      />
      <div className="pixel-particle-glow" />
    </div>
  );
}
