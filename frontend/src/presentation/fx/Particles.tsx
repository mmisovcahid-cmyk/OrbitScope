import { useEffect, useRef } from 'react';
import { useFrame } from '../hooks';
import { usePerf } from '../perf-context';
import { mulberry32 } from '../lib/rng';

interface Props {
  count?: number;
  color?: string;
  className?: string;
  /** direction of the drift in radians (default: slowly upward) */
  angle?: number;
  speed?: number;
}

/** Drifting light particles on a canvas. Runs only while its scene is on screen and never in lite mode. */
export default function Particles({ count = 70, color = '200,210,255', className = '', angle = -Math.PI / 2, speed = 9 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { lite, reduced } = usePerf();
  const state = useRef<{ x: number; y: number; r: number; s: number; a: number; p: number }[]>([]);
  const size = useRef({ w: 0, h: 0, dpr: 1 });

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const r = cv.getBoundingClientRect();
      size.current = { w: r.width, h: r.height, dpr };
      cv.width = Math.max(1, Math.round(r.width * dpr));
      cv.height = Math.max(1, Math.round(r.height * dpr));
    };
    resize();
    const rnd = mulberry32(99);
    state.current = Array.from({ length: count }, () => ({
      x: rnd(), y: rnd(), r: 0.5 + rnd() * 1.8, s: 0.35 + rnd() * 0.9, a: 0.15 + rnd() * 0.6, p: rnd() * 6.28,
    }));
    const ro = new ResizeObserver(resize);
    ro.observe(cv);
    return () => ro.disconnect();
  }, [count, lite, reduced]);

  useFrame((t, dt) => {
    const cv = ref.current;
    const g = cv?.getContext('2d');
    if (!cv || !g) return;
    const { w, h, dpr } = size.current;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const dx = Math.cos(angle), dy = Math.sin(angle);
    for (const p of state.current) {
      p.x += (dx * speed * p.s * dt) / Math.max(w, 1) + Math.sin(t * 0.4 + p.p) * 0.00008;
      p.y += (dy * speed * p.s * dt) / Math.max(h, 1);
      if (p.y < -0.02) p.y = 1.02;
      if (p.y > 1.02) p.y = -0.02;
      if (p.x < -0.02) p.x = 1.02;
      if (p.x > 1.02) p.x = -0.02;
      const tw = 0.6 + 0.4 * Math.sin(t * 1.3 + p.p);
      g.fillStyle = `rgba(${color},${(p.a * tw).toFixed(3)})`;
      g.beginPath();
      g.arc(p.x * w, p.y * h, p.r, 0, 6.2832);
      g.fill();
    }
  });

  if (lite || reduced) return null;
  return <canvas ref={ref} className={`ps-deco ps-particles ${className}`} aria-hidden="true" />;
}
