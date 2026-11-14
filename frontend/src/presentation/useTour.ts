import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SCENES, TOUR_SCENES } from './scenes';
import { scrollToScene } from './lib/scroll';
import { getActive } from './scene-store';

export interface Tour {
  on: boolean;
  playing: boolean;
  done: boolean;
  index: number;            // position in the tour list
  elapsed: number;          // seconds spent in the current scene (already scaled by speed)
  speed: number;
  currentDuration: number;
  remainingSeconds: number; // real seconds left for the whole tour
  start: () => void;
  stop: () => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  setSpeed: (s: number) => void;
}

/**
 * Timed presentation: walks through the scenes that have `tour` seconds, scrolling to each one.
 * Manual scrolling pauses it; the arrows / buttons move between scenes; speed scales the durations
 * so a talk can be fitted into 4-6 minutes.
 */
export function useTour(reduced: boolean, loop: boolean): Tour {
  const [on, setOn] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [speed, setSpeed] = useState(1);
  const live = useRef({ on, playing, index, elapsed, speed });
  const scrolledDown = useRef(false);
  const lastTick = useRef(0);
  useEffect(() => { live.current = { on, playing, index, elapsed, speed }; });

  const go = useCallback((i: number) => {
    const n = Math.max(0, Math.min(TOUR_SCENES.length - 1, i));
    setIndex(n);
    setElapsed(0);
    setDone(false);
    scrolledDown.current = false;
    scrollToScene(TOUR_SCENES[n].id, reduced);
  }, [reduced]);

  const start = useCallback(() => { setOn(true); setPlaying(true); go(0); }, [go]);
  const stop = useCallback(() => { setOn(false); setPlaying(false); setDone(false); setElapsed(0); }, []);

  const resume = useCallback(() => {
    const cur = getActive();
    const nextIdx = TOUR_SCENES.findIndex((s) => s.n - 1 >= cur);
    const i = nextIdx === -1 ? TOUR_SCENES.length - 1 : nextIdx;
    setOn(true);
    setPlaying(true);
    setDone(false);
    if (i !== live.current.index) go(i); else scrollToScene(TOUR_SCENES[i].id, reduced);
  }, [go, reduced]);

  const toggle = useCallback(() => {
    if (!live.current.on || done) { start(); return; }
    if (live.current.playing) setPlaying(false); else resume();
  }, [done, start, resume]);

  const next = useCallback(() => {
    if (live.current.on) go(live.current.index + 1);
    else {
      const cur = getActive();
      const s = SCENES[Math.min(SCENES.length - 1, cur + 1)];
      scrollToScene(s.id, reduced);
    }
  }, [go, reduced]);
  const prev = useCallback(() => {
    if (live.current.on) go(live.current.index - 1);
    else {
      const cur = getActive();
      scrollToScene(SCENES[Math.max(0, cur - 1)].id, reduced);
    }
  }, [go, reduced]);

  // clock
  useEffect(() => {
    if (!on || !playing) return;
    lastTick.current = performance.now();
    const id = window.setInterval(() => {
      const s = live.current;
      const dur = TOUR_SCENES[s.index].tour;
      // real elapsed time, so a throttled timer (busy Pi, hidden tab) never slows the talk down
      const now = performance.now();
      const dt = Math.min(0.6, (now - lastTick.current) / 1000);
      lastTick.current = now;
      const e = s.elapsed + dt * s.speed;
      // a scene taller than the screen: show its lower part during the second half of its time slot
      if (!scrolledDown.current && e >= dur * 0.5) {
        scrolledDown.current = true;
        const el = document.getElementById(TOUR_SCENES[s.index].id);
        if (el && el.offsetHeight > window.innerHeight * 1.08) {
          const top = el.getBoundingClientRect().bottom + window.scrollY - window.innerHeight;
          window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
        }
      }
      if (e < dur) { setElapsed(e); return; }
      if (s.index + 1 < TOUR_SCENES.length) { go(s.index + 1); return; }
      if (loop) { go(0); return; }
      setPlaying(false);
      setDone(true);
      setElapsed(dur);
    }, 100);
    return () => window.clearInterval(id);
  }, [on, playing, go, loop, reduced]);

  // a manual scroll gesture takes control back from the tour
  useEffect(() => {
    if (!on) return;
    const pause = () => { if (live.current.playing) setPlaying(false); };
    window.addEventListener('wheel', pause, { passive: true });
    window.addEventListener('touchmove', pause, { passive: true });
    return () => { window.removeEventListener('wheel', pause); window.removeEventListener('touchmove', pause); };
  }, [on]);

  const currentDuration = TOUR_SCENES[index]?.tour ?? 0;
  const remainingSeconds = useMemo(() => {
    const after = TOUR_SCENES.slice(index + 1).reduce((a, s) => a + s.tour, 0);
    return (Math.max(0, currentDuration - elapsed) + after) / speed;
  }, [index, elapsed, currentDuration, speed]);

  return { on, playing, done, index, elapsed, speed, currentDuration, remainingSeconds, start, stop, toggle, next, prev, setSpeed };
}
