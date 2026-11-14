import { Suspense, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { usePerf } from '../perf-context';
import { SceneContext } from '../scene-context';
import { reportRatio } from '../scene-store';
import type { SceneMeta } from '../scenes';

interface Props {
  meta: SceneMeta;
  eager?: ReactNode;
  Lazy?: ComponentType | null;
}

/**
 * One full-height scene: reports how visible it is, drives the reveal (`is-in`), publishes a scroll
 * progress variable (`--p`, 0..1) for parallax, and renders its (lazy) content only when it is near the screen.
 */
export default function SceneHost({ meta, eager, Lazy }: Props) {
  const ref = useRef<HTMLElement>(null);
  const { lite, reduced } = usePerf();
  const [near, setNear] = useState(meta.n <= 2);
  const [active, setActive] = useState(false);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setNear(true); setActive(true); setSeen(true); return; }
    const vh = () => window.innerHeight || 800;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const visible = e.intersectionRect.height;
        const need = Math.min(vh() * 0.38, e.boundingClientRect.height * 0.4);
        const on = e.isIntersecting && visible >= need;
        setActive(on);
        if (on) setSeen(true);
        reportRatio(meta.n - 1, e.isIntersecting ? visible / vh() : 0);
      }
    }, { threshold: [0, 0.05, 0.15, 0.25, 0.35, 0.5, 0.65, 0.8, 1] });
    io.observe(el);
    const near$ = new IntersectionObserver(([e]) => { if (e.isIntersecting) setNear(true); }, { rootMargin: '90% 0px' });
    near$.observe(el);
    return () => { io.disconnect(); near$.disconnect(); reportRatio(meta.n - 1, 0); };
  }, [meta.n]);

  // scroll progress as a CSS variable (no React re-render)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (lite || reduced) { el.style.setProperty('--p', '0.5'); return; }
    let raf = 0;
    let on = false;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
      el.style.setProperty('--p', p.toFixed(4));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !on) { on = true; window.addEventListener('scroll', onScroll, { passive: true }); update(); }
      if (!e.isIntersecting && on) { on = false; window.removeEventListener('scroll', onScroll); }
    }, { rootMargin: '20% 0px' });
    io.observe(el);
    return () => { io.disconnect(); window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [lite, reduced]);

  const cls = `ps-scene ps-scene--${meta.id}${active ? ' is-active' : ''}${seen || reduced ? ' is-in' : ''}`;
  return (
    <section ref={ref} id={meta.id} data-scene={meta.n} className={cls} aria-label={`${meta.n}`}>
      <SceneContext.Provider value={{ active, seen, index: meta.n - 1 }}>
        {eager ?? (near && Lazy ? <Suspense fallback={null}><Lazy /></Suspense> : null)}
      </SceneContext.Provider>
    </section>
  );
}
