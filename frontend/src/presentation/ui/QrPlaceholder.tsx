import { useMemo } from 'react';
import { mulberry32 } from '../lib/rng';

/**
 * A QR-LOOKING DESIGN PLACEHOLDER. It is generated from a fixed seed, is not a valid QR code, and
 * encodes nothing: no Wi-Fi password, no address. The real QR codes exist only on the Pi's own kiosk screen.
 */
export default function QrPlaceholder({ seed = 7, scan = false, className = '' }: { seed?: number; scan?: boolean; className?: string }) {
  const N = 25;
  const cells = useMemo(() => {
    const r = mulberry32(seed);
    const out: [number, number][] = [];
    const inFinder = (x: number, y: number) => (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!inFinder(x, y) && r() > 0.52) out.push([x, y]);
    return out;
  }, [seed]);
  const finder = (x: number, y: number) => (
    <g key={`${x}${y}`}>
      <rect x={x} y={y} width="7" height="7" fill="#02030f" /><rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" /><rect x={x + 2} y={y + 2} width="3" height="3" fill="#02030f" />
    </g>
  );
  return (
    <div className={`qr-ph ${className}`} role="img" aria-label="QR (dizayn nümunəsi)">
      <svg viewBox={`-2 -2 ${N + 4} ${N + 4}`} className="ps-svg">
        <rect x="-2" y="-2" width={N + 4} height={N + 4} rx="2" fill="#fff" />
        {finder(0, 0)}{finder(N - 7, 0)}{finder(0, N - 7)}
        {cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#02030f" />)}
      </svg>
      {scan && <i className="qr-scan" />}
    </div>
  );
}
