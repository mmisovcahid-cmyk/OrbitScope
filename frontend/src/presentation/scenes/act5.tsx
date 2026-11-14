import './act5.css';
import { useState } from 'react';
import { Server, Globe, MonitorSmartphone, Wifi, Database, Telescope, Cloud, Smartphone, Monitor, Camera, Cpu, ArrowRight } from 'lucide-react';
import { content } from '../content';
import { useCycle, useLoop, useSequence } from '../hooks';
import Badge, { type BadgeKind } from '../ui/Badge';
import Kicker from '../ui/Kicker';
import PiBoard from '../ui/PiBoard';
import Reveal from '../ui/Reveal';

/* ------------------------------------------------------------------ 12 */
function PcArt() {
  return (
    <svg viewBox="0 0 260 200" className="ps-svg" aria-hidden="true">
      <rect x="10" y="10" width="170" height="112" rx="8" fill="#0b0f3a" stroke="#9aa6e8" strokeWidth="2" />
      <rect x="18" y="18" width="154" height="96" rx="4" fill="#050827" />
      <circle cx="96" cy="66" r="22" fill="none" stroke="#43e3ff" strokeWidth="1.5" strokeDasharray="3 4" />
      <circle cx="96" cy="66" r="4" fill="#f6c65b" />
      <path d="M26 100 H160" stroke="rgba(160,170,255,0.4)" />
      <rect x="80" y="122" width="32" height="16" fill="#1a2060" /><rect x="58" y="138" width="76" height="8" rx="4" fill="#1a2060" stroke="#9aa6e8" />
      <rect x="196" y="40" width="50" height="100" rx="6" fill="#0b0f3a" stroke="#9aa6e8" strokeWidth="2" />
      <circle cx="221" cy="62" r="6" fill="#43e3ff" opacity="0.7" /><rect x="206" y="90" width="30" height="4" rx="2" fill="#8b6cff" /><rect x="206" y="100" width="30" height="4" rx="2" fill="#8b6cff" />
      <rect x="30" y="160" width="140" height="18" rx="5" fill="#0b0f3a" stroke="#9aa6e8" />
    </svg>
  );
}

