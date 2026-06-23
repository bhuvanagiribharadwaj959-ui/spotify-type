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
  height = 400,
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

  const MOUSE_RADIUS = 100;
  const PUSH_FORCE = 6.0;
  const FRICTION = 0.92;
  const EASE = 0.05;
  const DESTROY_DIST = 800;
  const RESPAWN_DELAY = 45; // frames

  const initParticles = useCallback(
    (ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, W: number, H: number) => {
      // Draw image or text to a temp canvas for pixel sampling
      const tmpCanvas = document.createElement("canvas");
      tmpCanvas.width = W;
      tmpCanvas.height = H;
      const tmpCtx = tmpCanvas.getContext("2d")!;

      // Clear with solid black background
      tmpCtx.fillStyle = "#000000";
      tmpCtx.fillRect(0, 0, W, H);

      let drawW = W;
      let drawH = H;
      let offsetX = 0;
      let offsetY = 0;

      if (img) {
        // Calculate aspect-ratio-correct dimensions (object-fit: contain style)
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const canvasAspect = W / H;

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
      } else if (src.startsWith("text:")) {
        const text = src.substring(5);
        tmpCtx.fillStyle = "#ffffff";
        
        // Adaptive font size based on canvas width
        const fontSize = Math.floor(W * 0.28);
        tmpCtx.font = `900 ${fontSize}px Inter, system-ui, -apple-system, sans-serif`;
        tmpCtx.textAlign = "center";
        tmpCtx.textBaseline = "middle";
        tmpCtx.fillText(text, W / 2, H / 2);

        drawW = W;
        drawH = H;
        offsetX = 0;
        offsetY = 0;
      }

      const imageData = tmpCtx.getImageData(0, 0, W, H);
      const pixels = imageData.data;

      const particles: Particle[] = [];
      
      // Use tighter grid for text to make letters super readable
      const gridSpacing = src.startsWith("text:") ? 4 : 5;
      const baseParticleSize = src.startsWith("text:") ? 1.5 : 1.8;

      for (let y = 0; y < H; y += gridSpacing) {
        for (let x = 0; x < W; x += gridSpacing) {
          const idx = (y * W + x) * 4;
          const r = pixels[idx];
          const g = pixels[idx + 1];
          const b = pixels[idx + 2];
          const a = pixels[idx + 3];

          // Skip transparent or near-black pixels
          if (a < 30) continue;
          if (r < 15 && g < 15 && b < 15) continue;

          // For images, clip borders to prevent edge artifacts
          if (img) {
            const margin = 8;
            if (
              x < offsetX + margin ||
              x > offsetX + drawW - margin ||
              y < offsetY + margin ||
              y > offsetY + drawH - margin
            ) {
              continue;
            }
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
            size: baseParticleSize,
            alive: true,
            respawnTimer: 0,
            friction: FRICTION + Math.random() * 0.03,
            ease: EASE + Math.random() * 0.02,
          });
        }
      }

      particlesRef.current = particles;
      imageLoadedRef.current = true;
    },
    [src]
  );

  const spawnSmoke = useCallback((W: number, H: number) => {
    const smoke = smokeRef.current;
    if (smoke.length > 40) return; // Limit smoke particles for performance

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
      vx: (Math.random() - 0.5) * 0.6,
      vy: -0.2 - Math.random() * 0.5,
      radius: 12 + Math.random() * 25,
      opacity: 0,
      life: 0,
      maxLife: 100 + Math.random() * 80,
      hue: 0,
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

    imageLoadedRef.current = false;

    // Load source
    if (src.startsWith("text:")) {
      initParticles(ctx, null, W, H);
    } else {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = src;
      img.onload = () => {
        initParticles(ctx, img, W, H);
      };
      img.onerror = () => {
        console.error("Failed to load image for pixel particles, falling back to text");
        initParticles(ctx, null, W, H);
      };
    }

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

      // --- Draw monochrome smoke behind particles ---
      if (frameCount % 4 === 0) {
        spawnSmoke(W, H);
      }

      const smoke = smokeRef.current;
      for (let i = smoke.length - 1; i >= 0; i--) {
        const s = smoke[i];
        s.life++;
        s.x += s.vx;
        s.y += s.vy;

        const lifeRatio = s.life / s.maxLife;
        if (lifeRatio < 0.15) {
          s.opacity = (lifeRatio / 0.15) * 0.08;
        } else {
          s.opacity = 0.08 * (1 - (lifeRatio - 0.15) / 0.85);
        }

        if (s.life >= s.maxLife) {
          smoke.splice(i, 1);
          continue;
        }

        const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.radius);
        grad.addColorStop(0, `rgba(255, 255, 255, ${s.opacity})`);
        grad.addColorStop(0.5, `rgba(255, 255, 255, ${s.opacity * 0.4})`);
        grad.addColorStop(1, `rgba(255, 255, 255, 0)`);

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
            p.alive = true;
            p.x = p.homeX + (Math.random() - 0.5) * 20;
            p.y = p.homeY + (Math.random() - 0.5) * 20;
            p.vx = 0;
            p.vy = 0;
          }
          continue;
        }

        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (mouse.active && dist < MOUSE_RADIUS) {
          const angle = Math.atan2(dy, dx);
          const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
          p.vx += Math.cos(angle) * force * PUSH_FORCE;
          p.vy += Math.sin(angle) * force * PUSH_FORCE;
        }

        // Spring back to home
        p.vx += (p.homeX - p.x) * p.ease;
        p.vy += (p.homeY - p.y) * p.ease;

        p.vx *= p.friction;
        p.vy *= p.friction;

        p.x += p.vx;
        p.y += p.vy;

        const homeDx = p.x - p.homeX;
        const homeDy = p.y - p.homeY;
        const homeDist = Math.sqrt(homeDx * homeDx + homeDy * homeDy);

        if (homeDist > DESTROY_DIST) {
          p.alive = false;
          p.respawnTimer = RESPAWN_DELAY + Math.floor(Math.random() * 20);
          continue;
        }

        // Draw particle as a small square (as requested in the physics loop description: "Draw each particle as a small square")
        const brightness = (p.r + p.g + p.b) / 3;
        const currentSize = p.size * (0.7 + (brightness / 255) * 0.6);
        
        ctx.globalAlpha = p.a / 255;
        ctx.fillStyle = `rgb(${p.r}, ${p.g}, ${p.b})`;
        
        // Draw as square
        ctx.fillRect(p.x - currentSize / 2, p.y - currentSize / 2, currentSize, currentSize);
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
    <div className="pixel-particle-wrapper" style={{ position: "relative", width: width, height: height }}>
      <canvas
        ref={canvasRef}
        className="pixel-particle-canvas"
        style={{
          cursor: "crosshair",
          display: "block",
          background: "#000000",
          borderRadius: "16px",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
        }}
      />
      <div 
        className="pixel-particle-glow" 
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          borderRadius: "16px",
          boxShadow: "inset 0 0 30px rgba(255, 255, 255, 0.02)",
        }}
      />
    </div>
  );
}
