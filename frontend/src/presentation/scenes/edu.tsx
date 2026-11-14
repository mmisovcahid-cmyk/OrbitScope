import { useRef, type ReactElement } from 'react';
import { content } from '../content';
import { useCycle, useFrame, useLoop } from '../hooks';
import { usePerf } from '../perf-context';
import { mulberry32 } from '../lib/rng';
import QrPlaceholder from '../ui/QrPlaceholder';

/**
 * Twelve small EDUCATIONAL animations (scene 21). They explain ideas; none of them is a measurement
 * or a capability claim. Each is a 400 x 240 SVG.
 */
const L = () => content.edu.labels;

/** Animated attribute helper: SMIL animations are skipped in lite / reduced-motion mode. */
function useAnim(): boolean {
  const { lite, reduced } = usePerf();
  return !lite && !reduced;
}

function IrVisible(): ReactElement {
  const a = useAnim();
  const l = L();
  return (
    <svg viewBox="0 0 400 240" className="ps-svg" role="img" aria-label={`${l.visible} / ${l.infrared}`}>
      <circle cx="360" cy="120" r="14" fill="#f6c65b" style={{ filter: 'drop-shadow(0 0 14px #f6c65b)' }} />
      <ellipse cx="205" cy="120" rx="46" ry="92" fill="rgba(90,50,30,0.55)" />
      <text x="205" y="124" textAnchor="middle" fontSize="14" className="t-ink">{l.dust}</text>
      {[84, 156].map((y, row) => {
        const color = row === 0 ? '#5aa0ff' : '#ff5a4a';
        return [0, 1, 2].map((k) => (
          <circle key={`${row}${k}`} cx={a ? undefined : 330 - k * 60} cy={y} r="6" fill={color} style={{ filter: `drop-shadow(0 0 6px ${color})` }}>
            {a && <animate attributeName="cx" from="360" to="40" dur="5s" begin={`${k * 1.6}s`} repeatCount="indefinite" />}
            {a && row === 0 && <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.45;0.55;1" dur="5s" begin={`${k * 1.6}s`} repeatCount="indefinite" />}
          </circle>
        ));
      })}
      <text x="40" y="70" fontSize="14" fill="#8cb8ff">{l.visible}</text>
      <text x="40" y="196" fontSize="14" fill="#ff8c80">{l.infrared}</text>
    </svg>
  );
}

function ParallaxArt(): ReactElement {
  const a = useAnim();
  const l = L();
  const layer = (y: number, size: number, dur: number, color: string, label: string) => (
    <g>
      <g>
        {[0, 1, 2, 3, 4, 5].flatMap((p) => [[20, 0], [55, 14], [85, -10]].map(([x, dy], i) => <circle key={`${p}${i}`} cx={x + p * 100} cy={y + dy} r={size} fill={color} />))}
        {a && <animateTransform attributeName="transform" type="translate" from="0 0" to="-100 0" dur={`${dur}s`} repeatCount="indefinite" />}
      </g>
      <text x="14" y={y - 22} fontSize="12" fill={color}>{label}</text>
    </g>
  );
  return (
    <svg viewBox="0 0 400 240" className="ps-svg" role="img" aria-label={`${l.near}, ${l.mid}, ${l.far}`}>
      {layer(50, 1.6, 12, '#aab1da', l.far)}{layer(120, 2.6, 5, '#cdbdff', l.mid)}{layer(190, 4.2, 2.2, '#f6c65b', l.near)}
    </svg>
  );
}

function AsteroidStar(): ReactElement {
  const a = useAnim();
  const l = L();
  const bg = useRef(Array.from({ length: 24 }, (_, i) => { const r = mulberry32(i + 3); return [14 + r() * 372, 14 + r() * 212, 0.8 + r() * 1.5] as const; }));
  return (
    <svg viewBox="0 0 400 240" className="ps-svg" role="img" aria-label={`${l.asteroid} / ${l.star}`}>
      {bg.current.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity="0.6" />)}
      <circle r="4.5" fill="#43e3ff" style={{ filter: 'drop-shadow(0 0 8px #43e3ff)' }} cx={a ? undefined : 300} cy={a ? undefined : 70}>
        {a && <animate attributeName="cx" from="40" to="360" dur="4s" repeatCount="indefinite" />}
        {a && <animate attributeName="cy" from="190" to="60" dur="4s" repeatCount="indefinite" />}
      </circle>
      <line x1="40" y1="190" x2="360" y2="60" stroke="#43e3ff" strokeDasharray="4 6" opacity="0.5" />
      <text x="250" y="52" fontSize="13" className="t-cyan">{l.asteroid}</text>
      <circle r="5.5" fill="#f6c65b" style={{ filter: 'drop-shadow(0 0 8px #f6c65b)' }} cx={a ? undefined : 150} cy={a ? undefined : 150}>
        {a && <animate attributeName="cx" from="120" to="152" dur="16s" repeatCount="indefinite" />}
        {a && <animate attributeName="cy" from="170" to="150" dur="16s" repeatCount="indefinite" />}
      </circle>
      <text x="96" y="196" fontSize="13" className="t-gold">{l.star}</text>
    </svg>
  );
}

