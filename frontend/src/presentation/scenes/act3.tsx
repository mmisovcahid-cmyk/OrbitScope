import './act3.css';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { content } from '../content';
import { useCountUp, useCycle, useLoop } from '../hooks';
import { useScene } from '../scene-context';
import { useJson } from '../lib/useJson';
import { eclipticToEq, galacticToEq, projectedPath, toXY } from '../lib/sky';
import { mulberry32 } from '../lib/rng';
import Badge from '../ui/Badge';
import Kicker from '../ui/Kicker';
import Reveal from '../ui/Reveal';

const comma = (s: string | number): string => String(s).replace('.', ',');

/* ------------------------------------------------------------------ 07 */
const FIELD = (() => {
  const r = mulberry32(9);
  return Array.from({ length: 52 }, (_, i) => ({ x: 16 + r() * 488, y: 16 + r() * 348, r: i < 5 ? 2.6 : 0.8 + r() * 1.5, o: i < 5 ? 0.95 : 0.35 + r() * 0.55 }));
})();
const TRACK: [number, number][] = [[70, 258], [195, 208], [320, 158], [445, 108]];

function MoversStage({ step }: { step: number }) {
  const m = content.movers;
  return (
    <svg viewBox="0 0 520 380" className="ps-svg" role="img" aria-label={m.steps[step]}>
      <rect width="520" height="380" rx="16" fill="#050827" />
      {FIELD.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" style={{ opacity: step >= 1 ? s.o * 0.12 : s.o, transition: 'opacity 0.9s' }} />
      ))}
      {TRACK.map(([x, y], k) => (
        <g key={k} style={{ opacity: step >= 1 ? 1 : 0, transition: `opacity 0.7s ${k * 0.14}s` }}>
          <circle cx={x} cy={y} r="5" fill="#43e3ff" style={{ filter: 'drop-shadow(0 0 8px #43e3ff)' }} />
          <g style={{ opacity: step >= 2 ? 1 : 0, transition: 'opacity 0.6s' }}>
            <circle cx={x} cy={y} r="16" fill="none" stroke="#43e3ff" strokeWidth="1.4" strokeDasharray="3 4" />
            <text x={x} y={y - 24} textAnchor="middle" fontSize="13" className="t-cyan">{k + 1} · {m.frame}</text>
          </g>
        </g>
      ))}
      <path d="M70 258 L445 108" fill="none" stroke="#f6c65b" strokeWidth="2.2" pathLength={100} strokeDasharray="100"
        strokeDashoffset={step >= 3 ? 0 : 100} style={{ transition: 'stroke-dashoffset 1.2s ease', filter: 'drop-shadow(0 0 6px #f6c65b)' }} />
      <g style={{ opacity: step >= 4 ? 1 : 0, transition: 'opacity 0.6s' }}>
        <circle cx="40" cy="300" r="14" fill="rgba(91,227,168,0.15)" stroke="#5be3a8" strokeWidth="2" />
        <path d="M33 300 L38 306 L48 294" fill="none" stroke="#5be3a8" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <text x="62" y="305" fontSize="14" className="t-ink">{m.steps[4]}</text>
      </g>
      <g style={{ opacity: step >= 5 ? 1 : 0, transition: 'opacity 0.6s' }}>
        <circle cx="372" cy="296" r="4.5" fill="#ff7a90" className="ps-pulse" />
        <circle cx="372" cy="296" r="15" fill="none" stroke="#ff7a90" strokeWidth="1.6" />
        <path d="M362 286 L382 306 M382 286 L362 306" stroke="#ff7a90" strokeWidth="2" strokeLinecap="round" />
        <text x="372" y="326" textAnchor="middle" fontSize="13" fill="#ff9aab">{m.stationary}</text>
      </g>
      <g style={{ opacity: step >= 6 ? 1 : 0, transition: 'opacity 0.8s' }}>
        <circle cx="262" cy="186" r="12" fill="none" stroke="#f6c65b" strokeWidth="2" />
        <circle cx="262" cy="186" r="21" fill="none" stroke="#f6c65b" strokeWidth="1" strokeDasharray="2 4" />
        <line x1="268" y1="177" x2="330" y2="132" stroke="#f6c65b" strokeWidth="1" />
        <text x="334" y="128" fontSize="14" className="t-gold t-b">{m.jpl}</text>
      </g>
    </svg>
  );
}

