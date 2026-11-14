import './act7.css';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Cloud, Cpu, Monitor, Smartphone, Wifi, Server, Database, Layers } from 'lucide-react';
import { content } from '../content';
import { useCycle, useLoop, useSequence } from '../hooks';
import Badge, { type BadgeKind } from '../ui/Badge';
import Kicker from '../ui/Kicker';
import Reveal from '../ui/Reveal';

/* ------------------------------------------------------------------ 18 */
export function S18Install() {
  const s = content.install;
  const total = s.log.length + 1;
  const step = useSequence(total, 700, 2400);
  const boot = useLoop(5, 1300, 1500);
  return (
    <>
      <div className="ps-atmo ps-atmo--install" />
      <div className="ps-inner">
        <Kicker n="18">{s.kicker}</Kicker>
        <Reveal i={1} as="h2" className="ps-h2 in-title">{s.title[0]}<em>{s.title[1]}</em></Reveal>
        <Reveal i={2} as="p" className="ps-lead">{s.lead}</Reveal>
        <div className="in-grid">
          <Reveal i={3} className="in-term" role="img" aria-label={`${s.cmd1}; ${s.cmd2}`}>
            <div className="in-term-bar"><i /><i /><i /><span>pi@orbitscope</span></div>
            <div className="in-term-body">
              <p className="in-cmd"><b>$</b> <span className={`in-type${step >= 0 ? ' go' : ''}`}>{s.cmd1}</span></p>
              {s.log.slice(0, Math.max(0, step)).map((l, i) => <p key={l} className={`in-log${i === s.log.length - 1 ? ' done' : ''}`}>{l}</p>)}
              {step >= s.log.length && <p className="in-cmd"><b>$</b> <span className="in-type go short">{s.cmd2}</span></p>}
            </div>
            <p className="ps-small">{s.terminalNote}</p>
          </Reveal>
          <Reveal i={4} from="right" className="in-stages">
            <ol>
              {s.stages.map((g, i) => {
                const on = step >= g.at;
                return (
                  <li key={g.t} className={on ? 'on' : ''}>
                    <i>{on ? <Check size={14} /> : i + 1}</i>
                    <span><b>{g.t}</b><small>{g.d}</small></span>
                  </li>
                );
              })}
            </ol>
          </Reveal>
        </div>
        <Reveal i={5} className="in-boot">
          <span className="in-boot-t">{s.bootTitle}</span>
          {s.boot.map((b, i) => <span key={b} className={`in-boot-n${i <= boot ? ' on' : ''}`}>{i + 1} · {b}</span>)}
        </Reveal>
        <div className="in-notes">
          <p className="ps-small">{s.extra}</p>
          <p className="ps-small"><b>{s.offlineWarn}</b></p>
          <p className="ps-small">{s.docker}</p>
          <div className="ps-row"><Badge kind="impl" /><Badge kind="unver" /><span className="ps-source" style={{ margin: 0 }}>{s.source}</span></div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ 19 */
const ARCH_ICONS = [Monitor, Server, Cpu, Database, Wifi, Layers, Cloud, Smartphone];
// clockwise from the top: external, backend, science, storage, network, clients, display, frontend
const ORDER = [6, 1, 2, 3, 4, 7, 5, 0];

export function S19Architecture() {
  const a = content.arch;
  const [idx, pin] = useCycle(8, 3600);
  const [online, setOnline] = useState(true);
  const cur = a.nodes[ORDER[idx]];
  const pos = (k: number): [number, number] => {
    const th = ((-90 + k * 45) * Math.PI) / 180;
    return [450 + 340 * Math.cos(th), 260 + 200 * Math.sin(th)];
  };
  return (
    <>
      <div className="ps-atmo ps-atmo--arch" />
      <div className="ps-inner">
        <Kicker n="19">{a.kicker}</Kicker>
        <Reveal i={1} as="h2" className="ps-h2 in-title">{a.title[0]}<em>{a.title[1]}</em></Reveal>
        <Reveal i={2} as="p" className="ps-lead">{a.lead}</Reveal>
        <div className="ar-grid">
          <Reveal i={3} className="ps-panel pad ar-diagram">
            <svg viewBox="0 0 900 520" className="ps-svg ar-svg" role="img" aria-label={a.center}>
              {ORDER.map((ni, k) => {
                const [x, y] = pos(k);
                const ext = a.nodes[ni].id === 'external';
                const blocked = ext && !online;
                const on = k === idx;
                const toHub = ext || a.nodes[ni].id === 'clients';
                return (
                  <g key={a.nodes[ni].id}>
                    <line x1="450" y1="260" x2={x} y2={y} stroke={blocked ? '#ff7a90' : on ? '#43e3ff' : 'rgba(160,170,255,0.3)'} strokeWidth={on ? 2.6 : 1.4}
                      strokeDasharray={ext ? '6 6' : undefined} style={{ transition: 'stroke 0.4s' }} />
                    {!blocked && <circle r="3.6" fill={ext ? '#f6c65b' : '#43e3ff'}><animateMotion dur={`${2.4 + (k % 3) * 0.5}s`} repeatCount="indefinite" path={toHub ? `M${x} ${y} L450 260` : `M450 260 L${x} ${y}`} /></circle>}
                    {blocked && <path d={`M${(x + 450) / 2 - 8} ${(y + 260) / 2 - 8} l16 16 m0 -16 l-16 16`} stroke="#ff7a90" strokeWidth="3" strokeLinecap="round" />}
                  </g>
                );
              })}
              <rect x="360" y="226" width="180" height="68" rx="16" fill="#0f3d3a" stroke="#43e3ff" strokeWidth="2.4" style={{ filter: 'drop-shadow(0 0 16px rgba(67,227,255,0.5))' }} />
              <text x="450" y="266" textAnchor="middle" fontSize="15" className="t-gold t-b">{a.center}</text>
              {ORDER.map((ni, k) => {
                const [x, y] = pos(k);
                const n = a.nodes[ni];
                const ext = n.id === 'external';
                const on = k === idx;
                return (
                  <g key={n.id} className="ar-node" tabIndex={0} role="button" aria-label={`${n.t}: ${n.d}`} onClick={() => pin(k)} onFocus={() => pin(k)} onMouseEnter={() => pin(k)}>
                    <rect x={x - 88} y={y - 29} width="176" height="58" rx="14" fill={on ? 'rgba(30,40,120,0.95)' : 'rgba(8,10,40,0.92)'} stroke={on ? '#f6c65b' : ext ? '#9aa6e8' : '#8b6cff'}
                      strokeWidth={on ? 2.6 : 1.4} strokeDasharray={ext ? '5 4' : undefined} style={on ? { filter: 'drop-shadow(0 0 12px rgba(246,198,91,0.55))' } : undefined} />
                    <text x={x} y={y - 4} textAnchor="middle" fontSize="15" className="t-ink t-b">{n.t}</text>
                    <text x={x} y={y + 15} textAnchor="middle" fontSize="10.5">{n.d.length > 30 ? `${n.d.slice(0, 29)}…` : n.d}</text>
                  </g>
                );
              })}
            </svg>
            <ul className="ar-list">
              {a.nodes.map((n, i) => { const Ic = ARCH_ICONS[i]; return <li key={n.id}><Ic size={16} /><b>{n.t}</b> {n.d}</li>; })}
            </ul>
          </Reveal>
          <Reveal i={4} from="right" className="ps-stack">
            <div className="ps-panel pad ar-detail" aria-live="polite">
              <p className="ps-h3 ps-gold">{cur.t}</p>
              <p className="ps-body"><b>{cur.d}</b></p>
              <p className="ps-body">{cur.more}</p>
              {cur.id === 'external' && <p className="ps-small">{a.needNet}</p>}
            </div>
            <button type="button" className={`ps-chip${online ? ' is-on' : ''}`} onClick={() => setOnline((v) => !v)} aria-pressed={online}>{online ? a.online : a.offline}{!online ? ` · ${a.snapshot}` : ''}</button>
            <div className="ps-row"><Badge kind="impl" /><Badge kind="unver" /></div>
            <p className="ps-source">{a.source}</p>
          </Reveal>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ 20 */
function SetupArt() {
  return (
    <svg viewBox="0 0 520 270" className="ps-svg" role="img" aria-label={content.ground.setup.join(', ')}>
      <rect x="196" y="100" width="130" height="86" rx="12" fill="#0f3d3a" stroke="#43e3ff" strokeWidth="2" style={{ filter: 'drop-shadow(0 0 14px rgba(67,227,255,0.4))' }} />
      <rect x="236" y="122" width="40" height="40" rx="5" fill="#8f97b8" /><circle cx="256" cy="142" r="14" fill="#0a0c30" stroke="#8b6cff" /><circle cx="256" cy="142" r="3" fill="#43e3ff" />
      <text x="261" y="206" textAnchor="middle" fontSize="13" className="t-gold t-b">Raspberry Pi 5</text>
      {/* camera */}
      <g transform="translate(40 108)"><rect width="64" height="54" rx="10" fill="#0b0f3a" stroke="#9aa6e8" strokeDasharray="5 4" /><circle cx="32" cy="27" r="15" fill="#050827" stroke="#43e3ff" strokeWidth="2" /><circle cx="32" cy="27" r="6" fill="#43e3ff" opacity="0.6" /></g>
      <path d="M104 135 H196" stroke="#43e3ff" strokeWidth="2" className="ps-flow" />
      {/* display */}
      <g transform="translate(372 30)"><rect width="110" height="72" rx="8" fill="#0b0f3a" stroke="#9aa6e8" strokeWidth="2" /><rect x="6" y="6" width="98" height="60" rx="4" fill="#050827" /><circle cx="36" cy="34" r="3" fill="#f6c65b" /><circle cx="70" cy="22" r="2" fill="#fff" /><circle cx="84" cy="48" r="2" fill="#fff" /></g>
      <path d="M326 120 L372 80" stroke="#43e3ff" strokeWidth="2" className="ps-flow" />
      {/* phones + wifi */}
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${382 + i * 40} 170)`}><rect width="28" height="52" rx="6" fill="#0b0f3a" stroke="#9aa6e8" strokeWidth="1.6" /><rect x="3" y="7" width="22" height="36" rx="2" fill="#050827" /></g>
      ))}
      {[22, 38, 54].map((r, i) => <path key={r} d={`M326 150 a${r} ${r} 0 0 1 0 ${r * 1.2}`} fill="none" stroke="#5be3a8" strokeWidth="1.8" opacity="0.7" className="ps-pulse" style={{ animationDelay: `${i * 0.4}s` }} />)}
      <path d="M326 150 L382 190" stroke="#5be3a8" strokeWidth="1.6" strokeDasharray="3 5" className="ps-flow" />
      {/* cooler + microSD */}
      <text x="261" y="90" textAnchor="middle" fontSize="11">aktiv soyuducu</text>
      <rect x="236" y="244" width="50" height="16" rx="3" fill="#161a44" stroke="#f6c65b" strokeDasharray="3 3" /><text x="261" y="238" textAnchor="middle" fontSize="11">microSD</text>
      <text x="72" y="184" textAnchor="middle" fontSize="11">Pi kamerası</text>
      <text x="427" y="24" textAnchor="middle" fontSize="11">HDMI / toxunma</text>
      <text x="427" y="240" textAnchor="middle" fontSize="11">Wi-Fi</text>
    </svg>
  );
}

export function S20Ground() {
  const g = content.ground;
  const [tab, pin] = useCycle(4, 3500);
  return (
    <>
      <div className="ps-atmo ps-atmo--ground" />
      <div className="ps-inner">
        <Kicker n="20">{g.kicker}</Kicker>
        <Reveal i={1} as="h2" className="ps-h2 in-title">{g.title[0]}<em>{g.title[1]}</em></Reveal>
        <Reveal i={2} as="p" className="ps-lead">{g.lead}</Reveal>
        <div className="gr-grid">
          <Reveal i={3} className="ps-panel pad">
            <SetupArt />
            <div className="gr-setup">{g.setup.map((x) => <span key={x} className="ps-chip">{x}</span>)}</div>
            <div className="gr-tabs" role="tablist">
              {g.useCases.map((u, i) => <button key={u.t} type="button" role="tab" aria-selected={tab === i} className={`ps-chip${tab === i ? ' is-on' : ''}`} onClick={() => pin(i)}>{u.t}</button>)}
            </div>
            <p className="ps-body gr-uc">{g.useCases[tab].d}</p>
            <p className="ps-small"><b>{g.visitorsTitle}:</b> {g.visitors.join(' · ')}</p>
          </Reveal>
          <Reveal i={4} from="right" className="ps-panel pad">
            <p className="ps-h3">{g.funcTitle}</p>
            <ul className="gr-funcs">
              {g.funcs.map((f) => (
                <li key={f.t}><Badge kind={f.k as BadgeKind}>{f.k === 'plan' ? g.notBuilt : undefined}</Badge><span>{f.t}</span></li>
              ))}
            </ul>
            <p className="ps-small">{g.note}</p>
            <p className="ps-source">{g.source}</p>
            <div style={{ marginTop: 8 }}><Link to="/" className="ps-btn">OrbitScope</Link></div>
          </Reveal>
        </div>
      </div>
    </>
  );
}

