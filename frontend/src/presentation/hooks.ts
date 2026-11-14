import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePerf } from './perf-context';
import { useScene } from './scene-context';
import { getActive, subscribeActive } from './scene-store';

/** Index of the scene that is most visible. */
export const useActiveScene = (): number => useSyncExternalStore(subscribeActive, getActive, getActive);

/**
 * Endless cycle 0..count-1 while the scene is on screen.
 * With reduced motion it stays on the first step (a calm, still composition).
 * The returned setter pins a step for a while (user clicked a chip).
 */
export function useCycle(count: number, ms: number, enabled = true): [number, (i: number) => void] {
  const { active } = useScene();
  const { reduced } = usePerf();
  const [i, setI] = useState(0);
  const hold = useRef(false);
  useEffect(() => {
    if (!active || reduced || !enabled || count < 2) return;
    const id = window.setInterval(() => { if (!hold.current) setI((v) => (v + 1) % count); }, ms);
    return () => window.clearInterval(id);
  }, [active, reduced, enabled, count, ms]);
  const set = (n: number) => {
    hold.current = true;
    setI(n);
    window.setTimeout(() => { hold.current = false; }, ms * 3);
  };
  return [i, set];
}

/**
 * One-shot sequence: -1 before the scene is seen, then 0..count (count = finished).
 * Restarts every time the scene re-enters the screen. Reduced motion: jumps to the end.
 */
export function useSequence(count: number, ms: number, startDelay = 400): number {
  const { active } = useScene();
  const { reduced } = usePerf();
  const [step, setStep] = useState(reduced ? count : -1);
  useEffect(() => {
    if (reduced) { setStep(count); return; }
    if (!active) { setStep(-1); return; }
    let n = 0;
    let id = 0;
    const start = window.setTimeout(() => {
      setStep(0);
      id = window.setInterval(() => {
        n += 1;
        setStep(n);
        if (n >= count) window.clearInterval(id);
      }, ms);
    }, startDelay);
    return () => { window.clearTimeout(start); window.clearInterval(id); };
  }, [active, reduced, count, ms, startDelay]);
  return step;
}

/** Looping sequence: 0..count-1, holds on the last step for `hold` ms and starts over (while on screen). */
export function useLoop(count: number, ms: number, hold = 1800): number {
  const { active } = useScene();
  const { reduced } = usePerf();
  const [step, setStep] = useState(reduced ? count - 1 : 0);
  useEffect(() => {
    if (reduced) { setStep(count - 1); return; }
    if (!active) { setStep(0); return; }
    let n = 0;
    let timer = 0;
    const tick = () => {
      n = (n + 1) % count;
      setStep(n);
      timer = window.setTimeout(tick, n === count - 1 ? ms + hold : ms);
    };
    timer = window.setTimeout(tick, ms);
    return () => window.clearTimeout(timer);
  }, [active, reduced, count, ms, hold]);
  return step;
}

/** requestAnimationFrame loop while the scene is on screen (skipped in lite mode unless `lite: true`). */
export function useFrame(callback: (t: number, dt: number) => void, opts: { lite?: boolean } = {}): void {
  const { active } = useScene();
  const { lite, reduced } = usePerf();
  const cb = useRef(callback);
  useEffect(() => { cb.current = callback; });
  useEffect(() => {
    if (!active || reduced || (lite && !opts.lite)) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      cb.current(now / 1000, Math.min(0.05, (now - last) / 1000));
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, lite, reduced, opts.lite]);
}

/** Animated counter that runs when the scene becomes visible. */
export function useCountUp(target: number, ms = 1400, digits = 0): string {
  const { active, seen } = useScene();
  const { reduced } = usePerf();
  const [v, setV] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced) { setV(target); return; }
    if (!active) return;
    let raf = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      setV(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, reduced, target, ms]);
  return (seen || reduced ? v : 0).toFixed(digits);
}