export function S12DesktopToPi() {
  const d = content.desktopToPi;
  const step = useSequence(4, 2700, 600);
  return (
    <>
      <div className="ps-atmo ps-atmo--d2p" />
      <div className="ps-inner d2p-grid">
        <div className="ps-stack">
          <Kicker n="12">{d.kicker}</Kicker>
          <Reveal i={1} as="h2" className="ps-h2 d2p-title">{d.title[0]}<em>{d.title[1]}</em></Reveal>
          <Reveal i={2} as="p" className="ps-lead">{d.subtitle}</Reveal>
          <Reveal i={3} className={`d2p-stage s${Math.max(0, step)}`}>
            <div className="d2p-light ps-deco" />
            <div className="d2p-pc"><PcArt /><span>{d.pcLabel}</span></div>
            <div className="d2p-dust ps-deco">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ ['--k' as string]: i }} />)}</div>
            <div className="d2p-pi"><PiBoard /><span>{d.piLabel}</span></div>
            <svg className="d2p-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {[[50, 50, 84, 20], [50, 50, 86, 56], [50, 50, 70, 90]].map(([x1, y1, x2, y2], i) => (
                <g key={i}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#43e3ff" strokeWidth="1.6" vectorEffect="non-scaling-stroke" className="ps-flow" />
                  <circle r="1.1" fill="#fff"><animateMotion dur={`${2.2 + i * 0.5}s`} repeatCount="indefinite" path={`M${x1} ${y1} L${x2} ${y2}`} /></circle>
                </g>
              ))}
            </svg>
            <div className="d2p-node n1"><Cloud size={20} /><span>{d.nodes.data}</span></div>
            <div className="d2p-node n2"><Monitor size={20} /><span>{d.nodes.screen}</span></div>
            <div className="d2p-node n3"><Smartphone size={20} /><span>{d.nodes.phones}</span></div>
          </Reveal>
          <Reveal i={4} className="d2p-why">
            <ul>{d.why.map((w) => <li key={w} className="ps-chip">{w}</li>)}</ul>
          </Reveal>
          <Reveal i={5} as="p" className="ps-small">{d.illu}</Reveal>
        </div>
        <div className="ps-stack d2p-right">
          <Reveal i={3} from="right" className="d2p-cmp">
            <div className="ps-panel pad d2p-col">
              <p className="ps-h3">{d.originalTitle}</p>
              <dl>{d.originalRows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
              <Badge kind="impl" />
            </div>
            <div className="ps-panel pad d2p-col d2p-col--pi">
              <p className="ps-h3 ps-gold">{d.portableTitle}</p>
              <dl>{d.portableRows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
              <Badge kind="unver" />
            </div>
          </Reveal>
          <p className="ps-source">{d.source}</p>
          <p className="ps-small">{content.common.piStatus}</p>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ 13 */
const ICONS = [Server, Globe, MonitorSmartphone, Wifi, Database, Telescope];

function OfflineMini() {
  const steps = content.roles.items[4].steps ?? [];
  const i = useLoop(steps.length, 1500, 1500);
  const offline = i >= 3;
  return (
    <div className="rl-mini">
      <ol>{steps.map((s, k) => <li key={s} className={k === i ? 'is-now' : k < i ? 'is-done' : ''}>{s}</li>)}</ol>
      <div className={`rl-led${offline ? ' off' : ''}`}><i />{offline ? 'OFFLINE SNAPSHOT' : 'ONLINE'}</div>
    </div>
  );
}
function GroundMini() {
  const chain = content.roles.items[5].chain ?? [];
  const i = useLoop(3, 1400, 1600);
  const icons = [Camera, Cpu, Telescope];
  return (
    <div className="rl-chain">
      {chain.map((c, k) => {
        const Ic = icons[k];
        return (
          <span key={c} className={`rl-chain-node${k <= i ? ' on' : ''}`}><Ic size={18} /><b>{c}</b>{k < chain.length - 1 && <ArrowRight size={16} className="arr" />}</span>
        );
      })}
    </div>
  );
}

export function S13SixRoles() {
  const r = content.roles;
  const seq = useSequence(6, 3800, 600);
  const [pinned, setPinned] = useState<number | null>(null);
  const cur = pinned ?? Math.max(0, Math.min(seq, 5));
  const lit = pinned !== null ? 6 : seq + 1;
  const item = r.items[cur];
  return (
    <>
      <div className="ps-atmo ps-atmo--roles" />
      <div className="ps-inner">
        <Kicker n="13">{r.kicker}</Kicker>
        <Reveal i={1} as="h2" className="ps-h2 rl-title">{r.title[0]}<em>{r.title[1]}</em></Reveal>
        <div className="rl-grid">
          <Reveal i={2} className="rl-stage">
            <svg viewBox="0 0 100 100" className="rl-lines" aria-hidden="true">
              {r.items.map((it, i) => {
                const a = ((-90 + i * 60) * Math.PI) / 180;
                const x = 50 + 39 * Math.cos(a), y = 50 + 39 * Math.sin(a);
                const on = i < lit;
                const inbound = i === 0 || i === 4;
                return (
                  <g key={it.id}>
                    <line x1="50" y1="50" x2={x} y2={y} stroke={on ? '#43e3ff' : 'rgba(160,170,255,0.2)'} strokeWidth={cur === i ? 2.4 : 1.4} vectorEffect="non-scaling-stroke"
                      className={on ? 'ps-flow' : ''} style={{ filter: on ? 'drop-shadow(0 0 4px #43e3ff)' : undefined, transition: 'stroke 0.6s' }} />
                    {on && <circle r="1.2" fill="#fff"><animateMotion dur="2.4s" repeatCount="indefinite" path={inbound ? `M${x} ${y} L50 50` : `M50 50 L${x} ${y}`} /></circle>}
                  </g>
                );
              })}
            </svg>
            <div className="rl-center"><PiBoard /><span>{r.center}</span></div>
            {r.items.map((it, i) => {
              const a = ((-90 + i * 60) * Math.PI) / 180;
              const Ic = ICONS[i];
              return (
                <button key={it.id} type="button" className={`rl-node${i < lit ? ' on' : ''}${cur === i ? ' cur' : ''}`} onClick={() => setPinned(i)}
                  style={{ left: `${50 + 39 * Math.cos(a)}%`, top: `${50 + 39 * Math.sin(a)}%` }} aria-pressed={cur === i}>
                  <Ic size={22} /><span><b>{i + 1}</b> {it.short}</span>
                </button>
              );
            })}
          </Reveal>
          <Reveal i={3} from="right" className="ps-panel pad rl-detail">
            <div className="ps-row"><span className="rl-num">{cur + 1}</span><Badge kind={item.kind as BadgeKind} /></div>
            <h3 className="ps-h3">{item.head}</h3>
            <p className="ps-body">{item.body}</p>
            <ul className="rl-facts">{item.facts.map((f) => <li key={f}>{f}</li>)}</ul>
            {item.id === 'offline' && <OfflineMini />}
            {item.id === 'ground' && <GroundMini />}
            <p className="ps-small" style={{ marginTop: 10 }}>{r.pickHint} · {r.status}</p>
            <p className="ps-source">{r.source}</p>
          </Reveal>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ 14 */
export function S14Hardware() {
  const h = content.hardware;
  const [idx, pin] = useCycle(h.items.length, 4200);
  const it = h.items[idx];
  return (
    <>
      <div className="ps-atmo ps-atmo--hw" />
      <div className="ps-inner hw-grid">
        <div className="ps-stack">
          <Kicker n="14">{h.kicker}</Kicker>
          <Reveal i={1} as="h2" className="ps-h2">{h.title[0]}<em>{h.title[1]}</em></Reveal>
          <Reveal i={2} as="p" className="ps-lead">{h.lead}</Reveal>
          <Reveal i={3} className="ps-panel pad hw-detail" aria-live="polite">
            <p className="ps-h3 ps-gold">{it.t}</p>
            <p className="ps-body">{it.d}</p>
          </Reveal>
          <Reveal i={4} className="ps-row"><Badge kind="hw" /><Badge kind="unver" /></Reveal>
          <p className="ps-small">{h.os}</p>
          <p className="ps-small">{h.note}</p>
          <p className="ps-source">{h.source}</p>
        </div>
        <Reveal i={2} from="right" className="hw-stage">
          <div className="hw-board"><PiBoard className="hw-svg" /></div>
          {h.items.map((x, i) => (
            <button key={x.id} type="button" className={`hw-spot${i === idx ? ' on' : ''}`} style={{ left: `${(x.pos[0] / 350) * 100}%`, top: `${(x.pos[1] / 230) * 100}%` }}
              onMouseEnter={() => pin(i)} onFocus={() => pin(i)} onClick={() => pin(i)} aria-label={x.t} aria-pressed={i === idx}>
              <i>{i + 1}</i><span>{x.t}</span>
            </button>
          ))}
          <p className="ps-small hw-illu">{h.illu}</p>
        </Reveal>
      </div>
    </>
  );
}
