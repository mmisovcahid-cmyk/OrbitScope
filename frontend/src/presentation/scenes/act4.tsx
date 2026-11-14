import './act4.css';
import { useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { content } from '../content';
import { useCycle, useFrame } from '../hooks';
import { useScene } from '../scene-context';
import { useJson } from '../lib/useJson';
import Badge from '../ui/Badge';
import Kicker from '../ui/Kicker';
import Reveal from '../ui/Reveal';

const comma = (s: string | number): string => String(s).replace('.', ',');
const D2R = Math.PI / 180;

/* ------------------------------------------------------------------ 10 */
interface Orbit { des: string; a: number; e: number; i: number; q: number; om: number; w: number; varpi: number; in_sample: boolean; in_literature: boolean; }
interface Stat { n: number; mean_deg: number; R: number; p: number; }
interface OrbitFile {
  exported_at: string;
  varpi: Stat;
  literature: { n: number; varpi: Stat };
  objects: Orbit[];
}

const C = 320, RM = 296, RMAX = 1300, R0 = 12;
const radial = (r: number): number => (RM * Math.log(1 + r / R0)) / Math.log(1 + RMAX / R0);

/** Position of an orbit at true anomaly nu, projected on the ecliptic plane (AU). */
function sky(o: Orbit, nu: number): { x: number; y: number; r: number } {
  const p = o.a * (1 - o.e * o.e);
  const r = p / (1 + o.e * Math.cos(nu));
  const u = o.w * D2R + nu, om = o.om * D2R, inc = o.i * D2R;
  return {
    x: r * (Math.cos(om) * Math.cos(u) - Math.sin(om) * Math.sin(u) * Math.cos(inc)),
    y: r * (Math.sin(om) * Math.cos(u) + Math.cos(om) * Math.sin(u) * Math.cos(inc)),
    r,
  };
}
const screen = (x: number, y: number): [number, number] => {
  const r = Math.hypot(x, y) || 1e-9;
  const R = radial(r);
  return [C + (x / r) * R, C - (y / r) * R];
};

function orbitPath(o: Orbit): string {
  let d = '';
  let pen = false;
  for (let k = 0; k <= 360; k += 2) {
    const nu = -Math.PI + (k * Math.PI) / 180;
    const s = sky(o, nu);
    if (s.r > RMAX) { pen = false; continue; }
    const [x, y] = screen(s.x, s.y);
    d += `${pen ? ' L' : ' M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    pen = true;
  }
  return d;
}

function kepler(o: Orbit, M: number): number {
  let E = M;
  for (let k = 0; k < 7; k++) E -= (E - o.e * Math.sin(E) - M) / (1 - o.e * Math.cos(E));
  return 2 * Math.atan2(Math.sqrt(1 + o.e) * Math.sin(E / 2), Math.sqrt(1 - o.e) * Math.cos(E / 2));
}

const PLANETS = [5.2, 9.6, 19.2, 30.1];

function OrbitStage({ data }: { data: OrbitFile }) {
  const t = content.planetNine;
  const lit = useMemo(() => data.objects.filter((o) => o.in_literature), [data]);
  const rest = useMemo(() => data.objects.filter((o) => !o.in_literature), [data]);
  const paths = useMemo(() => ({ lit: lit.map(orbitPath), rest: rest.map(orbitPath) }), [lit, rest]);
  const dots = useRef<(SVGCircleElement | null)[]>([]);
  const meanDir = data.literature.varpi.mean_deg;
  const [tx, ty] = screen(Math.cos(meanDir * D2R) * 900, Math.sin(meanDir * D2R) * 900);

  useFrame((time) => {
    lit.forEach((o, i) => {
      const el = dots.current[i];
      if (!el) return;
      const speed = 0.9 / Math.pow(Math.max(o.a, 80) / 200, 0.5);
      const M = ((time * speed * 0.12 + i * 0.9) % (2 * Math.PI));
      const nu = kepler(o, M);
      const s = sky(o, nu);
      if (s.r > RMAX) { el.setAttribute('opacity', '0'); return; }
      const [x, y] = screen(s.x, s.y);
      el.setAttribute('cx', x.toFixed(1));
      el.setAttribute('cy', y.toFixed(1));
      el.setAttribute('opacity', '1');
    });
  });

  return (
    <svg viewBox="0 0 640 640" className="ps-svg p9-svg" role="img" aria-label={t.scaleNote}>
      <defs>
        <radialGradient id="p9-sun"><stop offset="0" stopColor="#fff6d0" /><stop offset="0.4" stopColor="#f6c65b" /><stop offset="1" stopColor="#f6c65b" stopOpacity="0" /></radialGradient>
        <radialGradient id="p9-ring"><stop offset="0.8" stopColor="#8b6cff" stopOpacity="0" /><stop offset="1" stopColor="#8b6cff" stopOpacity="0.3" /></radialGradient>
      </defs>
      {/* hypothetical region of the planet (distance only; its position is unknown) */}
      <circle cx={C} cy={C} r={radial(500)} fill="rgba(139,108,255,0.07)" stroke="#8b6cff" strokeWidth="1" strokeDasharray="3 6" />
      <circle cx={C} cy={C} r={radial(300)} fill="#050827" stroke="#8b6cff" strokeWidth="1" strokeDasharray="3 6" />
      <text x={C} y={C - radial(500) - 6} textAnchor="middle" fontSize="13" fill="#b9a6ff">{t.ringLabel}</text>
      {PLANETS.map((r) => <circle key={r} cx={C} cy={C} r={radial(r)} fill="none" stroke="rgba(180,190,255,0.32)" />)}
      <text x={C + radial(30.1) * 0.72 + 4} y={C - radial(30.1) * 0.72 - 4} fontSize="13" className="t-ink">{t.neptune}</text>
      {paths.rest.map((d, i) => <path key={i} d={d} fill="none" stroke="rgba(150,140,255,0.34)" strokeWidth="0.9" className="p9-orbit" style={{ animationDelay: `${i * 25}ms` }} />)}
      {paths.lit.map((d, i) => <path key={i} d={d} fill="none" stroke="#f6c65b" strokeWidth="1.3" opacity="0.85" className="p9-orbit" style={{ animationDelay: `${600 + i * 70}ms`, filter: 'drop-shadow(0 0 3px rgba(246,198,91,0.7))' }} />)}
      {lit.map((o, i) => <circle key={o.des} ref={(el) => { dots.current[i] = el; }} r="3.6" fill="#fff" opacity="0" style={{ filter: 'drop-shadow(0 0 6px #f6c65b)' }} />)}
      <line x1={C} y1={C} x2={tx} y2={ty} stroke="#f6c65b" strokeWidth="1.4" strokeDasharray="2 6" opacity="0.7" />
      <circle cx={C} cy={C} r="20" fill="url(#p9-sun)" />
      <circle cx={C} cy={C} r="5" fill="#fff6d0" />
      <text x={C + 12} y={C + 22} fontSize="13" className="t-gold">{t.sun}</text>
    </svg>
  );
}

function Rose({ objs, stat, color, title, note }: { objs: Orbit[]; stat: Stat; color: string; title: string; note: string }) {
  const t = content.planetNine;
  const { seen } = useScene();
  const c = 130, rr = 112;
  const dir = (deg: number, len: number): [number, number] => [c + Math.cos(deg * D2R) * len, c - Math.sin(deg * D2R) * len];
  const [ax, ay] = dir(stat.mean_deg, rr * stat.R);
  return (
    <div className="p9-rose">
      <svg viewBox="0 0 260 260" className="ps-svg" role="img" aria-label={title}>
        <circle cx={c} cy={c} r={rr} fill="rgba(5,8,39,0.8)" stroke="rgba(180,190,255,0.35)" />
        <circle cx={c} cy={c} r={rr / 2} fill="none" stroke="rgba(180,190,255,0.12)" />
        <line x1={c - rr} y1={c} x2={c + rr} y2={c} stroke="rgba(180,190,255,0.12)" />
        <line x1={c} y1={c - rr} x2={c} y2={c + rr} stroke="rgba(180,190,255,0.12)" />
        {objs.map((o, i) => {
          const [x0, y0] = dir(o.varpi, rr - 12), [x1, y1] = dir(o.varpi, rr + 1);
          return <line key={o.des} x1={x0} y1={y0} x2={x1} y2={y1} stroke={color} strokeWidth="3" strokeLinecap="round"
            style={{ opacity: seen ? 0.9 : 0, transition: 'opacity 0.5s', transitionDelay: `${300 + i * 45}ms` }} />;
        })}
        <line x1={c} y1={c} x2={ax} y2={ay} stroke="#fff" strokeWidth="3.4" strokeLinecap="round" pathLength={100} strokeDasharray="100"
          strokeDashoffset={seen ? 0 : 100} style={{ transition: 'stroke-dashoffset 1.6s ease 1.8s', filter: `drop-shadow(0 0 6px ${color})` }} />
        <circle cx={c} cy={c} r="4" fill="#fff" />
      </svg>
      <p className="ps-h3" style={{ color }}>{title}</p>
      <p className="ps-small">{note}</p>
      <ul className="p9-stat">
        <li><b>{stat.n}</b> {t.n}</li>
        <li>{t.mean} <b>{comma(stat.mean_deg.toFixed(0))}°</b></li>
        <li>{t.strength} <b>{comma(stat.R.toFixed(2))}</b></li>
        <li>{t.p} ≈ <b>{stat.p < 0.001 ? `${comma((stat.p * 1e4).toFixed(0))}×10⁻⁴` : comma(stat.p.toFixed(2))}</b></li>
      </ul>
    </div>
  );
}

export function S10PlanetNine() {
  const t = content.planetNine;
  const { data, error } = useJson<OrbitFile>('/presentation/data/planetx-orbits.json');
  const [tab, pin] = useCycle(2, 11000);
  const lit = useMemo(() => (data ? data.objects.filter((o) => o.in_literature) : []), [data]);
  const all = useMemo(() => (data ? data.objects.filter((o) => o.in_sample) : []), [data]);
  return (
    <>
      <div className="ps-atmo ps-atmo--p9" />
      <div className="ps-inner p9-grid">
        <div className="ps-stack p9-text">
          <Kicker n="10">{t.kicker}</Kicker>
          <Reveal i={1} as="h2" className="ps-h2">{t.title[0]}<em>{t.title[1]}</em></Reveal>
          <Reveal i={2} as="p" className="ps-lead">{t.lead}</Reveal>
          <Reveal i={3} className="p9-must">{t.must}</Reveal>
          <Reveal i={4} className="ps-row"><Badge kind="impl">{content.common.badges.real}</Badge><Badge kind="lit" /></Reveal>
          <Reveal i={5} className="ps-row"><Link to="/planetx" className="ps-btn ps-btn--gold">{t.open}</Link></Reveal>
        </div>
        <Reveal i={2} from="right" className="ps-panel pad p9-stage">
          <div className="p9-tabs" role="tablist">
            {t.tabs.map((x, i) => (
              <button key={x} type="button" role="tab" aria-selected={tab === i} className={`ps-chip${tab === i ? ' is-on' : ''}`} onClick={() => pin(i)}>{x}</button>
            ))}
            <span className="p9-legend"><i style={{ background: '#f6c65b' }} />{t.legendLit}<i style={{ background: '#9a8cff' }} />{t.legendAll}</span>
          </div>
          {data ? (
            tab === 0 ? (
              <OrbitStage data={data} />
            ) : (
              <div className="p9-compare">
                <div className="p9-roses">
                  <Rose objs={lit} stat={data.literature.varpi} color="#f6c65b" title={t.sampleLit} note={t.sampleLitNote} />
                  <Rose objs={all} stat={data.varpi} color="#9a8cff" title={t.sampleAll} note={t.sampleAllNote} />
                </div>
                <p className="ps-small">{t.rayleighTitle} {t.rayleighBody}</p>
                <div className="p9-bias">
                  <p className="ps-h3 ps-gold">{t.biasTitle}</p>
                  <ul>{t.bias.map((b) => <li key={b}>{b}</li>)}</ul>
                </div>
              </div>
            )
          ) : <p className="ps-small">{error ? t.loadError : '…'}</p>}
          <p className="ps-source">{t.scaleNote} {data ? `${t.snapshot}: ${data.exported_at.slice(8, 10)}.${data.exported_at.slice(5, 7)}.${data.exported_at.slice(0, 4)}.` : ''}</p>
        </Reveal>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ 11 */
function MiniBlink() {
  return (
    <svg viewBox="0 0 200 110" className="eco-art ps-svg" aria-hidden="true">
      {[0, 1, 2].map((k) => (
        <g key={k} className="eco-frame" style={{ animationDelay: `${k * 1.2}s` }}>
          <rect x="30" y="8" width="140" height="94" rx="8" fill="#050827" stroke="rgba(160,170,255,0.3)" />
          {[[60, 30], [120, 44], [90, 80], [150, 82], [48, 70]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.6" fill="#fff" />)}
          <circle cx={78 + k * 14} cy={62 - k * 9} r="4.5" fill="#f6c65b" style={{ filter: 'drop-shadow(0 0 6px #f6c65b)' }} />
        </g>
      ))}
    </svg>
  );
}
function MiniDetect() {
  return (
    <svg viewBox="0 0 200 110" className="eco-art ps-svg" aria-hidden="true">
      <path d="M22 86 L178 26" stroke="#f6c65b" strokeWidth="1.8" strokeDasharray="4 5" className="eco-line" />
      {[[22, 86], [67, 68], [112, 50], [178, 26]].map(([x, y], i) => (
        <g key={i} className="eco-dot" style={{ animationDelay: `${i * 0.45}s` }}>
          <circle cx={x} cy={y} r="4.5" fill="#43e3ff" /><circle cx={x} cy={y} r="11" fill="none" stroke="#43e3ff" strokeDasharray="2 3" />
        </g>
      ))}
      <g className="eco-blink"><circle cx="150" cy="86" r="3.6" fill="#ff7a90" /><path d="M143 79 L157 93 M157 79 L143 93" stroke="#ff7a90" strokeWidth="1.6" /></g>
    </svg>
  );
}
function MiniSky() {
  return (
    <svg viewBox="0 0 200 110" className="eco-art ps-svg" aria-hidden="true">
      <ellipse cx="100" cy="55" rx="92" ry="46" fill="#070a30" stroke="rgba(160,170,255,0.4)" />
      <path d="M12 60 Q 60 20 100 52 T 188 46" stroke="rgba(205,189,255,0.6)" strokeWidth="5" fill="none" opacity="0.7" />
      <path d="M12 74 Q 60 90 100 62 T 188 70" stroke="#f6c65b" strokeDasharray="5 4" fill="none" opacity="0.8" />
      {[[48, 42], [84, 70], [128, 38], [150, 66], [112, 56]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.4" fill="#43e3ff" className="ps-pulse" style={{ animationDelay: `${i * 0.4}s` }} />)}
    </svg>
  );
}
function MiniCompare() {
  return (
    <div className="eco-art eco-cmp" aria-hidden="true">
      <div className="eco-cmp-a" />
      <div className="eco-cmp-b" />
      <i />
    </div>
  );
}
function MiniAnalysis() {
  return (
    <svg viewBox="0 0 200 110" className="eco-art ps-svg" aria-hidden="true">
      <path d="M14 90 H186 M14 90 V12" stroke="rgba(160,170,255,0.3)" fill="none" />
      <path d="M20 78 C50 70 70 40 100 46 S150 26 182 20" stroke="#43e3ff" strokeWidth="2.2" fill="none" pathLength={100} className="eco-draw" />
      {[[20, 78], [60, 60], [100, 46], [140, 34], [182, 20]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.4" fill="#f6c65b" className="eco-dot" style={{ animationDelay: `${i * 0.3}s` }} />)}
    </svg>
  );
}
function MiniOrbit() {
  return (
    <svg viewBox="0 0 200 110" className="eco-art ps-svg" aria-hidden="true">
      <g transform="translate(100 55) rotate(-20)">
        {[[34, 14], [58, 24], [84, 36]].map(([rx, ry], i) => (
          <g key={i}>
            <ellipse rx={rx} ry={ry} fill="none" stroke={i === 2 ? '#f6c65b' : 'rgba(160,170,255,0.4)'} strokeDasharray={i === 1 ? '3 4' : undefined} />
            <circle r="3.2" fill={i === 2 ? '#f6c65b' : '#cdbdff'}>
              <animateMotion dur={`${9 + i * 7}s`} repeatCount="indefinite" path={`M ${rx} 0 A ${rx} ${ry} 0 1 0 ${-rx} 0 A ${rx} ${ry} 0 1 0 ${rx} 0`} />
            </circle>
          </g>
        ))}
        <circle r="5" fill="#f6c65b" />
      </g>
    </svg>
  );
}
function MiniCatalog() {
  const rows = content.ecosystem.catalogRows;
  return (
    <div className="eco-art eco-cat" aria-hidden="true">
      <div className="eco-cat-in">{[...rows, ...rows].map((r, i) => <span key={i}>{r}</span>)}</div>
    </div>
  );
}
function MiniEmbed() {
  return (
    <svg viewBox="0 0 200 110" className="eco-art ps-svg" aria-hidden="true">
      <rect x="14" y="8" width="172" height="94" rx="8" fill="#070a30" stroke="rgba(160,170,255,0.4)" />
      <path d="M14 26 H186" stroke="rgba(160,170,255,0.3)" />
      {[24, 34, 44].map((x) => <circle key={x} cx={x} cy="17" r="2.6" fill="#8b6cff" />)}
      <rect x="34" y="36" width="132" height="58" rx="6" fill="#050827" stroke="#43e3ff" strokeDasharray="4 4" className="ps-pulse" />
      <circle cx="90" cy="68" r="4" fill="#f6c65b" className="eco-dot" />
      <text x="100" y="86" textAnchor="middle" fontSize="10" className="t-cyan">&lt;iframe /&gt;</text>
    </svg>
  );
}
function MiniPhoto() {
  return (
    <svg viewBox="0 0 200 110" className="eco-art ps-svg" aria-hidden="true">
      <path d="M12 92 H188" stroke="rgba(160,170,255,0.3)" />
      <path d="M14 78 C30 40 46 52 58 70 S78 60 92 40 S120 30 128 62 S150 36 186 28" stroke="#fff" strokeWidth="2.2" fill="none" pathLength={100} className="eco-draw" style={{ filter: 'drop-shadow(0 0 5px #43e3ff)' }} />
      {[40, 78, 130].map((x) => <path key={x} d={`M${x} 14 V92`} stroke="#f6c65b" strokeDasharray="3 4" opacity="0.5" />)}
    </svg>
  );
}

const ART: Record<string, () => JSX.Element> = {
  blink: MiniBlink, detect: MiniDetect, sky: MiniSky, compare: MiniCompare, analysis: MiniAnalysis,
  planetx: MiniOrbit, catalog: MiniCatalog, embed: MiniEmbed, photo: MiniPhoto,
};
const SPAN: Record<string, string> = { blink: 'eco-w5', detect: 'eco-w4', sky: 'eco-w3', compare: 'eco-w4', analysis: 'eco-w3', planetx: 'eco-w5', catalog: 'eco-w4', embed: 'eco-w4', photo: 'eco-w4' };

export function S11Ecosystem() {
  const e = content.ecosystem;
  return (
    <>
      <div className="ps-atmo ps-atmo--eco" />
      <div className="ps-inner">
        <Kicker n="11">{e.kicker}</Kicker>
        <Reveal i={1} as="h2" className="ps-h2">{e.title[0]}<em>{e.title[1]}</em></Reveal>
        <Reveal i={2} as="p" className="ps-lead">{e.lead}</Reveal>
        <div className="eco-grid">
          {e.items.map((it, i) => {
            const Art = ART[it.id];
            return (
              <Reveal key={it.id} i={3 + i} from={i % 2 ? 'right' : 'left'} className={`eco-tile ps-panel eco-${it.id} ${SPAN[it.id]}`}>
                <Link to={it.to} className="eco-link" aria-label={`${it.t}: ${e.open}`}>
                  <Art />
                  <span className="eco-t">{it.t}</span>
                  <span className="eco-d">{it.d}</span>
                  <span className="eco-go">{e.open} →</span>
                </Link>
              </Reveal>
            );
          })}
        </div>
        <Reveal i={13} className="ps-row" style={{ marginTop: 14 }}><Badge kind="impl">{e.badge}</Badge></Reveal>
      </div>
    </>
  );
}
