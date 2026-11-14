import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { PerfContext, readKiosk, readLitePreference, storeLitePreference } from './perf-context';

/** Detects kiosk / lite / reduced-motion once and keeps them reactive. */
export default function PerfProvider({ children }: { children: ReactNode }) {
  const [kiosk] = useState(readKiosk);
  const [liteChoice, setLiteChoice] = useState(() => readLitePreference(readKiosk()));
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  const setLite = useCallback((value: boolean) => {
    setLiteChoice(value);
    storeLitePreference(value);
  }, []);

  const value = useMemo(
    () => ({ kiosk, reduced, lite: liteChoice || reduced, setLite }),
    [kiosk, reduced, liteChoice, setLite],
  );
  return <PerfContext.Provider value={value}>{children}</PerfContext.Provider>;
}
