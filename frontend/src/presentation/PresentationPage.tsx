import { useEffect, useMemo, useState } from 'react';
import '@fontsource-variable/lora';
import '@fontsource-variable/lora/wght-italic.css';
import './presentation.css';
import './scenes.css';
import PerfProvider from './PerfProvider';
import { usePerf } from './perf-context';
import { SCENES } from './scenes';
import { resetStore, getActive } from './scene-store';
import { content } from './content';
import { useTour } from './useTour';
import { scrollToScene } from './lib/scroll';
import Starfield from './fx/Starfield';
import SceneHost from './ui/SceneHost';
import { ExitLink, SceneNav, ScrollProgress, TourBar } from './ui/Chrome';
import { HeroScene } from './scenes/hero';

/**
 * /presentation — cinematic, scroll-based story of OrbitScope (Azerbaijani).
 * Lives outside the shared Layout (like /embed); nothing else in the app depends on it.
 */
function Presentation() {
  const { lite, reduced, kiosk } = usePerf();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const loop = params.get('loop') === '1' || kiosk;
  const tour = useTour(reduced, loop);
  const [hint, setHint] = useState(false);

  // page chrome on <html>: smooth scrolling and a dark scrollbar only while this page is open
  useEffect(() => {
    document.documentElement.classList.add('ps-active');
    const prevTitle = document.title;
    document.title = 'OrbitScope — Təqdimat';
    return () => {
      document.documentElement.classList.remove('ps-active');
      document.title = prevTitle;
      resetStore();
    };
  }, []);

  // deep link: /presentation#blink
  useEffect(() => {
    const id = window.location.hash.replace('#', '');
    if (!id || !SCENES.some((s) => s.id === id)) return;
    const t = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'auto', block: 'start' }), 350);
    return () => window.clearTimeout(t);
  }, []);

  // autostart for exhibitions: /presentation?autoplay=1 (kiosk screens usually add &kiosk=1&loop=1)
  useEffect(() => {
    if (params.get('autoplay') !== '1') return;
    const t = window.setTimeout(tour.start, 1500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keyboard control
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); tour.next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); tour.prev(); }
      else if ((e.key === ' ' || e.key === 'Spacebar') && tour.on && el?.tagName !== 'BUTTON' && el?.tagName !== 'A') { e.preventDefault(); tour.toggle(); }
      else if (e.key === 'Escape') { if (hint) setHint(false); else if (tour.on) tour.stop(); }
      else if (e.key === 'Home') { e.preventDefault(); scrollToScene(SCENES[0].id, reduced); }
      else if (e.key === 'End') { e.preventDefault(); scrollToScene(SCENES[SCENES.length - 1].id, reduced); }
      else if (e.key === '?') setHint((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tour, hint, reduced]);

  const c = content.common.chrome;
  return (
    <div lang="az" className={`ps-root${lite ? ' is-lite' : ''}${reduced ? ' is-reduced' : ''}${kiosk ? ' is-kiosk' : ''}`} data-active-scene={getActive()}>
      <Starfield />
      <ScrollProgress />
      <ExitLink />
      <SceneNav />
      <main className="ps-main">
        {SCENES.map((meta) => (
          <SceneHost key={meta.id} meta={meta} eager={meta.component ? undefined : <HeroScene onStartTour={tour.start} />}
            Lazy={meta.component} />
        ))}
        <div className="ps-pad-bottom" aria-hidden="true" />
      </main>
      <TourBar tour={tour} />
      {hint && (
        <div className="ps-hint" role="dialog" aria-modal="true" onClick={() => setHint(false)}>
          <div className="ps-panel" onClick={(e) => e.stopPropagation()}>
            <p className="ps-h3">{c.tourLabel}</p>
            <p className="ps-body" style={{ marginTop: 10 }}>{c.keys}</p>
            <p className="ps-body" style={{ marginTop: 10 }}>{c.skipHint}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PresentationPage() {
  return (
    <PerfProvider>
      <Presentation />
    </PerfProvider>
  );
}
