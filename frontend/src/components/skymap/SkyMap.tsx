import { useRef, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface SkyObject {
  ra: number;
  dec: number;
  label?: string;
  type?: string;
  radius?: number;
}

interface Props {
  regions?: SkyObject[];
  candidates?: SkyObject[];
  knownObjects?: SkyObject[];
  onRegionClick?: (ra: number, dec: number) => void;
  width?: number;
  height?: number;
  className?: string;
}

/** Aitoff projection: (ra, dec) in radians → (x, y) in [-2, 2] x [-1, 1] */
function aitoff(lambda: number, phi: number): [number, number] {
  const alpha = Math.acos(Math.cos(phi) * Math.cos(lambda / 2));
  if (Math.abs(alpha) < 1e-10) return [0, 0];
  const sinc = Math.sin(alpha) / alpha;
  const x = (2 * Math.cos(phi) * Math.sin(lambda / 2)) / sinc;
  const y = Math.sin(phi) / sinc;
  return [x, y];
}

function drawStars(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Deterministic seed-like random via simple hash
  const rand = (i: number) => {
    const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  for (let i = 0; i < 1200; i++) {
    const ra = rand(i) * 360;
    const dec = (rand(i + 5000) - 0.5) * 180;
    const lam = ((ra - 180) * Math.PI) / 180;
    const phi = (dec * Math.PI) / 180;
    const [ax, ay] = aitoff(lam, phi);
    const sx = w / 2 + (ax / 2) * (w * 0.45);
    const sy = h / 2 - ay * (h * 0.45);
    const brightness = 0.15 + rand(i + 1000) * 0.5;
    const size = 0.3 + rand(i + 2000) * 1.2;
    ctx.fillStyle = `rgba(200,210,255,${brightness})`;
    ctx.beginPath();
    ctx.arc(sx, sy, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = 'rgba(100,140,200,0.08)';
  ctx.lineWidth = 0.5;
  // Dec lines
  for (let dec = -75; dec <= 75; dec += 15) {
    ctx.beginPath();
    for (let ra = 0; ra <= 360; ra += 2) {
      const lam = ((ra - 180) * Math.PI) / 180;
      const phi = (dec * Math.PI) / 180;
      const [ax, ay] = aitoff(lam, phi);
      const sx = w / 2 + (ax / 2) * (w * 0.45);
      const sy = h / 2 - ay * (h * 0.45);
      if (ra === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
  }
  // RA lines
  for (let ra = 0; ra < 360; ra += 30) {
    ctx.beginPath();
    for (let dec = -90; dec <= 90; dec += 2) {
      const lam = ((ra - 180) * Math.PI) / 180;
      const phi = (dec * Math.PI) / 180;
      const [ax, ay] = aitoff(lam, phi);
      const sx = w / 2 + (ax / 2) * (w * 0.45);
      const sy = h / 2 - ay * (h * 0.45);
      if (dec === -90) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
  }
}

function drawMilkyWay(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Simplified milky way band (galactic plane projected)
  const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.48);
  gradient.addColorStop(0, 'rgba(80,70,120,0.0)');
  gradient.addColorStop(0.5, 'rgba(60,50,100,0.03)');
  gradient.addColorStop(1, 'rgba(40,30,80,0.0)');

  ctx.beginPath();
  for (let ra = 0; ra <= 360; ra += 2) {
    // Galactic plane ~ dec = some function of RA (simplified)
    const gal_dec = 28 * Math.sin(((ra - 282) * Math.PI) / 180);
    const lam = ((ra - 180) * Math.PI) / 180;
    const phi = (gal_dec * Math.PI) / 180;
    const [ax, ay] = aitoff(lam, phi);
    const sx = w / 2 + (ax / 2) * (w * 0.45);
    const sy = h / 2 - ay * (h * 0.45);
    if (ra === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
  }
  ctx.lineWidth = 60;
  ctx.strokeStyle = 'rgba(80,60,120,0.06)';
  ctx.stroke();
}

function drawOutline(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = 'rgba(100,140,200,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let dec = -90; dec <= 90; dec += 1) {
    const lam = Math.PI;
    const phi = (dec * Math.PI) / 180;
    const [ax, ay] = aitoff(lam, phi);
    const sx = w / 2 + (ax / 2) * (w * 0.45);
    const sy = h / 2 - ay * (h * 0.45);
    if (dec === -90) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
  }
  for (let dec = 90; dec >= -90; dec -= 1) {
    const lam = -Math.PI;
    const phi = (dec * Math.PI) / 180;
    const [ax, ay] = aitoff(lam, phi);
    const sx = w / 2 + (ax / 2) * (w * 0.45);
    const sy = h / 2 - ay * (h * 0.45);
    ctx.lineTo(sx, sy);
  }
  ctx.closePath();
  ctx.stroke();
}

function project(ra: number, dec: number, w: number, h: number): [number, number] {
  const lam = ((ra - 180) * Math.PI) / 180;
  const phi = (dec * Math.PI) / 180;
  const [ax, ay] = aitoff(lam, phi);
  return [w / 2 + (ax / 2) * (w * 0.45), h / 2 - ay * (h * 0.45)];
}

export default function SkyMap({ regions = [], candidates = [], knownObjects = [], onRegionClick, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 900, h: 450 });
  const [hover, setHover] = useState<{ x: number; y: number; label: string } | null>(null);
  const { t } = useTranslation();

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setDims({ w: Math.floor(r.width), h: Math.max(300, Math.floor(r.width * 0.5)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = dims;
    canvas.width = w * 2;
    canvas.height = h * 2;
    ctx.scale(2, 2);

    // Background
    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, w, h);

    drawMilkyWay(ctx, w, h);
    drawGrid(ctx, w, h);
    drawStars(ctx, w, h);
    drawOutline(ctx, w, h);

    // RA labels
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(100,140,200,0.3)';
    for (let ra = 0; ra < 360; ra += 60) {
      const [sx, sy] = project(ra, -5, w, h);
      ctx.fillText(`${ra}°`, sx - 8, sy + 12);
    }

    // Draw regions
    regions.forEach((r) => {
      const [sx, sy] = project(r.ra, r.dec, w, h);
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(59,130,246,0.3)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(59,130,246,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
      if (r.label) {
        ctx.fillStyle = 'rgba(59,130,246,0.6)';
        ctx.font = '8px sans-serif';
        ctx.fillText(r.label, sx + 8, sy + 3);
      }
    });

    // Draw known objects
    knownObjects.forEach((o) => {
      const [sx, sy] = project(o.ra, o.dec, w, h);
      ctx.beginPath();
      // Diamond shape
      ctx.moveTo(sx, sy - 4);
      ctx.lineTo(sx + 4, sy);
      ctx.lineTo(sx, sy + 4);
      ctx.lineTo(sx - 4, sy);
      ctx.closePath();
      ctx.fillStyle = 'rgba(16,185,129,0.5)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(16,185,129,0.8)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });

    // Draw candidates
    candidates.forEach((c) => {
      const [sx, sy] = project(c.ra, c.dec, w, h);
      // Outer glow
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(245,158,11,0.15)';
      ctx.fill();
      // Inner
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(245,158,11,0.7)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(245,158,11,0.9)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });
  }, [dims, regions, candidates, knownObjects]);

  // Click handler
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onRegionClick || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      // Inverse Aitoff (approx) — just use linear for interaction
      const { w, h } = dims;
      const ax = ((x - w / 2) / (w * 0.45)) * 2;
      const ay = -(y - h / 2) / (h * 0.45);
      const ra = (Math.atan2(ax, 1) * 180) / Math.PI + 180;
      const dec = (Math.asin(Math.max(-1, Math.min(1, ay))) * 180) / Math.PI;
      onRegionClick(Math.max(0, Math.min(360, ra)), Math.max(-90, Math.min(90, dec)));
    },
    [onRegionClick, dims]
  );

  // Mouse move for tooltip
  const handleMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { w, h } = dims;

      const allObj = [
        ...regions.map((r) => ({ ...r, type: 'region' })),
        ...candidates.map((c) => ({ ...c, type: 'candidate' })),
        ...knownObjects.map((o) => ({ ...o, type: 'known' })),
      ];

      for (const o of allObj) {
        const [sx, sy] = project(o.ra, o.dec, w, h);
        if (Math.abs(mx - sx) < 8 && Math.abs(my - sy) < 8) {
          setHover({ x: mx, y: my, label: o.label || `RA ${o.ra.toFixed(2)}° Dec ${o.dec.toFixed(2)}°` });
          return;
        }
      }
      setHover(null);
    },
    [dims, regions, candidates, knownObjects]
  );

  return (
    <div ref={containerRef} className={`relative w-full ${className ?? ''}`}>
      <canvas
        ref={canvasRef}
        style={{ width: dims.w, height: dims.h }}
        className="rounded-lg cursor-crosshair"
        onClick={handleClick}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      />
      {hover && (
        <div
          className="absolute pointer-events-none z-10 px-2 py-1 rounded bg-gray-900/90 border border-white/10 text-xs text-gray-200"
          style={{ left: hover.x + 12, top: hover.y - 8 }}
        >
          {hover.label}
        </div>
      )}
      {/* Legend */}
      <div className="absolute bottom-2 right-2 flex gap-3 text-[10px] text-gray-500 bg-black/60 rounded px-2 py-1">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> {t('dashboard.stats.regions')}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> {t('dashboard.stats.candidates')}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500 rotate-45" style={{ width: 6, height: 6 }} /> {t('dashboard.stats.knownObjects')}</span>
      </div>
    </div>
  );
}
