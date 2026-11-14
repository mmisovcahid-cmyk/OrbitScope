import './act1.css';
import { content } from '../content';
import { useCountUp, useCycle, useLoop, useSequence } from '../hooks';
import Badge from '../ui/Badge';
import Reveal from '../ui/Reveal';
import Kicker from '../ui/Kicker';
import { mulberry32 } from '../lib/rng';

/* ------------------------------------------------------------------ 02 */
const BG_STARS = (() => {
  const r = mulberry32(5);
  return Array.from({ length: 70 }, () => ({ x: 14 + r() * 372, y: 14 + r() * 372, r: 0.7 + r() * 1.6, o: 0.3 + r() * 0.65 }));
})();

function Field({ frame }: { frame: 0 | 1 }) {
  const f = frame;
  return (
    <svg viewBox="0 0 400 400" className="ps-svg" role="img" aria-label={content.moving.note}>
      <rect x="0" y="0" width="400" height="400" rx="16" fill="#050827" />
      {BG_STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} />)}
      {/* A: nearby star with proper motion */}
      <g className="mv-glide" style={{ transform: `translate(${f ? 34 : 0}px, ${f ? -16 : 0}px)` }}>
        <circle cx="130" cy="236" r="7" fill="#f6c65b" style={{ filter: 'drop-shadow(0 0 8px #f6c65b)' }} />
        <circle cx="130" cy="236" r="15" fill="none" stroke="#f6c65b" strokeWidth="1.4" strokeDasharray="3 4" />
      </g>
      <g className="mv-fade" style={{ opacity: f ? 1 : 0 }}>
        <circle cx="130" cy="236" r="6" fill="none" stroke="#f6c65b" strokeWidth="1" opacity="0.5" strokeDasharray="2 3" />
        <line x1="136" y1="233" x2="160" y2="223" stroke="#f6c65b" strokeWidth="1.4" markerEnd="url(#mv-arr)" />
      </g>
      {/* B: asteroid crossing the field */}
      <g className="mv-glide" style={{ transform: `translate(${f ? 150 : 0}px, ${f ? 46 : 0}px)` }}>
        <circle cx="60" cy="86" r="5" fill="#43e3ff" style={{ filter: 'drop-shadow(0 0 8px #43e3ff)' }} />
        <circle cx="60" cy="86" r="14" fill="none" stroke="#43e3ff" strokeWidth="1.4" strokeDasharray="3 4" />
      </g>
      <line className="mv-fade" x1="60" y1="86" x2="210" y2="132" stroke="#43e3ff" strokeWidth="1.2" strokeDasharray="4 6" style={{ opacity: f ? 0.8 : 0 }} />
      {/* C: variable star */}
      <g transform="translate(300 290)">
        <circle className="mv-glide" r={f ? 12 : 4} fill="#ff7a90" opacity={f ? 0.95 : 0.7} style={{ filter: 'drop-shadow(0 0 10px #ff7a90)' }} />
        <circle r="22" fill="none" stroke="#ff7a90" strokeWidth="1.4" strokeDasharray="3 4" />
      </g>
      <defs>
        <marker id="mv-arr" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L8 4 L0 8 z" fill="#f6c65b" />
        </marker>
      </defs>
      <text x="16" y="28" className="t-ink t-b" fontSize="18">{f ? content.moving.frame2 : content.moving.frame1}</text>
    </svg>
  );
}

