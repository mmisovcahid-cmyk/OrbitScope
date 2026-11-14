import { usePerf } from '../perf-context';

/**
 * Schematic top view of a Raspberry Pi 5 board. This is an ILLUSTRATIVE drawing made for the
 * presentation (not an official photo and not to scale); no hardware specification is derived from it.
 */
export default function PiBoard({ className = '', cooler = true, label }: { className?: string; cooler?: boolean; label?: string }) {
  const { lite, reduced } = usePerf();
  const spin = !lite && !reduced;
  return (
    <svg viewBox="0 0 350 230" className={`ps-svg pi-board ${className}`} role="img" aria-label={label ?? 'Raspberry Pi 5'}>
      <defs>
        <linearGradient id="pb-pcb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#103f45" /><stop offset="1" stopColor="#09222e" /></linearGradient>
        <linearGradient id="pb-metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#b8bfd6" /><stop offset="1" stopColor="#6b7392" /></linearGradient>
        <radialGradient id="pb-glow"><stop offset="0" stopColor="#43e3ff" stopOpacity="0.5" /><stop offset="1" stopColor="#43e3ff" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="175" cy="120" rx="190" ry="120" fill="url(#pb-glow)" opacity="0.35" />
      {/* board */}
      <rect x="22" y="20" width="296" height="190" rx="14" fill="url(#pb-pcb)" stroke="#43e3ff" strokeWidth="1.4" />
      {[[36, 34], [304, 34], [36, 196], [304, 196]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="4.5" fill="#02030f" stroke="#f6c65b" strokeWidth="1.2" />)}
      {/* GPIO header */}
      <rect x="70" y="26" width="200" height="17" rx="2" fill="#0a0a12" />
      {Array.from({ length: 20 }, (_, i) => (
        <g key={i}><circle cx={77 + i * 9.7} cy="31.5" r="1.7" fill="#f6c65b" /><circle cx={77 + i * 9.7} cy="37.5" r="1.7" fill="#f6c65b" /></g>
      ))}
      {/* board traces */}
      <g stroke="rgba(67,227,255,0.22)" strokeWidth="1" fill="none">
        <path d="M60 60 H120 V84" /><path d="M250 60 H236 V96" /><path d="M60 150 H110 V176 H150" /><path d="M250 164 H214 V140" />
        <path d="M80 100 H110" /><path d="M236 150 H286" />
      </g>
      {/* RAM + misc chips */}
      <rect x="214" y="100" width="36" height="26" rx="3" fill="#121320" stroke="rgba(255,255,255,0.18)" />
      <rect x="64" y="104" width="30" height="22" rx="3" fill="#121320" stroke="rgba(255,255,255,0.18)" />
      <rect x="64" y="136" width="22" height="16" rx="2" fill="#121320" stroke="rgba(255,255,255,0.18)" />
      {/* SoC heat spreader */}
      <rect x="128" y="82" width="74" height="74" rx="6" fill="url(#pb-metal)" stroke="#e8ecff" strokeWidth="0.8" />
      {Array.from({ length: 7 }, (_, i) => <line key={i} x1={138 + i * 9} y1="88" x2={138 + i * 9} y2="150" stroke="rgba(10,12,40,0.45)" strokeWidth="2" />)}
      {/* active cooler (fan) */}
      {cooler && (
        <g transform="translate(165 119)">
          <circle r="42" fill="rgba(8,10,40,0.55)" stroke="#8b6cff" strokeWidth="1.6" />
          <g className={spin ? 'pi-fan' : undefined}>
            {[0, 72, 144, 216, 288].map((a) => (
              <path key={a} transform={`rotate(${a})`} d="M0 0 C 8 -12 22 -26 14 -36 C 4 -34 -4 -20 0 0 Z" fill="rgba(205,189,255,0.78)" stroke="#cdbdff" strokeWidth="0.6" />
            ))}
          </g>
          <circle r="7" fill="#161c5c" stroke="#43e3ff" strokeWidth="1.4" />
        </g>
      )}
      {/* right edge: USB x4 + Ethernet */}
      <rect x="292" y="48" width="46" height="34" rx="3" fill="#2a2f55" stroke="#9aa6e8" /><rect x="298" y="56" width="34" height="7" fill="#2f6bff" /><rect x="298" y="68" width="34" height="7" fill="#2f6bff" />
      <rect x="292" y="86" width="46" height="34" rx="3" fill="#2a2f55" stroke="#9aa6e8" /><rect x="298" y="94" width="34" height="7" fill="#0a0a12" /><rect x="298" y="106" width="34" height="7" fill="#0a0a12" />
      <rect x="292" y="126" width="46" height="46" rx="3" fill="url(#pb-metal)" stroke="#e8ecff" /><rect x="300" y="134" width="30" height="30" rx="2" fill="#10122c" />
      <circle cx="304" cy="168" r="2.2" fill="#5be3a8" /><circle cx="326" cy="168" r="2.2" fill="#f6c65b" />
      {/* left edge: USB-C power + 2 micro-HDMI */}
      <rect x="6" y="164" width="30" height="20" rx="5" fill="url(#pb-metal)" stroke="#e8ecff" /><rect x="12" y="170" width="18" height="8" rx="3" fill="#10122c" />
      <rect x="8" y="138" width="26" height="14" rx="3" fill="url(#pb-metal)" stroke="#e8ecff" /><rect x="8" y="114" width="26" height="14" rx="3" fill="url(#pb-metal)" stroke="#e8ecff" />
      {/* microSD card */}
      <rect x="0" y="52" width="40" height="30" rx="3" fill="#161a44" stroke="#f6c65b" strokeDasharray="3 3" />
      <path d="M6 58 h26 M6 64 h26" stroke="#f6c65b" strokeWidth="1.2" opacity="0.7" />
      {/* bottom connectors */}
      <rect x="72" y="196" width="62" height="9" rx="2" fill="#e9e9f3" opacity="0.85" /><rect x="156" y="196" width="62" height="9" rx="2" fill="#e9e9f3" opacity="0.85" />
      <rect x="240" y="196" width="22" height="9" rx="2" fill="#e9e9f3" opacity="0.85" />
      {/* status LEDs */}
      <circle cx="52" cy="190" r="2.4" fill="#ff7a90" className="ps-pulse" /><circle cx="60" cy="190" r="2.4" fill="#5be3a8" className="ps-pulse" style={{ animationDelay: '0.7s' }} />
    </svg>
  );
}
