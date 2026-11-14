import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import { content } from '../content';
import AndromedaBackdrop, { AndromedaCredit } from '../fx/AndromedaBackdrop';
import Particles from '../fx/Particles';
import Reveal from '../ui/Reveal';

const ORBITS = [
  { rx: 250, ry: 96, dur: 38, r: 4.5, c: '#43e3ff' },
  { rx: 360, ry: 138, dur: 62, r: 6, c: '#f6c65b' },
  { rx: 470, ry: 180, dur: 96, r: 4, c: '#cdbdff' },
  { rx: 590, ry: 226, dur: 140, r: 5, c: '#8b6cff' },
];

function Orbits() {
  return (
    <div className="ps-deco ps-hero-orbits" aria-hidden="true">
      <svg viewBox="0 0 1500 900" fill="none">
        <g transform="translate(790 440) rotate(-16)">
          {ORBITS.map((o, i) => {
            const d = `M ${o.rx} 0 A ${o.rx} ${o.ry} 0 1 0 ${-o.rx} 0 A ${o.rx} ${o.ry} 0 1 0 ${o.rx} 0`;
            return (
              <g key={i}>
                <path d={d} stroke="rgba(180,190,255,0.28)" strokeWidth="1" strokeDasharray={i % 2 ? '2 7' : undefined} />
                <circle r={o.r} fill={o.c} style={{ filter: `drop-shadow(0 0 8px ${o.c})` }}>
                  <animateMotion dur={`${o.dur}s`} repeatCount="indefinite" path={d} />
                </circle>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

function Telescope() {
  return (
    <svg className="ps-deco ps-hero-scope" viewBox="0 0 320 300" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="hs-beam" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#43e3ff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#43e3ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points="92,92 112,86 250,-60 190,-80" fill="url(#hs-beam)" opacity="0.5" />
      <g stroke="#9aa6e8" strokeWidth="2" strokeLinecap="round">
        <line x1="150" y1="170" x2="96" y2="296" />
        <line x1="150" y1="170" x2="150" y2="296" />
        <line x1="150" y1="170" x2="212" y2="296" />
      </g>
      <g transform="rotate(-38 150 150)">
        <rect x="52" y="132" width="196" height="34" rx="8" fill="#0d1240" stroke="#9aa6e8" strokeWidth="2" />
        <rect x="40" y="128" width="24" height="42" rx="6" fill="#161c5c" stroke="#cdbdff" strokeWidth="2" />
        <rect x="232" y="138" width="34" height="22" rx="5" fill="#161c5c" stroke="#9aa6e8" strokeWidth="2" />
        <circle cx="44" cy="149" r="9" fill="#43e3ff" opacity="0.6" />
      </g>
      <circle cx="150" cy="170" r="10" fill="#0d1240" stroke="#cdbdff" strokeWidth="2" />
    </svg>
  );
}

/** 01 — hero: Andromeda backdrop, slow orbits, cinematic title, travelling deeper on scroll. */
export function HeroScene({ onStartTour }: { onStartTour: () => void }) {
  const h = content.hero;
  return (
    <>
      <AndromedaBackdrop variant="hero" />
      <div className="ps-deco ps-hero-rays" aria-hidden="true" />
      <Orbits />
      <Particles count={80} color="200,215,255" />
      <Telescope />
      <div className="ps-inner">
        <div className="ps-hero">
          <Reveal as="div" className="ps-hero-labels">
            {h.labels.map((l) => <span key={l} className="ps-chip">{l}</span>)}
          </Reveal>
          <h1 className="ps-hero-title" aria-label={h.title}>
            {h.title.split('').map((ch, k) => <span key={k} aria-hidden="true" style={{ ['--k' as string]: k }}>{ch}</span>)}
          </h1>
          <Reveal i={6} as="p" className="ps-hero-sub">{h.subtitle}</Reveal>
          <Reveal i={7} as="p" className="ps-hero-text">{h.text}</Reveal>
          <Reveal i={8} className="ps-hero-cta">
            <button type="button" className="ps-btn ps-btn--primary" onClick={onStartTour}>
              <Play size={16} /> {h.tourCta} · {h.tourMeta}
            </button>
            <Link to="/" className="ps-btn">{h.openApp}</Link>
          </Reveal>
          <Reveal i={9} className="ps-panel ps-hero-msg"><b>{h.message}</b></Reveal>
        </div>
      </div>
      <div className="ps-scroll-ind" aria-hidden="true"><i /><span>{h.scroll}</span></div>
      <AndromedaCredit />
    </>
  );
}
