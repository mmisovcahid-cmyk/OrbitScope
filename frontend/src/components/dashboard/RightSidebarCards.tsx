import React from 'react';
import { Calendar, Layers, Target, Activity, Clock, ArrowRight, BarChart2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function ObservationOverviewCard() {
  return (
    <div className="rounded-2xl bg-[#0b1329]/80 backdrop-blur-md border border-white/[0.08] p-4 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-sm font-semibold text-white tracking-wide">
          Observation Overview
        </h3>
        <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live Data
        </span>
      </div>

      {/* Mollweide SPHEREx All-Sky Infrared Map Thumbnail */}
      <div className="relative w-full aspect-[2/1] rounded-xl overflow-hidden bg-black/60 border border-white/5 flex items-center justify-center group mb-3">
        {/* Synthetic All-sky infrared map with glowing purple/magenta/orange dust emission */}
        <div
          className="w-full h-full"
          style={{
            background: `
              radial-gradient(ellipse at 50% 50%, rgba(249, 115, 22, 0.4) 0%, rgba(168, 85, 247, 0.35) 30%, rgba(59, 130, 246, 0.25) 60%, rgba(3, 7, 18, 0.95) 100%),
              radial-gradient(ellipse 90% 18% at 50% 50%, rgba(251, 146, 60, 0.6) 0%, rgba(217, 70, 239, 0.4) 40%, rgba(30, 58, 138, 0.1) 80%)
            `,
          }}
        >
          {/* Astrometric oval coordinate grid overlay */}
          <svg viewBox="0 0 200 100" className="w-full h-full opacity-60">
            <ellipse cx="100" cy="50" rx="94" ry="46" fill="none" stroke="rgba(147, 197, 253, 0.3)" strokeWidth="0.8" />
            <ellipse cx="100" cy="50" rx="60" ry="46" fill="none" stroke="rgba(147, 197, 253, 0.2)" strokeWidth="0.5" />
            <line x1="6" y1="50" x2="194" y2="50" stroke="rgba(147, 197, 253, 0.25)" strokeWidth="0.6" />
            <line x1="100" y1="4" x2="100" y2="96" stroke="rgba(147, 197, 253, 0.2)" strokeWidth="0.5" />
          </svg>
        </div>
      </div>

      {/* Date Pill */}
      <div className="flex items-center gap-2 text-xs text-gray-300 mb-3 px-1">
        <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
        <span>SPHEREx Quick Release (July 2025)</span>
      </div>

      {/* 3 Metric Columns */}
      <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-white/5 text-center">
        <div>
          <div className="flex justify-center text-sky-400 mb-1">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div className="text-xs font-bold text-white">102</div>
          <div className="text-[10px] text-gray-400">Bands</div>
        </div>

        <div>
          <div className="flex justify-center text-sky-400 mb-1">
            <Target className="w-3.5 h-3.5" />
          </div>
          <div className="text-xs font-bold text-white">6.2"</div>
          <div className="text-[10px] text-gray-400">Pixels</div>
        </div>

        <div>
          <div className="flex justify-center text-sky-400 mb-1">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div className="text-xs font-bold text-white">0.75–5.0</div>
          <div className="text-[10px] text-gray-400">µm</div>
        </div>
      </div>
    </div>
  );
}

export function MovingObjectsDetectedCard() {
  const navigate = useNavigate();

  return (
    <div className="rounded-2xl bg-[#0b1329]/80 backdrop-blur-md border border-white/[0.08] p-4 shadow-xl">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <BarChart2 className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm font-semibold text-white tracking-wide">
            Moving Objects Detected
          </h3>
        </div>
        <button
          onClick={() => navigate('/detection')}
          className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-0.5 transition-colors"
        >
          View All <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Content: Big Number + Glowing Purple Sparkline */}
      <div className="flex items-center justify-between mt-1">
        <div>
          <div className="text-3xl font-extrabold text-white tracking-tight">12</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Potential Moving Sources</div>
        </div>

        {/* Purple Glowing Sparkline Chart */}
        <div className="w-32 h-14">
          <svg viewBox="0 0 120 50" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#818CF8" />
                <stop offset="50%" stopColor="#C084FC" />
                <stop offset="100%" stopColor="#A855F7" />
              </linearGradient>
              <filter id="purpleGlow">
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Path */}
            <path
              d="M 5 38 Q 20 42 35 25 T 65 30 T 95 14 T 115 18"
              fill="none"
              stroke="url(#lineGrad)"
              strokeWidth="2.5"
              filter="url(#purpleGlow)"
            />

            {/* Sparkline dots at nodes */}
            <circle cx="5" cy="38" r="3" fill="#818CF8" />
            <circle cx="35" cy="25" r="3" fill="#A855F7" />
            <circle cx="65" cy="30" r="3" fill="#C084FC" />
            <circle cx="95" cy="14" r="3" fill="#E879F9" />
            <circle cx="115" cy="18" r="3" fill="#A855F7" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export function PlanetXResearchCard() {
  const navigate = useNavigate();

  return (
    <div className="rounded-2xl bg-[#0b1329]/80 backdrop-blur-md border border-white/[0.08] p-4 shadow-xl flex items-center justify-between gap-3">
      {/* Left text info */}
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-white tracking-wide">
          Planet X Research
        </h3>
        <p className="text-xs text-gray-400 mt-1 leading-relaxed max-w-[175px]">
          No confirmed evidence. Exploring theoretical orbital region...
        </p>
        <button
          onClick={() => navigate('/planetx')}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-sky-400 bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/20 transition-colors"
        >
          Learn More <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* 3D Realistic Icy Planet Sphere Graphic */}
      <div className="relative w-20 h-20 shrink-0">
        <div
          className="w-full h-full rounded-full shadow-[0_0_25px_rgba(56,189,248,0.35)]"
          style={{
            background: `
              radial-gradient(circle at 75% 25%, #7DD3FC 0%, #0284C7 25%, #0369A1 45%, #0F172A 75%, #020617 100%)
            `,
          }}
        >
          {/* Surface texture detail */}
          <div
            className="w-full h-full rounded-full opacity-30"
            style={{
              backgroundImage: 'radial-gradient(2px 2px at 40px 30px, white, transparent), radial-gradient(1.5px 1.5px at 20px 45px, white, transparent)',
            }}
          />
        </div>
        {/* Atmospheric outer glow rim */}
        <div className="absolute inset-0 rounded-full border border-sky-400/40 pointer-events-none" />
      </div>
    </div>
  );
}

