import { useEffect, useRef } from 'react';
import { usePerf } from '../perf-context';
import { mulberry32 } from '../lib/rng';

interface LayerSpec { n: number; size: [number, number]; alpha: [number, number]; speed: number; seed: number; tint: boolean; }

/** Draws one seamless star tile and returns it as a data URL (the tile repeats vertically). */
function makeTile(size: number, spec: LayerSpec): string {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (!g) return '';
  const rnd = mulberry32(spec.seed);
  for (let i = 0; i < spec.n; i++) {
    const x = rnd() * size, y = rnd() * size;
    const r = spec.size[0] + rnd() * (spec.size[1] - spec.size[0]);
    const a = spec.alpha[0] + rnd() * (spec.alpha[1] - spec.alpha[0]);
    const t = rnd();
    g.fillStyle = spec.tint ? (t < 0.2 ? '#ffd7a0' : t < 0.45 ? '#aac4ff' : t < 0.55 ? '#d3b8ff' : '#ffffff') : '#ffffff';
    g.globalAlpha = a;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    if (r > 1.25) { // soft glow for the bigger stars
      g.globalAlpha = a * 0.18;
      g.beginPath();
      g.arc(x, y, r * 3.2, 0, Math.PI * 2);
      g.fill();
    }
  }
  return c.toDataURL('image/png');
}

const LAYERS: LayerSpec[] = [
  { n: 420, size: [0.35, 0.8], alpha: [0.25, 0.7], speed: 0.04, seed: 11, tint: false },   // distant
  { n: 150, size: [0.6, 1.3], alpha: [0.4, 0.9], speed: 0.1, seed: 23, tint: true },      // middle
  { n: 36, size: [1.0, 2.0], alpha: [0.55, 1], speed: 0.2, seed: 37, tint: true },         // near
];

/** Fixed, multi-layer star sky behind the whole presentation with subtle scroll parallax. */
export default function Starfield() {
  const { lite, reduced } = usePerf();
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const tileSize = lite ? 512 : 1024;

  useEffect(() => {
    const tiles = (lite ? [LAYERS[0], LAYERS[1]] : LAYERS).map((l) => makeTile(tileSize, lite ? { ...l, n: Math.round(l.n / 2) } : l));
    refs.current.forEach((el, i) => {
      if (!el) return;
      el.style.backgroundImage = tiles[i] ? `url(${tiles[i]})` : 'none';
      el.style.backgroundSize = `${tileSize}px ${tileSize}px`;
      el.style.height = `calc(100% + ${tileSize}px)`;
    });
    if (lite || reduced) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      refs.current.forEach((el, i) => {
        if (!el) return;
        const k = LAYERS[i].speed;
        el.style.transform = `translate3d(0, ${-((y * k) % tileSize)}px, 0)`;
      });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [lite, reduced, tileSize]);

  const layers = lite ? LAYERS.slice(0, 2) : LAYERS;
  return (
    <div className="ps-sky" aria-hidden="true">
      {layers.map((l, i) => (
        <div key={l.seed} ref={(el) => { refs.current[i] = el; }} className={`ps-sky-layer${i === 1 ? ' is-twinkle' : ''}`} />
      ))}
      <div className="ps-deco ps-neb ps-neb--a" />
      <div className="ps-deco ps-neb ps-neb--b" />
    </div>
  );
}
