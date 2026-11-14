import { createContext, useContext } from 'react';

/**
 * Performance / motion profile of the presentation.
 *  - lite:    lighter animations for a Raspberry Pi kiosk or any weak device (no canvas particles,
 *             no blur, simple fades). Turned on by ?kiosk=1, ?lite=1, the toggle, or reduced motion.
 *  - reduced: the visitor asked the OS for reduced motion; every scene shows its end state.
 *  - kiosk:   the page runs on the Pi's own screen (same flag the Pi build uses: ?kiosk=1).
 */
export interface Perf {
  lite: boolean;
  reduced: boolean;
  kiosk: boolean;
  setLite: (value: boolean) => void;
}

export const PerfContext = createContext<Perf>({ lite: false, reduced: false, kiosk: false, setLite: () => undefined });

export const usePerf = (): Perf => useContext(PerfContext);

const LITE_KEY = 'orbitscope.presentation.lite';
const KIOSK_KEY = 'orbitscope.kiosk'; // same key as the Pi frontend's lib/kiosk.ts

export function readKiosk(): boolean {
  if (typeof window === 'undefined') return false;
  const q = new URLSearchParams(window.location.search).get('kiosk');
  try {
    if (q === '1' || q === 'true') sessionStorage.setItem(KIOSK_KEY, '1');
    if (q === '0' || q === 'false') sessionStorage.removeItem(KIOSK_KEY);
    return sessionStorage.getItem(KIOSK_KEY) === '1';
  } catch {
    return q === '1' || q === 'true';
  }
}

export function readLitePreference(kiosk: boolean): boolean {
  if (typeof window === 'undefined') return false;
  const q = new URLSearchParams(window.location.search).get('lite');
  if (q === '1' || q === 'true') return true;
  if (q === '0' || q === 'false') return false;
  try {
    const stored = localStorage.getItem(LITE_KEY);
    if (stored === '1') return true;
    if (stored === '0') return kiosk ? true : false;
  } catch { /* storage may be blocked */ }
  return kiosk;
}

export function storeLitePreference(value: boolean): void {
  try { localStorage.setItem(LITE_KEY, value ? '1' : '0'); } catch { /* ignore */ }
}
