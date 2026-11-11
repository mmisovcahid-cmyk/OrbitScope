import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Plus, Minus, Crosshair } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CandidateMarker {
  id: string;
  ra: number;
  dec: number;
  label: string;
  type: 'candidate' | 'known' | 'artifact';
  ra_str?: string;
  dec_str?: string;
}

const DEFAULT_MARKERS: CandidateMarker[] = [
  { id: '#0042', ra: 188.5, dec: -8.35, label: 'Candidate #0042', type: 'candidate', ra_str: '12h 34m', dec_str: "-08° 21'" },
  { id: '#0019', ra: 120.0, dec: 42.0, label: 'Candidate #0019', type: 'candidate', ra_str: '08h 00m', dec_str: '+42° 00' },
  { id: '#0031', ra: 145.0, dec: -45.0, label: 'Candidate #0031', type: 'candidate', ra_str: '09h 40m', dec_str: "-45° 00'" },
  { id: '#0087', ra: 275.0, dec: -20.0, label: 'Candidate #0087', type: 'candidate', ra_str: '18h 20m', dec_str: "-20° 00'" },
  { id: 'ceres', ra: 70.0, dec: 22.0, label: '1 Ceres', type: 'known', ra_str: '04h 40m', dec_str: '+22° 00' },
  { id: 'vesta', ra: 65.0, dec: -32.0, label: '4 Vesta', type: 'known', ra_str: '04h 20m', dec_str: "-32° 00'" },
  { id: 'artifact-1', ra: 300.0, dec: 38.0, label: 'Spike Artifact', type: 'artifact', ra_str: '20h 00m', dec_str: '+38° 00' },
  { id: 'pallas', ra: 160.0, dec: 32.0, label: '2 Pallas', type: 'known', ra_str: '10h 40m', dec_str: '+32° 00' }
];