function SignalNoise(): ReactElement {
  const [s] = useCycle(5, 1300);
  const l = L();
  const n = [1, 2, 4, 8, 16][s];
  const noise = useRef(Array.from({ length: 60 }, (_, i) => { const r = mulberry32(i + 1); return (r() + r() + r() - 1.5) * 2; }));
  const pts = noise.current.map((nz, i) => {
    const x = 20 + i * 6.1;
    const sig = Math.exp(-Math.pow((i - 30) / 7, 2));
    const y = 190 - 100 * sig - (nz * 36) / Math.sqrt(n);
    return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 400 240" className="ps-svg" role="img" aria-label={`${l.signal}`}>
      <line x1="20" y1="200" x2="386" y2="200" stroke="rgba(160,170,255,0.3)" />
      <path d={pts} fill="none" stroke="#43e3ff" strokeWidth="2" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 5px #43e3ff)' }} />
      <text x="24" y="30" fontSize="18" className="t-ink t-b">N = {n}</text>
      <text x="24" y="50" fontSize="12">{l.exposures}</text>
      <text x="386" y="222" textAnchor="end" fontSize="12" className="t-gold">{l.signal}</text>
    </svg>
  );
}

function WcsArt(): ReactElement {
  const l = L();
  const [i] = useCycle(9, 900);
  const cx = i % 3, cy = Math.floor(i / 3);
  const px = (x: number, y: number): [number, number] => [40 + x * 40, 60 + y * 40];
  const sky = (x: number, y: number): [number, number] => [250 + x * 38 + y * 10, 60 + y * 38 - x * 7];
  return (
    <svg viewBox="0 0 400 240" className="ps-svg" role="img" aria-label={`${l.pixel} → ${l.sky}`}>
      {[0, 1, 2, 3].map((k) => (
        <g key={k}>
          <path d={`M${px(0, k)[0]} ${px(0, k)[1]} H${px(3, k)[0]}`} stroke="rgba(160,170,255,0.35)" /><path d={`M${px(k, 0)[0]} ${px(k, 0)[1]} V${px(k, 3)[1]}`} stroke="rgba(160,170,255,0.35)" />
          <path d={`M${sky(0, k)[0]} ${sky(0, k)[1]} L${sky(3, k)[0]} ${sky(3, k)[1]}`} stroke="rgba(246,198,91,0.45)" /><path d={`M${sky(k, 0)[0]} ${sky(k, 0)[1]} L${sky(k, 3)[0]} ${sky(k, 3)[1]}`} stroke="rgba(246,198,91,0.45)" />
        </g>
      ))}
      <circle cx={px(cx + 0.5, cy + 0.5)[0]} cy={px(cx + 0.5, cy + 0.5)[1]} r="7" fill="#43e3ff" style={{ filter: 'drop-shadow(0 0 8px #43e3ff)' }} />
      <circle cx={sky(cx + 0.5, cy + 0.5)[0]} cy={sky(cx + 0.5, cy + 0.5)[1]} r="7" fill="#f6c65b" style={{ filter: 'drop-shadow(0 0 8px #f6c65b)' }} />
      <path d={`M${px(cx + 0.5, cy + 0.5)[0] + 10} ${px(cx + 0.5, cy + 0.5)[1]} Q 200 20 ${sky(cx + 0.5, cy + 0.5)[0] - 10} ${sky(cx + 0.5, cy + 0.5)[1] - 6}`} fill="none" stroke="#fff" strokeDasharray="4 5" className="ps-flow" />
      <text x="100" y="208" textAnchor="middle" fontSize="14" className="t-cyan">{l.pixel} (x, y)</text>
      <text x="300" y="208" textAnchor="middle" fontSize="14" className="t-gold">{l.sky} (RA, Dec)</text>
    </svg>
  );
}

function Fingerprints(): ReactElement {
  const rows: [string, number[], string][] = [['H₂O', [60, 82, 150, 176, 238], '#43e3ff'], ['CH₄', [96, 116, 196, 210, 300], '#f6c65b'], ['CO', [250, 268, 286, 304, 322], '#ff7a90']];
  return (
    <svg viewBox="0 0 400 240" className="ps-svg" role="img" aria-label={rows.map((r) => r[0]).join(', ')}>
      {rows.map(([name, xs, color], r) => (
        <g key={name}>
          <text x="14" y={62 + r * 66} fontSize="16" fill={color} className="t-b">{name}</text>
          <line x1="70" y1={70 + r * 66} x2="390" y2={70 + r * 66} stroke="rgba(160,170,255,0.3)" />
          {xs.map((x, i) => (
            <rect key={x} className="edu-bar" x={x + 40} y={30 + r * 66} width="5" height="40" rx="2" fill={color} style={{ animationDelay: `${i * 0.25 + r * 0.4}s`, transformOrigin: `${x + 42}px ${70 + r * 66}px` }} />
          ))}
        </g>
      ))}
    </svg>
  );
}

function OrbitGeo(): ReactElement {
  const l = L();
  const a = 130, e = 0.6, b = a * Math.sqrt(1 - e * e), c = a * e;
  const dot = useRef<SVGCircleElement>(null);
  const place = (M: number) => {
    let E = M;
    for (let k = 0; k < 6; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    return [200 + a * Math.cos(E) - c, 120 + b * Math.sin(E)];
  };
  useFrame((t) => { const [x, y] = place((t * 0.5) % (2 * Math.PI)); dot.current?.setAttribute('cx', x.toFixed(1)); dot.current?.setAttribute('cy', y.toFixed(1)); });
  const [x0, y0] = place(1.2);
  return (
    <svg viewBox="0 0 400 240" className="ps-svg" role="img" aria-label={`${l.peri} / ${l.aphe}`}>
      <ellipse cx="200" cy="120" rx={a} ry={b} fill="none" stroke="#8b6cff" strokeWidth="1.6" />
      <circle cx={200 - c} cy="120" r="9" fill="#f6c65b" style={{ filter: 'drop-shadow(0 0 12px #f6c65b)' }} />
      <circle cx={200 + a - c} cy="120" r="3" fill="#43e3ff" /><text x={200 + a - c - 6} y="108" textAnchor="end" fontSize="12" className="t-cyan">{l.peri}</text>
      <circle cx={200 - a - c} cy="120" r="3" fill="#ff7a90" /><text x={200 - a - c + 6} y="108" fontSize="12" fill="#ff9aab">{l.aphe}</text>
      <line x1={200 - a} y1="120" x2={200 + a} y2="120" stroke="rgba(160,170,255,0.3)" strokeDasharray="4 5" transform={`translate(${-c} 0)`} />
      <circle ref={dot} cx={x0} cy={y0} r="6" fill="#fff" style={{ filter: 'drop-shadow(0 0 8px #43e3ff)' }} />
    </svg>
  );
}

function DetectorsArt(): ReactElement {
  const a = useAnim();
  const l = L();
  const hues = ['#9b6cff', '#6d8bff', '#43b8ff', '#43e3d0', '#f6c65b', '#ff7a6b'];
  return (
    <svg viewBox="0 0 400 240" className="ps-svg" role="img" aria-label="D1–D6">
      <defs><linearGradient id="edu-lvf" x1="0" x2="1">{hues.map((h, i) => <stop key={h} offset={i / 5} stopColor={h} />)}</linearGradient></defs>
      <rect x="40" y="50" width="320" height="110" rx="10" fill="url(#edu-lvf)" opacity="0.55" stroke="#9aa6e8" />
      <circle cy="105" r="9" fill="#fff" style={{ filter: 'drop-shadow(0 0 10px #fff)' }} cx={a ? undefined : 200}>
        {a && <animate attributeName="cx" values="60;340;60" dur="8s" repeatCount="indefinite" />}
      </circle>
      <text x="40" y="184" fontSize="13" fill="#9b6cff">{l.blue}</text><text x="360" y="184" textAnchor="end" fontSize="13" fill="#ff8c80">{l.red}</text>
      {hues.map((h, i) => <g key={h}><rect x={44 + i * 52} y="196" width="44" height="26" rx="6" fill="none" stroke={h} /><text x={66 + i * 52} y="214" textAnchor="middle" fontSize="13" className="t-ink">D{i + 1}</text></g>)}
    </svg>
  );
}

function PiProcess(): ReactElement {
  const a = useAnim();
  const l = L();
  return (
    <svg viewBox="0 0 400 240" className="ps-svg" role="img" aria-label={`${l.input} → ${l.cores} → ${l.output}`}>
      <rect x="130" y="60" width="140" height="120" rx="14" fill="#0f3d3a" stroke="#43e3ff" strokeWidth="2" />
      {[0, 1, 2, 3].map((i) => <g key={i}><rect x="148" y={76 + i * 26} width="104" height="16" rx="4" fill="rgba(255,255,255,0.08)" /><rect className="edu-core" x="148" y={76 + i * 26} width="104" height="16" rx="4" fill="#43e3ff" style={{ animationDelay: `${i * 0.35}s` }} /></g>)}
      <text x="200" y="200" textAnchor="middle" fontSize="12">{l.cores}</text>
      {[0, 1, 2].map((k) => <rect key={`i${k}`} width="16" height="16" rx="3" fill="#f6c65b" y="112" x={a ? undefined : 20 + k * 30}>{a && <animate attributeName="x" from="10" to="122" dur="2.4s" begin={`${k * 0.8}s`} repeatCount="indefinite" />}</rect>)}
      {[0, 1, 2].map((k) => <rect key={`o${k}`} width="16" height="16" rx="3" fill="#5be3a8" y="112" x={a ? undefined : 280 + k * 30}>{a && <animate attributeName="x" from="278" to="380" dur="2.4s" begin={`${k * 0.8 + 1.2}s`} repeatCount="indefinite" />}</rect>)}
      <text x="40" y="150" fontSize="12" className="t-gold">{l.input}</text><text x="350" y="150" textAnchor="middle" fontSize="12" fill="#5be3a8">{l.output}</text>
    </svg>
  );
}

function OfflineCache(): ReactElement {
  const l = L();
  const phase = useLoop(2, 3600, 0);
  const off = phase === 1;
  return (
    <svg viewBox="0 0 400 240" className="ps-svg" role="img" aria-label={`${l.online} / ${l.offline}`}>
      <path d="M40 70 a18 18 0 0 1 34 -6 a15 15 0 0 1 14 20 h-54 a12 12 0 0 1 6 -14 z" fill="rgba(67,227,255,0.15)" stroke="#43e3ff" strokeWidth="2" style={{ opacity: off ? 0.3 : 1, transition: 'opacity 0.6s' }} />
      <path d="M92 88 L170 120" stroke={off ? '#ff7a90' : '#43e3ff'} strokeWidth="2.4" strokeDasharray={off ? '4 7' : undefined} className={off ? '' : 'ps-flow'} />
      <rect x="170" y="96" width="90" height="56" rx="10" fill="#0f3d3a" stroke="#43e3ff" strokeWidth="2" />
      <path d="M215 152 V190" stroke="#8b6cff" strokeWidth="2.4" className="ps-flow" style={{ opacity: off ? 0.3 : 1 }} />
      <ellipse cx="215" cy="204" rx="34" ry="10" fill="rgba(139,108,255,0.3)" stroke="#8b6cff" /><rect x="181" y="196" width="68" height="14" fill="rgba(139,108,255,0.3)" stroke="none" /><ellipse cx="215" cy="210" rx="34" ry="10" fill="rgba(139,108,255,0.3)" stroke="#8b6cff" />
      <text x="263" y="210" fontSize="12">{l.disk}</text>
      <path d="M260 124 H330" stroke="#5be3a8" strokeWidth="2.4" className="ps-flow" />
      <rect x="330" y="86" width="34" height="62" rx="7" fill="#0b0f3a" stroke="#9aa6e8" strokeWidth="2" />
      <text x="60" y="118" fontSize="13" className={off ? '' : 't-cyan'}>{off ? l.offline : l.online}</text>
    </svg>
  );
}

function LocalAp(): ReactElement {
  const step = useLoop(4, 1400, 1800);
  return (
    <svg viewBox="0 0 400 240" className="ps-svg" role="img" aria-label="Wi-Fi">
      <rect x="170" y="100" width="60" height="40" rx="8" fill="#0f3d3a" stroke="#43e3ff" strokeWidth="2" />
      {[0, 1, 2].map((i) => <circle key={i} cx="200" cy="120" r="30" fill="none" stroke="#5be3a8" strokeWidth="1.6" className="edu-ring" style={{ animationDelay: `${i * 0.9}s` }} />)}
      {[[70, 50], [330, 60], [320, 190], [80, 180]].map(([x, y], i) => (
        <g key={i} style={{ opacity: step >= i ? 1 : 0.15, transition: 'opacity 0.5s' }}>
          <rect x={x - 12} y={y - 22} width="24" height="44" rx="6" fill="#0b0f3a" stroke="#9aa6e8" strokeWidth="1.6" />
          <path d={`M200 120 L${x} ${y}`} stroke="#5be3a8" strokeWidth="1.4" strokeDasharray="3 5" />
        </g>
      ))}
    </svg>
  );
}

function QrAccess(): ReactElement {
  const step = useLoop(3, 1700, 1800);
  return (
    <svg viewBox="0 0 400 240" className="ps-svg" role="img" aria-label="QR → 10.42.0.1">
      <foreignObject x="30" y="60" width="110" height="110"><QrPlaceholder seed={5} scan={step === 0} /></foreignObject>
      <path d="M150 115 H210" stroke="#43e3ff" strokeWidth="2.4" className="ps-flow" />
      <rect x="216" y="86" width="150" height="58" rx="10" fill="#0b0f3a" stroke={step >= 1 ? '#43e3ff' : 'rgba(160,170,255,0.3)'} strokeWidth="2" />
      <text x="290" y="122" textAnchor="middle" fontSize="18" className={step >= 1 ? 't-cyan t-b' : ''}>{step >= 1 ? '10.42.0.1' : '…'}</text>
      <rect x="236" y="164" width="110" height="52" rx="8" fill="rgba(67,227,255,0.1)" stroke="#43e3ff" style={{ opacity: step >= 2 ? 1 : 0, transition: 'opacity 0.6s' }} />
    </svg>
  );
}

const ART: (() => ReactElement)[] = [IrVisible, ParallaxArt, AsteroidStar, SignalNoise, WcsArt, Fingerprints, OrbitGeo, DetectorsArt, PiProcess, OfflineCache, LocalAp, QrAccess];

export default function EduArt({ index }: { index: number }): ReactElement {
  const Art = ART[index] ?? IrVisible;
  return <Art />;
}