export function S07Movers() {
  const m = content.movers;
  const step = useLoop(7, 2000, 2600);
  const a = useCountUp(m.metrics[0].v, 1500, m.metrics[0].d);
  const b = useCountUp(m.metrics[1].v, 1500, m.metrics[1].d);
  const c = useCountUp(m.metrics[2].v, 1500, m.metrics[2].d);
  const vals = [a, b, c];
  return (
    <>
      <div className="ps-atmo ps-atmo--movers" />
      <div className="ps-inner ps-grid-2 mo-grid">
        <div className="ps-stack">
          <Kicker n="07">{m.kicker}</Kicker>
          <Reveal i={1} as="h2" className="ps-h2">{m.title[0]}<em>{m.title[1]}</em></Reveal>
          <Reveal i={2} as="p" className="ps-lead">{m.lead}</Reveal>
          <Reveal i={3} as="ol" className="mo-steps">
            {m.steps.map((s, i) => (
              <li key={s} className={i === step ? 'is-now' : i < step ? 'is-done' : ''}><i>{i + 1}</i>{s}</li>
            ))}
          </Reveal>
          <Reveal i={4} className="ps-row"><Badge kind="impl" /><Badge kind="edu">{content.common.badges.edu}</Badge></Reveal>
        </div>
        <Reveal i={2} from="right" className="ps-panel pad">
          <MoversStage step={step} />
          <p className="mo-cap">{m.captions[step]}</p>
          <p className="ps-h3 ps-gold" style={{ marginTop: 14 }}>{m.example}</p>
          <div className="mo-metrics">
            {m.metrics.map((x, i) => (
              <span key={x.l}><span className="ps-num-lg">{comma(vals[i])}<span className="ps-unit">{x.u}</span></span><small>{x.l}</small></span>
            ))}
          </div>
          <div className="ps-row" style={{ marginTop: 6 }}><Badge kind="impl">{content.common.badges.real}</Badge><span className="ps-small">{m.metricsNote}</span></div>
          <p className="ps-small" style={{ marginTop: 8 }}>{m.illu} {m.caveat}</p>
          <div style={{ marginTop: 10 }}><Link to="/detection" className="ps-btn ps-btn--gold">{m.open}</Link></div>
        </Reveal>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ 08 */
const PM_STARS = (() => {
  const r = mulberry32(21);
  return Array.from({ length: 26 }, () => ({ x: 12 + r() * 236, y: 12 + r() * 236, r: 0.8 + r() * 1.5, o: 0.35 + r() * 0.55 }));
})();

function Compass({ pa, catPa }: { pa: number; catPa: number }) {
  const vec = (deg: number, len: number): [number, number] => [34 - Math.sin((deg * Math.PI) / 180) * len, 34 - Math.cos((deg * Math.PI) / 180) * len];
  const [mx, my] = vec(pa, 24), [cx, cy] = vec(catPa, 24);
  return (
    <svg viewBox="0 0 68 68" width="68" height="68" aria-hidden="true">
      <circle cx="34" cy="34" r="30" fill="none" stroke="rgba(160,170,255,0.3)" />
      <text x="34" y="11" textAnchor="middle" fontSize="9" className="t-ink">N</text>
      <text x="8" y="37" textAnchor="middle" fontSize="9" className="t-ink">E</text>
      <line x1="34" y1="34" x2={cx} y2={cy} stroke="#f6c65b" strokeWidth="2" strokeDasharray="3 2" />
      <line x1="34" y1="34" x2={mx} y2={my} stroke="#43e3ff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function PmStage({ step }: { step: number }) {
  const p = content.properMotion;
  const old: [number, number] = [96, 160], now: [number, number] = [158, 124];
  const panel = (epoch: 0 | 1) => {
    const [x, y] = epoch ? now : old;
    return (
      <g transform={`translate(${epoch ? 274 : 0} 0)`}>
        <rect width="260" height="260" rx="14" fill="#050827" stroke="rgba(160,170,255,0.2)" />
        {PM_STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} />)}
        {step >= 1 && PM_STARS.slice(0, 7).map((s, i) => (
          <path key={i} d={`M${s.x - 5} ${s.y} H${s.x + 5} M${s.x} ${s.y - 5} V${s.y + 5}`} stroke="#5be3a8" strokeWidth="1.2" opacity="0.8" />
        ))}
        {epoch === 1 && step >= 2 && <circle cx={old[0]} cy={old[1]} r="8" fill="none" stroke="#f6c65b" strokeDasharray="3 3" opacity="0.8" />}
        <circle cx={x} cy={y} r="6" fill="#f6c65b" style={{ filter: 'drop-shadow(0 0 8px #f6c65b)' }} />
        {step >= 0 && (
          <path d={`M${x - 14} ${y} H${x + 14} M${x} ${y - 14} V${y + 14}`} stroke="#43e3ff" strokeWidth="1.6" style={{ opacity: step >= 0 ? 1 : 0 }} />
        )}
        {epoch === 1 && step >= 2 && <line x1={old[0] + 8} y1={old[1] - 3} x2={x - 9} y2={y + 4} stroke="#f6c65b" strokeWidth="1.8" />}
        {epoch === 1 && step >= 3 && <text x="130" y="236" textAnchor="middle" fontSize="18" className="t-gold t-b">σ ≫ 5</text>}
        {epoch === 1 && step >= 4 && (
          <g><circle cx={x} cy={y} r="19" fill="none" stroke="#5be3a8" strokeWidth="2" /><text x={x + 24} y={y - 20} fontSize="13" fill="#5be3a8">Gaia DR3</text></g>
        )}
        <text x="12" y="24" fontSize="15" className="t-ink t-b">{epoch ? p.epoch2 : p.epoch1}</text>
      </g>
    );
  };
  return (
    <svg viewBox="0 0 534 260" className="ps-svg" role="img" aria-label={p.steps[step]}>
      {panel(0)}
      {panel(1)}
    </svg>
  );
}

export function S08ProperMotion() {
  const p = content.properMotion;
  const step = useLoop(5, 2600, 2400);
  const { seen } = useScene();
  const max = 9;
  return (
    <>
      <div className="ps-atmo ps-atmo--pm" />
      <div className="ps-inner">
        <Kicker n="08">{p.kicker}</Kicker>
        <Reveal i={1} as="h2" className="ps-h2">{p.title[0]}<em>{p.title[1]}</em></Reveal>
        <Reveal i={2} as="p" className="ps-lead">{p.lead}</Reveal>
        <div className="pm-grid">
          <Reveal i={3} className="ps-panel pad">
            <PmStage step={step} />
            <ol className="pm-steps">
              {p.steps.map((s, i) => <li key={s} className={i === step ? 'is-now' : i < step ? 'is-done' : ''}>{s}</li>)}
            </ol>
            <div className="ps-row"><Badge kind="impl" /><Badge kind="edu" /></div>
          </Reveal>
          <Reveal i={4} className="ps-panel pad pm-compare">
            <div className="ps-row" style={{ justifyContent: 'space-between' }}>
              <span className="pm-leg"><i style={{ background: 'linear-gradient(90deg,#8b6cff,#43e3ff)' }} />{p.measured}</span>
              <span className="pm-leg"><i style={{ background: '#f6c65b' }} />{p.catalog}</span>
              <Badge kind="impl">{content.common.badges.real}</Badge>
            </div>
            {p.targets.map((t, i) => (
              <div key={t.name} className="pm-row">
                <div className="pm-head">
                  <b>{t.name}</b>
                  <span className="ps-chip">{t.sigma}</span>
                  <span className="ps-chip">{t.ref}</span>
                </div>
                <div className="pm-bars">
                  <div className="pm-bar"><i className="m" style={{ width: seen ? `${(t.measured / max) * 100}%` : '0%', transitionDelay: `${0.4 + i * 0.5}s` }} /><span>{comma(t.measured.toFixed(t.measured === 8.2 ? 1 : 2))} {p.unit}</span></div>
                  <div className="pm-bar"><i className="c" style={{ width: seen ? `${(t.catalog / max) * 100}%` : '0%', transitionDelay: `${0.7 + i * 0.5}s` }} /><span>{comma(t.catalog.toFixed(2))} {p.unit}</span></div>
                </div>
                <div className="pm-pa"><Compass pa={t.pa} catPa={t.catPa} /><small>{p.pa}: <b className="ps-cyan">{t.pa}°</b> / <b className="ps-gold">{t.catPa}°</b></small></div>
              </div>
            ))}
            <p className="ps-small">{p.excluded}</p>
            <p className="ps-small">{p.illu}</p>
            <Link to="/detection" className="ps-btn ps-btn--gold" style={{ alignSelf: 'flex-start' }}>{p.open}</Link>
          </Reveal>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ 09 */
interface TargetsFile { exported_at: string; targets: { id: string; name: string; ra: number; dec: number; pmra: number; pmdec: number; kind: string; detector: number }[]; }
const MW = 800, MH = 400;
const GAL = Array.from({ length: 181 }, (_, i) => galacticToEq(i * 2));
const ECL = Array.from({ length: 181 }, (_, i) => eclipticToEq(i * 2));
const GRID_DEC = [-60, -30, 0, 30, 60];
const GRID_RA = [0, 60, 120, 180, 240, 300];

export function S09SkyExplorer() {
  const s = content.sky;
  const { data } = useJson<TargetsFile>('/presentation/data/targets.json');
  const targets = data?.targets ?? [];
  const [idx, pin] = useCycle(Math.max(1, targets.length), 3200, targets.length > 0);
  const sel = targets[idx % Math.max(1, targets.length)];
  const mw = useMemo(() => projectedPath(GAL, MW, MH), []);
  const ec = useMemo(() => projectedPath(ECL, MW, MH), []);
  const pm = sel ? Math.hypot(sel.pmra, sel.pmdec) / 1000 : 0;
  return (
    <>
      <div className="ps-atmo ps-atmo--sky" />
      <div className="ps-inner">
        <Kicker n="09">{s.kicker}</Kicker>
        <Reveal i={1} as="h2" className="ps-h2">{s.title[0]}<em>{s.title[1]}</em></Reveal>
        <Reveal i={2} as="p" className="ps-lead">{s.lead}</Reveal>
        <div className="sk-grid">
          <div className="sk-map">
            <svg viewBox={`0 0 ${MW} ${MH}`} className="ps-svg" role="img" aria-label={s.kicker}>
              <defs>
                <clipPath id="sk-clip"><ellipse cx={MW / 2} cy={MH / 2} rx={MW / 2 - 4} ry={MH / 2 - 4} /></clipPath>
                <radialGradient id="sk-bg" cx="50%" cy="50%" r="60%"><stop offset="0" stopColor="#0d1245" /><stop offset="1" stopColor="#04061f" /></radialGradient>
              </defs>
              <ellipse cx={MW / 2} cy={MH / 2} rx={MW / 2 - 4} ry={MH / 2 - 4} fill="url(#sk-bg)" stroke="rgba(160,170,255,0.4)" strokeWidth="1.5" />
              <g clipPath="url(#sk-clip)">
                {GRID_DEC.map((d) => <path key={d} d={projectedPath(Array.from({ length: 181 }, (_, i) => [i * 2, d] as [number, number]), MW, MH)} fill="none" stroke="rgba(160,170,255,0.12)" />)}
                {GRID_RA.map((r) => <path key={r} d={projectedPath(Array.from({ length: 91 }, (_, i) => [r, -90 + i * 2] as [number, number]), MW, MH)} fill="none" stroke="rgba(160,170,255,0.12)" />)}
                <path d={mw} fill="none" stroke="rgba(180,160,255,0.2)" strokeWidth="34" strokeLinecap="round" />
                <path d={mw} fill="none" stroke="rgba(220,210,255,0.38)" strokeWidth="10" strokeLinecap="round" />
                <path d={mw} fill="none" stroke="#cdbdff" strokeWidth="1.4" strokeDasharray="2 4" />
                <path d={ec} fill="none" stroke="#f6c65b" strokeWidth="1.6" strokeDasharray="7 5" opacity="0.9" />
              </g>
              {targets.map((t, i) => {
                const [x, y] = toXY(t.ra, t.dec, MW, MH);
                const on = t === sel;
                return (
                  <g key={t.id} className="sk-pin" onClick={() => pin(i)} tabIndex={0} role="button" aria-label={t.name}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pin(i); } }}>
                    <circle cx={x} cy={y} r="22" fill="transparent" />
                    {on && <circle cx={x} cy={y} r="14" fill="none" stroke="#43e3ff" strokeWidth="2" className="ps-pulse" />}
                    <circle cx={x} cy={y} r={on ? 6.5 : 4.5} fill={on ? '#43e3ff' : '#f6c65b'} style={{ filter: `drop-shadow(0 0 8px ${on ? '#43e3ff' : '#f6c65b'})` }} />
                    {on && <text x={x + 14} y={y - 12} fontSize="17" className="t-ink t-b">{t.name}</text>}
                  </g>
                );
              })}
            </svg>
            <ul className="sk-legend">
              <li><i style={{ background: '#cdbdff' }} />{s.legend.milky}</li>
              <li><i style={{ background: '#f6c65b' }} />{s.legend.ecliptic}</li>
              <li><i style={{ background: '#43e3ff' }} />{s.legend.targets}</li>
            </ul>
          </div>
          <Reveal i={4} className="ps-panel pad sk-info">
            {sel ? (
              <>
                <p className="ps-h3 ps-cyan">{sel.name}</p>
                <dl>
                  <div><dt>{s.info.kind}</dt><dd>{s.kinds[sel.kind as keyof typeof s.kinds] ?? sel.kind}</dd></div>
                  <div><dt>{s.info.ra}</dt><dd>{comma(sel.ra.toFixed(3))}°</dd></div>
                  <div><dt>{s.info.dec}</dt><dd>{comma(sel.dec.toFixed(3))}°</dd></div>
                  <div><dt>{s.info.pm}</dt><dd>≈{comma(pm.toFixed(1))} {s.info.perYear}</dd></div>
                </dl>
                <Link to={`/?target=${encodeURIComponent(sel.name)}&fov=0.1&det=${sel.detector}`} className="ps-btn ps-btn--gold">{s.open}</Link>
              </>
            ) : <p className="ps-small">{s.pick}</p>}
            <p className="ps-small" style={{ marginTop: 12 }}>{s.pick}</p>
            <div className="ps-row" style={{ marginTop: 8 }}><Badge kind="impl" /></div>
            <p className="ps-small" style={{ marginTop: 8 }}>{s.real}</p>
            <p className="ps-small">{s.savedNote}</p>
            <Link to="/dashboard" className="ps-btn" style={{ marginTop: 10 }}>{s.openDash}</Link>
          </Reveal>
        </div>
      </div>
    </>
  );
}