export default function SkyMapCanvas({
  onSelectCandidate,
  selectedId = '#0042'
}: {
  onSelectCandidate?: (marker: CandidateMarker) => void;
  selectedId?: string;
}) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const selectedCandidate = DEFAULT_MARKERS.find(m => m.id === selectedId) || DEFAULT_MARKERS[0];

  // Aitoff celestial projection
  const project = useCallback((raDeg: number, decDeg: number, width: number, height: number): [number, number] => {
    // RA from 0..360 -> lambda in [-PI, PI]
    const lambda = ((raDeg - 180) * Math.PI) / 180;
    const phi = (decDeg * Math.PI) / 180;

    const alpha = Math.acos(Math.max(-1, Math.min(1, Math.cos(phi) * Math.cos(lambda / 2))));
    let sinc = 1;
    if (Math.abs(alpha) > 1e-6) {
      sinc = Math.sin(alpha) / alpha;
    }

    const xAitoff = (2 * Math.cos(phi) * Math.sin(lambda / 2)) / sinc; // roughly [-2, 2]
    const yAitoff = Math.sin(phi) / sinc; // roughly [-1, 1]

    const cx = width / 2 + pan.x;
    const cy = height / 2 + pan.y;
    const rx = (width * 0.44) * zoom;
    const ry = (height * 0.44) * zoom;

    const x = cx + (xAitoff / 2) * rx;
    const y = cy - yAitoff * ry;

    return [x, y];
  }, [zoom, pan]);

  // Main canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // 1. Deep space background
    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, w, h);

    // 2. Stars background
    const rand = (i: number) => {
      const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
      return v - Math.floor(v);
    };

    for (let i = 0; i < 700; i++) {
      const ra = rand(i * 3) * 360;
      const dec = (rand(i * 3 + 1) - 0.5) * 170;
      const [sx, sy] = project(ra, dec, w, h);
      const bright = 0.2 + rand(i * 3 + 2) * 0.6;
      const size = 0.4 + rand(i * 7) * 0.9;
      ctx.fillStyle = `rgba(215, 230, 255, ${bright})`;
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Realistic Infrared Galactic Dust emission (Milky Way band across the equator)
    ctx.save();
    // Glowing infrared dust along galactic plane
    for (let r = 0; r <= 360; r += 2) {
      const gDec = 14 * Math.sin(((r - 260) * Math.PI) / 180);
      const [gx, gy] = project(r, gDec, w, h);
      
      const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, 45 * zoom);
      grad.addColorStop(0, 'rgba(234, 88, 12, 0.16)'); // golden orange dust
      grad.addColorStop(0.3, 'rgba(168, 85, 247, 0.12)'); // magenta / violet emission
      grad.addColorStop(0.6, 'rgba(59, 130, 246, 0.08)'); // cyan / blue faint glow
      grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(gx, gy, 45 * zoom, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dense galactic core glow (near RA 266, Dec -29)
    const [coreX, coreY] = project(266, -29, w, h);
    const coreGrad = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, 90 * zoom);
    coreGrad.addColorStop(0, 'rgba(251, 146, 60, 0.35)');
    coreGrad.addColorStop(0.35, 'rgba(192, 132, 252, 0.22)');
    coreGrad.addColorStop(0.7, 'rgba(56, 189, 248, 0.10)');
    coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(coreX, coreY, 90 * zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 4. Aitoff Celestial Grid Lines (Latitude / Longitude)
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = 'rgba(70, 110, 180, 0.18)';

    // Declination rings
    [-60, -30, 0, 30, 60].forEach((dec) => {
      ctx.beginPath();
      for (let ra = 0; ra <= 360; ra += 3) {
        const [x, y] = project(ra, dec, w, h);
        if (ra === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      if (dec === 0) {
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.25)';
        ctx.stroke();
        ctx.strokeStyle = 'rgba(70, 110, 180, 0.18)';
      } else {
        ctx.stroke();
      }
    });

    // RA meridians
    [30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].forEach((ra) => {
      ctx.beginPath();
      for (let dec = -88; dec <= 88; dec += 4) {
        const [x, y] = project(ra, dec, w, h);
        if (dec === -88) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });

    // 5. Outer Aitoff Boundary Ellipse
    ctx.beginPath();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.4)';
    for (let dec = -90; dec <= 90; dec += 1) {
      const [x, y] = project(360, dec, w, h);
      if (dec === -90) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let dec = 90; dec >= -90; dec -= 1) {
      const [x, y] = project(0, dec, w, h);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    // 6. Dashed Celestial / Orbit / Ecliptic Curve (Light Blue Dashed Line)
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.7)';
    ctx.beginPath();
    for (let ra = 0; ra <= 360; ra += 2) {
      // Ecliptic ~ obliquity 23.4 degrees
      const ecDec = 23.44 * Math.sin(((ra - 0) * Math.PI) / 180);
      const [ex, ey] = project(ra, ecDec, w, h);
      if (ra === 0) ctx.moveTo(ex, ey);
      else ctx.lineTo(ex, ey);
    }
    ctx.stroke();
    ctx.restore();

    // 7. Coordinate Degree Labels on Edge (90°, -90°, 0°, 0°)
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.textAlign = 'center';

    const [topX, topY] = project(180, 90, w, h);
    ctx.fillText('90°', topX, topY - 8);

    const [botX, botY] = project(180, -90, w, h);
    ctx.fillText('-90°', botX, botY + 16);

    const [leftX, leftY] = project(360, 0, w, h);
    ctx.textAlign = 'right';
    ctx.fillText('0°', leftX - 10, leftY + 4);

    const [rightX, rightY] = project(0, 0, w, h);
    ctx.textAlign = 'left';
    ctx.fillText('0°', rightX + 10, rightY + 4);

    // 8. Render Markers
    DEFAULT_MARKERS.forEach((m) => {
      const [mx, my] = project(m.ra, m.dec, w, h);
      const isSelected = m.id === selectedId;

      if (m.type === 'known') {
        // Blue circle
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#38BDF8';
        ctx.fillStyle = isSelected ? '#38BDF8' : 'rgba(56, 189, 248, 0.2)';
        ctx.beginPath();
        ctx.arc(mx, my, isSelected ? 5 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (m.type === 'artifact') {
        // Grey ring
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = '#94A3B8';
        ctx.fillStyle = 'rgba(148, 163, 184, 0.15)';
        ctx.beginPath();
        ctx.arc(mx, my, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        // Candidate (Orange Triangle)
        ctx.save();
        ctx.strokeStyle = '#F59E0B';
        ctx.fillStyle = '#F59E0B';
        ctx.lineWidth = 1.5;

        const size = isSelected ? 7 : 5;
        ctx.beginPath();
        ctx.moveTo(mx, my - size);
        ctx.lineTo(mx + size, my + size * 0.75);
        ctx.lineTo(mx - size, my + size * 0.75);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      // If Selected: Concentric glowing violet rings
      if (isSelected) {
        ctx.save();
        // Outer faint ring
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(mx, my, 16, 0, Math.PI * 2);
        ctx.stroke();

        // Inner glowing ring
        ctx.strokeStyle = 'rgba(216, 180, 254, 0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(mx, my, 9, 0, Math.PI * 2);
        ctx.stroke();

        // Center dot
        ctx.fillStyle = '#E879F9';
        ctx.beginPath();
        ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });

  }, [project, zoom, pan, selectedId]);

  // Handle Drag / Pan
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Handle Click selection of candidate
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    for (const m of DEFAULT_MARKERS) {
      const [mx, my] = project(m.ra, m.dec, rect.width, rect.height);
      const dist = Math.hypot(clickX - mx, clickY - my);
      if (dist < 18) {
        if (onSelectCandidate) onSelectCandidate(m);
        break;
      }
    }
  };

  // Compute screen coordinates for Candidate #0042 tooltip
  const getSelectedTooltipPos = () => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedCandidate) return { left: '56%', top: '34%' };
    const rect = canvas.getBoundingClientRect();
    const [sx, sy] = project(selectedCandidate.ra, selectedCandidate.dec, rect.width, rect.height);
    return {
      left: `${sx + 16}px`,
      top: `${sy - 22}px`
    };
  };

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[380px] select-none overflow-hidden rounded-2xl bg-[#070a14] border border-white/[0.07]">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair block"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleCanvasClick}
      />

      {/* Floating Controls (Top Left) */}
      <div className="absolute top-4 left-4 flex flex-col bg-[#0b1329]/80 backdrop-blur-md rounded-xl border border-white/10 shadow-xl overflow-hidden text-gray-300">
        <button
          onClick={() => setZoom((z) => Math.min(z + 0.2, 2.5))}
          className="p-2 hover:bg-white/10 hover:text-white transition-colors border-b border-white/5"
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(z - 0.2, 0.7))}
          className="p-2 hover:bg-white/10 hover:text-white transition-colors border-b border-white/5"
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          className="p-2 hover:bg-white/10 hover:text-white transition-colors"
          title="Reset View"
        >
          <Crosshair className="w-4 h-4" />
        </button>
      </div>

      {/* Legend (Top Right) */}
      <div className="absolute top-4 right-4 flex items-center gap-4 text-xs font-medium text-gray-300">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full border border-sky-400 bg-sky-400/20" />
          <span>{t('dashboard.stats.knownObjects')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-0 h-0 border-x-[5px] border-x-transparent border-b-[8px] border-b-amber-500" />
          <span>{t('status.candidate')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full border border-slate-400" />
          <span>Artefakt</span>
        </div>
      </div>

      {/* Floating Candidate Tooltip Badge on Active Candidate */}
      {selectedCandidate && (
        <div
          style={getSelectedTooltipPos()}
          className="absolute z-20 pointer-events-none px-3.5 py-2 rounded-xl bg-[#0b1329]/90 backdrop-blur-md border border-white/15 shadow-2xl text-left"
        >
          <div className="text-xs font-semibold text-white tracking-wide">
            {selectedCandidate.label}
          </div>
          <div className="text-[11px] font-mono text-gray-400 mt-0.5">
            RA: {selectedCandidate.ra_str || '12h 34m'} | Dec: {selectedCandidate.dec_str || "-08° 21'"}
          </div>
        </div>
      )}
    </div>
  );
}