export function ObservationTimelineCard() {
  return (
    <div className="rounded-2xl bg-[#0b1329]/80 backdrop-blur-md border border-white/[0.08] p-4 shadow-xl">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-sky-400" />
        <h3 className="text-sm font-semibold text-white tracking-wide">
          Observation Timeline
        </h3>
      </div>

      {/* Timeline nodes */}
      <div className="space-y-3 relative pl-3">
        {/* Vertical track line */}
        <div className="absolute left-[17px] top-2.5 bottom-2.5 w-[2px] bg-purple-500/30" />

        {/* Node 1 */}
        <div className="flex items-center justify-between gap-2 relative">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-[0_0_8px_#c084fc] relative z-10" />
            <div>
              <div className="text-xs font-semibold text-gray-200">May 2025</div>
              <div className="text-[10px] text-gray-400">(First Observation)</div>
            </div>
          </div>
          {/* Mini starfield thumbnail */}
          <div className="w-8 h-6 rounded bg-[#030712] border border-white/10 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-white shadow-[0_0_3px_#fff]" />
          </div>
        </div>

        {/* Node 2 */}
        <div className="flex items-center justify-between gap-2 relative">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-[0_0_8px_#c084fc] relative z-10" />
            <div>
              <div className="text-xs font-semibold text-gray-200">Dec 2025</div>
              <div className="text-[10px] text-gray-400">(Second Observation)</div>
            </div>
          </div>
          {/* Mini starfield thumbnail */}
          <div className="w-8 h-6 rounded bg-[#030712] border border-white/10 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-white shadow-[0_0_3px_#fff]" />
          </div>
        </div>
      </div>
    </div>
  );
}
