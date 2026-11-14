import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Maximize, Minimize, Pause, Play, SkipBack, SkipForward, X, Zap } from 'lucide-react';
import { content } from '../content';
import { useActiveScene } from '../hooks';
import { usePerf } from '../perf-context';
import { SCENES, TOUR_SCENES, TOUR_SECONDS } from '../scenes';
import { scrollToScene } from '../lib/scroll';
import type { Tour } from '../useTour';

const fmt = (s: number): string => {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

/** Thin scroll-progress line on top of the page. */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      ref.current?.style.setProperty('--prog', max > 0 ? String(Math.min(1, window.scrollY / max)) : '0');
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return <div ref={ref} className="ps-progress" role="progressbar" aria-label={content.common.chrome.progress}><i /></div>;
}

/** Minimal floating dot navigation: one dot per scene, tooltip on hover/focus, click scrolls. */
export function SceneNav() {
  const active = useActiveScene();
  const { reduced } = usePerf();
  return (
    <nav className="ps-nav" aria-label={content.common.chrome.navLabel}>
      {SCENES.map((s, i) => {
        const label = content.common.nav[s.id as keyof typeof content.common.nav];
        return (
          <a key={s.id} href={`#${s.id}`} className={i === active ? 'is-active' : ''} aria-label={`${s.n}. ${label}`}
            aria-current={i === active ? 'true' : undefined}
            onClick={(e) => { e.preventDefault(); scrollToScene(s.id, reduced); }}>
            <i /><span>{String(s.n).padStart(2, '0')} · {label}</span>
          </a>
        );
      })}
    </nav>
  );
}

export function ExitLink() {
  const c = content.common.chrome;
  return (
    <Link to="/" className="ps-exit" aria-label={c.backToApp}>
      <ArrowLeft size={15} /><span>{c.backToApp}</span>
    </Link>
  );
}

/** Bottom control bar: start/pause/skip the timed tour, speed, lighter animations, fullscreen. */
export function TourBar({ tour }: { tour: Tour }) {
  const c = content.common.chrome;
  const { lite, setLite, reduced } = usePerf();
  const [full, setFull] = useState(false);
  const scene = TOUR_SCENES[tour.index];

  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggleFull = () => {
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen();
    } catch { /* not supported */ }
  };

  const extras = (
    <>
      <button type="button" className={`ibtn${lite ? ' is-on' : ''}`} onClick={() => setLite(!lite)} aria-pressed={lite}
        title={`${c.lite}: ${c.liteHint}`} disabled={reduced}>
        <Zap size={16} /><span className="hide-sm">{c.lite}</span>
      </button>
      <button type="button" className="ibtn" onClick={toggleFull} title={c.fullscreen} aria-label={c.fullscreen}>
        {full ? <Minimize size={16} /> : <Maximize size={16} />}
      </button>
    </>
  );

  if (!tour.on) {
    return (
      <div className="ps-bar" role="toolbar" aria-label={c.tourLabel}>
        <button type="button" className="ibtn start" onClick={tour.start}>
          <Play size={16} /> {c.startTour} · {fmt(TOUR_SECONDS)}
        </button>
        <span className="sep" />
        {extras}
      </div>
    );
  }

  const label = scene ? content.common.nav[scene.id as keyof typeof content.common.nav] : '';
  return (
    <div className="ps-bar" role="toolbar" aria-label={c.tourLabel}>
      <button type="button" className="ibtn" onClick={tour.prev} aria-label={c.prev} title={c.prev}><SkipBack size={16} /></button>
      <button type="button" className="ibtn start" onClick={tour.toggle} aria-label={tour.playing ? c.pause : tour.done ? c.restart : c.resume}>
        {tour.playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <button type="button" className="ibtn" onClick={tour.next} aria-label={c.next} title={c.next}><SkipForward size={16} /></button>
      <div className="meta" aria-live="off">
        <b>{scene ? `${String(scene.n).padStart(2, '0')} · ${label}` : ''}</b>
        <small>{tour.done ? c.tourDone : `${fmt(tour.remainingSeconds)} ${c.remaining}`}</small>
      </div>
      <div className="track" style={{ ['--sp' as string]: tour.currentDuration ? Math.min(1, tour.elapsed / tour.currentDuration) : 0 }}><i /></div>
      <select value={tour.speed} onChange={(e) => tour.setSpeed(Number(e.target.value))} aria-label={c.speed}>
        <option value={0.8}>0.8×</option>
        <option value={1}>1×</option>
        <option value={1.25}>1.25×</option>
        <option value={1.5}>1.5×</option>
      </select>
      <span className="sep" />
      {extras}
      <button type="button" className="ibtn" onClick={tour.stop} aria-label={c.exitTour} title={c.exitTour}><X size={16} /></button>
    </div>
  );
}