export function S02Moving() {
  const m = content.moving;
  const [frame] = useCycle(2, 2200);
  const f = frame as 0 | 1;
  return (
    <>
      <div className="ps-atmo ps-atmo--moving" />
      <div className="ps-inner ps-grid-2 mv-grid">
        <div className="ps-stack">
          <Kicker n="02">{m.kicker}</Kicker>
          <Reveal i={1} as="h2" className="ps-h2">{m.title[0]}<em>{m.title[1]}</em></Reveal>
          <Reveal i={2} as="blockquote" className="ps-quote">{m.quote}</Reveal>
          <Reveal i={3} as="ul" className="mv-legend">
            <li><i style={{ background: '#f6c65b' }} />{m.legend.star}</li>
            <li><i style={{ background: '#43e3ff' }} />{m.legend.asteroid}</li>
            <li><i style={{ background: '#ff7a90' }} />{m.legend.variable}</li>
          </Reveal>
          <Reveal i={4}><Badge kind="edu" /></Reveal>
          <Reveal i={5} as="p" className="ps-small">{m.caption}</Reveal>
        </div>
        <Reveal i={2} from="right" className="mv-stage ps-panel pad">
          <div className="mv-main"><Field frame={f} /></div>
          <div className="mv-thumbs">
            {[0, 1].map((k) => (
              <div key={k} className={`mv-thumb${f === k ? ' is-on' : ''}`}><Field frame={k as 0 | 1} /></div>
            ))}
          </div>
          <p className="ps-small mv-cap">{m.blink} · {m.note}</p>
        </Reveal>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ 03 */
const HUES = ['#9b6cff', '#6d8bff', '#43b8ff', '#43e3d0', '#f6c65b', '#ff7a6b'];
const LMIN = 0.4;
const LMAX = 5.1;
const wx = (um: number) => 30 + ((um - LMIN) / (LMAX - LMIN)) * 580;

export function S03Spherex() {
  const s = content.spherex;
  const active = useLoop(6, 1500, 600);
  const ch = useCountUp(102, 1600);
  const det = useCountUp(6, 1000);
  const d = s.detectors[active];
  return (
    <>
      <div className="ps-atmo ps-atmo--spherex" />
      <div className="ps-inner ps-grid-2 sx-grid">
        <div className="ps-stack">
          <Kicker n="03">{s.kicker}</Kicker>
          <Reveal i={1} as="h2" className="ps-h2">{s.title[0]}<em>{s.title[1]}</em></Reveal>
          <Reveal i={2} as="p" className="ps-lead">{s.lead}</Reveal>
          <Reveal i={3} as="ul" className="sx-facts">
            {s.facts.map((f, i) => (
              <li key={f.l}>
                <span className="ps-num-lg">{i === 1 ? ch : i === 2 ? det : f.v}<span className="ps-unit">{f.u}</span></span>
                <small>{f.l}</small>
              </li>
            ))}
          </Reveal>
          <Reveal i={4} className="ps-panel pad sx-why">
            <p className="ps-h3 ps-gold">{s.whyTitle}</p>
            <p className="ps-body">{s.whyBody}</p>
          </Reveal>
          <Reveal i={5} className="ps-row"><Badge kind="edu" /><span className="ps-small">{s.edu}</span></Reveal>
        </div>
        <Reveal i={2} from="right" className="ps-panel pad sx-stage">
          <svg viewBox="0 0 640 520" className="ps-svg" role="img" aria-label={s.stages.join(' → ')}>
            <defs>
              <linearGradient id="sx-vis" x1="0" x2="1">
                <stop offset="0" stopColor="#8b2bff" /><stop offset="0.2" stopColor="#3a6bff" /><stop offset="0.45" stopColor="#38e07a" />
                <stop offset="0.7" stopColor="#ffe14a" /><stop offset="1" stopColor="#ff4a3a" />
              </linearGradient>
              <linearGradient id="sx-ir" x1="0" x2="1">
                <stop offset="0" stopColor="#d6264a" /><stop offset="0.5" stopColor="#8e1a58" /><stop offset="1" stopColor="#3d1055" />
              </linearGradient>
              <linearGradient id="sx-body" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#222a7a" /><stop offset="1" stopColor="#0c1040" />
              </linearGradient>
            </defs>
            {/* sky */}
            <g opacity="0.9">
              {[[170, 22], [230, 48], [310, 18], [380, 52], [450, 26], [270, 70], [410, 78]].map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 2.6 : 1.7} fill="#fff" className="ps-pulse" style={{ animationDelay: `${i * 0.35}s` }} />
              ))}
            </g>
            <text x="320" y="106" textAnchor="middle" fontSize="15" className="t-ink">{s.stages[0]}</text>
            {/* incoming light */}
            {[-90, -45, 0, 45, 90].map((dx, i) => (
              <line key={i} x1={320 + dx * 1.7} y1="112" x2={320 + dx * 0.7} y2="168" stroke="#cdbdff" strokeWidth="1.6" className="ps-flow" opacity="0.8" />
            ))}
            {/* telescope */}
            <path d="M232 170 L408 170 L384 262 L256 262 Z" fill="url(#sx-body)" stroke="#8b6cff" strokeWidth="2" />
            <ellipse cx="320" cy="170" rx="88" ry="12" fill="#0b0f3a" stroke="#cdbdff" strokeWidth="2" />
            <line x1="246" y1="208" x2="394" y2="208" stroke="#4a5bd0" strokeWidth="1.2" />
            <line x1="251" y1="236" x2="389" y2="236" stroke="#4a5bd0" strokeWidth="1.2" />
            <text x="320" y="196" textAnchor="middle" fontSize="15" className="t-cyan">{s.stages[1]}</text>
            {/* dispersion */}
            <line x1="320" y1="262" x2="320" y2="300" stroke="#fff" strokeWidth="2" className="ps-flow" />
            <polygon points="296,306 344,306 320,288" fill="rgba(205,189,255,0.25)" stroke="#cdbdff" strokeWidth="1.5" />
            <text x="320" y="330" textAnchor="middle" fontSize="15" className="t-ink">{s.stages[2]}</text>
            {/* fan out */}
            {HUES.map((h, i) => {
              const x = 62 + i * 103;
              const on = i === active;
              return (
                <g key={h}>
                  <line x1="320" y1="306" x2={x} y2="372" stroke={h} strokeWidth={on ? 3 : 1.4} opacity={on ? 1 : 0.4} className={on ? 'ps-flow' : ''}
                    style={on ? { filter: `drop-shadow(0 0 6px ${h})` } : undefined} />
                  <rect x={x - 38} y="372" width="76" height="46" rx="9" fill={on ? 'rgba(20,26,84,0.95)' : 'rgba(10,13,50,0.8)'}
                    stroke={h} strokeWidth={on ? 2.6 : 1.2} style={on ? { filter: `drop-shadow(0 0 10px ${h})` } : undefined} />
                  <text x={x} y="402" textAnchor="middle" fontSize="19" className="t-ink t-b">{s.detectors[i].id}</text>
                </g>
              );
            })}
            <text x="320" y="442" textAnchor="middle" fontSize="15" className="t-ink">{s.stages[3]}</text>
            {/* wavelength ruler */}
            <rect x={wx(0.4)} y="466" width={wx(0.7) - wx(0.4)} height="12" rx="3" fill="url(#sx-vis)" />
            <rect x={wx(0.75)} y="466" width={wx(5.0) - wx(0.75)} height="12" rx="3" fill="url(#sx-ir)" />
            <rect x={wx(d.range[0])} y="460" width={wx(d.range[1]) - wx(d.range[0])} height="24" rx="5" fill="none" stroke={HUES[active]} strokeWidth="2.4"
              style={{ transition: 'all 0.6s', filter: `drop-shadow(0 0 6px ${HUES[active]})` }} />
            <text x={wx(0.4)} y="506" fontSize="13" className="t-ink">{s.visible}</text>
            <text x={wx(2.2)} y="506" fontSize="13" className="t-gold">{s.ir}</text>
          </svg>
          <div className="sx-table" aria-label={s.detectorsTitle}>
            {s.detectors.map((x, i) => (
              <span key={x.id} className={i === active ? 'is-on' : ''} style={{ ['--h' as string]: HUES[i] }}>
                <b>{x.id}</b> {String(x.range[0]).replace('.', ',')}–{String(x.range[1]).replace('.', ',')}
              </span>
            ))}
          </div>
          <p className="ps-small">{s.launch}</p>
          <p className="ps-source">{s.source}</p>
        </Reveal>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ 04 */
const NODE_POS: [number, number][] = [
  [10, 20], [30, 20], [50, 20], [70, 20], [90, 20],
  [90, 78], [70, 78], [50, 78], [30, 78], [10, 78],
];

export function S04Pipeline() {
  const p = content.pipeline;
  const step = useSequence(p.nodes.length, 700, 600);
  const prog = Math.max(0, Math.min(1, step / (p.nodes.length - 1)));
  const path = 'M 100 70 L 900 70 C 1010 70 1010 273 900 273 L 100 273';
  return (
    <>
      <div className="ps-atmo ps-atmo--pipeline" />
      <div className="ps-inner">
        <Kicker n="04">{p.kicker}</Kicker>
        <Reveal i={1} as="h2" className="ps-h2">{p.title[0]}<em>{p.title[1]}</em></Reveal>
        <Reveal i={2} as="p" className="ps-lead">{p.lead}</Reveal>
        <Reveal i={3} className="pl-wrap">
          <svg className="pl-svg ps-svg" viewBox="0 0 1000 350" preserveAspectRatio="none" aria-hidden="true">
            <path d={path} fill="none" stroke="rgba(160,170,255,0.18)" strokeWidth="3" pathLength={100} />
            <path d={path} fill="none" stroke="url(#pl-g)" strokeWidth="4" strokeLinecap="round" pathLength={100} strokeDasharray="100"
              strokeDashoffset={100 - prog * 100} style={{ transition: 'stroke-dashoffset 0.75s linear', filter: 'drop-shadow(0 0 8px #43e3ff)' }} />
            {step >= p.nodes.length && (
              <circle r="6" fill="#fff" style={{ filter: 'drop-shadow(0 0 10px #43e3ff)' }}>
                <animateMotion dur="5s" repeatCount="indefinite" path={path} />
              </circle>
            )}
            <defs>
              <linearGradient id="pl-g" x1="0" x2="1"><stop offset="0" stopColor="#8b6cff" /><stop offset="0.6" stopColor="#43e3ff" /><stop offset="1" stopColor="#f6c65b" /></linearGradient>
            </defs>
          </svg>
          <ol className="pl-list">
            {p.nodes.map((n, i) => (
              <li key={n.t} className={step >= i ? 'on' : ''} style={{ ['--x' as string]: `${NODE_POS[i][0]}%`, ['--y' as string]: `${NODE_POS[i][1]}%` }}>
                <span className="pl-dot">{i + 1}</span>
                <span className="pl-txt"><b>{n.t}</b><small>{n.d}</small></span>
              </li>
            ))}
          </ol>
        </Reveal>
        <Reveal i={4} className="ps-row">
          <Badge kind="impl" />
          <span className="ps-small">{p.cache}</span>
        </Reveal>
        <p className="ps-source">{p.source}</p>
      </div>
    </>
  );
}
