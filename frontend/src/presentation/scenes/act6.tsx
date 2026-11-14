import './act6.css';
import { Cloud, Lock, Smartphone, Wifi, Server, Shield, Monitor } from 'lucide-react';
import { content } from '../content';
import { useCycle, useLoop } from '../hooks';
import { useScene } from '../scene-context';
import Badge from '../ui/Badge';
import Kicker from '../ui/Kicker';
import QrPlaceholder from '../ui/QrPlaceholder';
import Reveal from '../ui/Reveal';

/* ------------------------------------------------------------------ 15 */
function MemoryWidget() {
  const e = content.edge.mem;
  const { seen } = useScene();
  const C = 2 * Math.PI * 46;
  return (
    <div className="eg-mem">
      <svg viewBox="0 0 120 120" className="ps-svg eg-ring" role="img" aria-label={e.limit}>
        <circle cx="60" cy="60" r="46" fill="none" stroke="rgba(160,170,255,0.18)" strokeWidth="12" />
        <circle cx="60" cy="60" r="46" fill="none" stroke="url(#eg-g)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${C * 0.375} ${C}`}
          strokeDashoffset={seen ? 0 : C * 0.375} transform="rotate(-90 60 60)" style={{ transition: 'stroke-dashoffset 2s ease' }} />
        <defs><linearGradient id="eg-g" x1="0" x2="1"><stop offset="0" stopColor="#8b6cff" /><stop offset="1" stopColor="#43e3ff" /></linearGradient></defs>
        <text x="60" y="58" textAnchor="middle" fontSize="24" className="t-ink t-b">3 GB</text>
        <text x="60" y="76" textAnchor="middle" fontSize="10">{e.of}</text>
      </svg>
      <p className="eg-cap">{e.limit}</p>
      <p className="ps-small">{e.logs}. {e.sd}.</p>
    </div>
  );
}

function CacheWidget() {
  const c = content.edge.cache;
  const step = useLoop(15, 650, 1400);
  const filled = Math.min(step, 12);
  const prune = step >= 13;
  return (
    <div className="eg-cache">
      <div className="eg-sd"><i style={{ width: '9.4%' }} /><span>{c.card}</span><b>{c.cap}</b></div>
      <div className="eg-blocks">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className={`${i < filled ? 'on' : ''}${prune && i < 4 ? ' prune' : ''}`} style={{ ['--a' as string]: i }} />
        ))}
      </div>
      <div className="eg-blocks-l"><small>{c.old}</small><small>{c.fresh}</small></div>
      <p className="ps-small">{c.body}</p>
    </div>
  );
}

function JobsWidget() {
  const j = content.edge.jobs;
  const [mode] = useCycle(2, 8000);
  const L = mode === 0 ? 2 : 1;
  const slot = 4;
  const cycle = Math.ceil(6 / L) * slot + 2;
  const [t] = useCycle(cycle, 450);
  return (
    <div className="eg-jobs">
      <p className="eg-cap">{mode === 0 ? j.pi8 : j.pi4}</p>
      <div className="eg-lanes">
        {Array.from({ length: L }, (_, l) => <div key={l} className="eg-lane" />)}
        {Array.from({ length: 6 }, (_, n) => {
          const lane = n % L;
          const start = Math.floor(n / L) * slot;
          const p = Math.min(1, Math.max(0, (t - start) / slot));
          const queued = t < start;
          return (
            <i key={n} className={queued ? 'queued' : ''} style={{ top: queued ? `${12 + (n % 3) * 7}%` : `${lane * (100 / L) + (50 / L) - 14}%`, left: queued ? `${2 + Math.floor(n / 3) * 7}%` : `${12 + p * 78}%`,
              opacity: p >= 1 ? 0 : 1, background: ['#43e3ff', '#8b6cff', '#f6c65b'][n % 3] }} />
          );
        })}
      </div>
      <div className="eg-dl">{Array.from({ length: 6 }, (_, i) => <b key={i} style={{ animationDelay: `${i * 0.25}s` }} />)}</div>
      <p className="ps-small">{j.dl}</p>
    </div>
  );
}

function NetWidget() {
  const n = content.edge.net;
  return (
    <div className="eg-net">
      <div className="eg-net-row">
        <span className="eg-pill ap"><Wifi size={16} /> {n.ap}</span>
        <i className="eg-wave" /><i className="eg-wave" style={{ animationDelay: '0.8s' }} />
      </div>
      <div className="eg-net-row">
        <span className="eg-pill eth"><Cloud size={16} /> {n.eth}</span>
        <svg viewBox="0 0 60 12" className="eg-cable" aria-hidden="true"><path d="M0 6 H60" stroke="#43e3ff" strokeWidth="2" className="ps-flow" /></svg>
      </div>
      <p className="ps-small">{n.body}</p>
    </div>
  );
}

function FirewallWidget() {
  const f = content.edge.fw;
  return (
    <div className="eg-fw">
      <svg viewBox="0 0 300 150" className="ps-svg" role="img" aria-label={f.t}>
        {[28, 70, 112].map((y) => (
          <g key={y}><rect x="10" y={y - 12} width="20" height="26" rx="5" fill="#0b0f3a" stroke="#9aa6e8" /><circle cx="20" cy={y + 8} r="1.6" fill="#9aa6e8" /></g>
        ))}
        <rect x="136" y="6" width="14" height="138" rx="3" fill="rgba(255,122,144,0.2)" stroke="#ff7a90" />
        <rect x="136" y="52" width="14" height="30" fill="#02030f" />
        <text x="143" y="150" textAnchor="middle" fontSize="9" fill="#ff9aab">firewall</text>
        <rect x="224" y="38" width="66" height="30" rx="8" fill="rgba(67,227,255,0.12)" stroke="#43e3ff" /><text x="257" y="57" textAnchor="middle" fontSize="11" className="t-cyan">:80 · DHCP · DNS</text>
        <rect x="224" y="94" width="66" height="30" rx="8" fill="rgba(160,170,255,0.08)" stroke="#9aa6e8" strokeDasharray="3 3" /><text x="257" y="113" textAnchor="middle" fontSize="11">SSH :22</text>
        <circle r="3" fill="#43e3ff"><animateMotion dur="2.4s" repeatCount="indefinite" path="M32 28 L143 67 L224 53" /></circle>
        <circle r="3" fill="#43e3ff"><animateMotion dur="2.4s" begin="0.8s" repeatCount="indefinite" path="M32 70 L143 67 L224 53" /></circle>
        <circle r="3" fill="#ff7a90"><animateMotion dur="2.4s" begin="0.4s" repeatCount="indefinite" path="M32 112 L130 112" /></circle>
        <path d="M126 104 l8 8 m0 -8 l-8 8" stroke="#ff7a90" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div className="eg-fw-l"><span>{f.visitors}</span><span>{f.protected}</span></div>
      <p className="eg-cap">{f.allow}</p>
      <p className="ps-small">{f.ssh}. {f.sshNote}. {f.share}</p>
    </div>
  );
}

function QrWidget() {
  const q = content.edge.qr;
  return (
    <div className="eg-qr">
      <div className="eg-qr-row">
        <figure><QrPlaceholder seed={3} scan className="eg-qr-box" /><figcaption><Wifi size={13} /> {q.wifi}</figcaption></figure>
        <figure><QrPlaceholder seed={11} className="eg-qr-box" /><figcaption><Server size={13} /> {q.site}</figcaption></figure>
        <div className="eg-phone"><Smartphone size={34} /><i /></div>
      </div>
      <p className="eg-pass"><Lock size={14} /> {q.hidden}</p>
      <p className="ps-small">{q.pass}. <em>{q.example}</em></p>
    </div>
  );
}

export function S15Edge() {
  const e = content.edge;
  return (
    <>
      <div className="ps-atmo ps-atmo--edge" />
      <div className="ps-inner">
        <Kicker n="15">{e.kicker}</Kicker>
        <Reveal i={1} as="h2" className="ps-h2 eg-title">{e.title[0]}<em>{e.title[1]}</em></Reveal>
        <Reveal i={2} className="eg-chips">{e.chips.map((c) => <span key={c} className="ps-code">{c}</span>)}</Reveal>
        <div className="eg-grid">
          <Reveal i={3} className="ps-panel pad eg-a"><p className="ps-h3">{e.mem.t}</p><MemoryWidget /></Reveal>
          <Reveal i={4} className="ps-panel pad eg-b"><p className="ps-h3">{e.cache.t}</p><CacheWidget /></Reveal>
          <Reveal i={5} className="ps-panel pad eg-c"><p className="ps-h3">{e.jobs.t}</p><JobsWidget /></Reveal>
          <Reveal i={6} className="ps-panel pad eg-d"><p className="ps-h3">{e.net.t}</p><NetWidget /></Reveal>
          <Reveal i={7} className="ps-panel pad eg-e"><p className="ps-h3"><Shield size={16} style={{ display: 'inline', verticalAlign: '-2px' }} /> {e.fw.t}</p><FirewallWidget /></Reveal>
          <Reveal i={8} className="ps-panel pad eg-f"><p className="ps-h3">{e.qr.t}</p><QrWidget /></Reveal>
        </div>
        <Reveal i={9} className="ps-row" style={{ marginTop: 12 }}><Badge kind="impl" /><Badge kind="unver" /><span className="ps-small">{e.status}</span></Reveal>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ 16 */
const STATE_OF_STEP = [0, 0, 1, 1, 2, 2];

export function S16Offline() {
  const o = content.offline;
  const step = useLoop(6, 3000, 2500);
  const st = STATE_OF_STEP[step];
  const cut = step >= 3;
  return (
    <>
      <div className="ps-atmo ps-atmo--offline" />
      <div className="ps-inner">
        <Kicker n="16">{o.kicker}</Kicker>
        <Reveal i={1} as="h2" className="ps-h2 eg-title">{o.title[0]}<em>{o.title[1]}</em></Reveal>
        <Reveal i={2} as="p" className="ps-lead">{o.sub}</Reveal>
        <div className="of-grid">
          <Reveal i={3} className="ps-panel pad of-stage">
            <svg viewBox="0 0 520 300" className="ps-svg" role="img" aria-label={o.story[step]}>
              {/* cloud */}
              <g style={{ opacity: cut ? 0.35 : 1, transition: 'opacity 0.8s' }}>
                <path d="M62 78 a24 24 0 0 1 46 -8 a20 20 0 0 1 20 26 h-72 a16 16 0 0 1 6 -18 z" fill="rgba(67,227,255,0.18)" stroke="#43e3ff" strokeWidth="2" />
                <text x="92" y="122" textAnchor="middle" fontSize="12" className="t-ink">{o.cloud}</text>
              </g>
              {/* link cloud - pi */}
              <path d="M128 92 L218 150" stroke={cut ? '#ff7a90' : '#43e3ff'} strokeWidth="2.4" strokeDasharray={cut ? '4 7' : undefined} className={cut ? '' : 'ps-flow'} />
              {step === 1 && [0, 0.7, 1.4].map((b) => <rect key={b} width="14" height="10" rx="2" fill="#f6c65b"><animateMotion dur="1.8s" begin={`${b}s`} repeatCount="indefinite" path="M121 87 L211 145" /></rect>)}
              {cut && <path d="M158 106 l22 22 M180 106 l-22 22" stroke="#ff7a90" strokeWidth="4" strokeLinecap="round" />}
              {/* pi */}
              <rect x="218" y="124" width="104" height="70" rx="12" fill="#0f3d3a" stroke="#43e3ff" strokeWidth="2" />
              <rect x="246" y="142" width="34" height="34" rx="4" fill="#8f97b8" />
              <text x="270" y="214" textAnchor="middle" fontSize="13" className="t-gold t-b">{o.pi}</text>
              {/* disk */}
              <g transform="translate(224 230)">
                <rect width="92" height="46" rx="8" fill="rgba(139,108,255,0.14)" stroke="#8b6cff" strokeWidth="1.6" />
                {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={8 + i * 16} y="10" width="12" height="26" rx="2" fill="#f6c65b" style={{ opacity: step >= 2 || (step === 1 && i < 2) ? 0.9 : 0.1, transition: `opacity 0.5s ${i * 0.2}s` }} />)}
                <text x="46" y="62" textAnchor="middle" fontSize="11">{o.disk}</text>
              </g>
              <path d="M270 194 V228" stroke="#8b6cff" strokeWidth="2" strokeDasharray="3 4" opacity={step >= 1 ? 1 : 0.3} />
              {/* phone */}
              <g transform="translate(404 112)">
                <rect width="62" height="112" rx="10" fill="#0b0f3a" stroke="#9aa6e8" strokeWidth="2" />
                <rect x="6" y="12" width="50" height="88" rx="5" fill="#050827" />
                {step >= 5 && <><rect x="10" y="20" width="42" height="26" rx="4" fill="rgba(67,227,255,0.15)" stroke="#43e3ff" /><rect x="10" y="52" width="42" height="9" rx="3" fill="rgba(246,198,91,0.3)" /><text x="31" y="86" textAnchor="middle" fontSize="7" fill="#ffb86b">OFFLINE</text></>}
              </g>
              <path d="M322 160 H404" stroke={step >= 4 ? '#5be3a8' : 'rgba(160,170,255,0.25)'} strokeWidth="2.4" className={step >= 4 ? 'ps-flow' : ''} />
              {step >= 4 && [18, 30].map((r) => <path key={r} d={`M${362 - r} ${160 - r * 0.5} a${r} ${r} 0 0 1 0 ${r}`} fill="none" stroke="#5be3a8" strokeWidth="1.6" opacity="0.6" />)}
              {step >= 4 && <text x="362" y="148" textAnchor="middle" fontSize="12" className="t-cyan">10.42.0.1</text>}
            </svg>
            <p className="of-cap"><b>{step + 1}/6 · {o.story[step]}</b> — {o.storyBody[step]}</p>
            <ol className="of-steps">{o.story.map((s, i) => <li key={s} className={i === step ? 'is-now' : i < step ? 'is-done' : ''}>{i + 1}</li>)}</ol>
          </Reveal>
          <div className="ps-stack">
            <Reveal i={4} from="right" className="ps-panel pad of-states">
              {o.states.map((s, i) => (
                <div key={s} className={`of-state s${i}${i === st ? ' on' : ''}`}><b>{s}</b><small>{o.stateNotes[i]}</small></div>
              ))}
            </Reveal>
            <Reveal i={5} from="right" className="of-snips">
              <div className="ps-panel pad"><p className="ps-small"><b>{o.snapTitle}</b></p><pre className="of-code">{`{ "offline_snapshot": {\n    "saved_at": "<UTC>" } }`}</pre><p className="ps-small">{o.snapNote}</p></div>
              <div className="ps-panel pad of-502"><p className="ps-small"><b>HTTP 502</b></p><p className="ps-small">{o.e502}</p></div>
            </Reveal>
          </div>
        </div>
        <Reveal i={6} className="of-cols">
          <div><p className="ps-h3 ps-cyan">{o.worksTitle}</p><ul>{o.works.map((w) => <li key={w}>{w}</li>)}</ul></div>
          <div><p className="ps-h3 ps-gold">{o.needsTitle}</p><ul>{o.needs.map((w) => <li key={w}>{w}</li>)}</ul></div>
        </Reveal>
        <p className="ps-small" style={{ marginTop: 8 }}><b>{o.honest}</b> {o.source}</p>
        <div className="ps-row" style={{ marginTop: 6 }}><Badge kind="impl" /><Badge kind="unver" /></div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ 17 */
export function S17Wifi() {
  const w = content.wifi;
  const step = useLoop(7, 2400, 2000);
  const qrOn = step >= 1;
  const scan1 = step === 2, scan2 = step === 4;
  return (
    <>
      <div className="ps-atmo ps-atmo--wifi" />
      <div className="ps-inner">
        <Kicker n="17">{w.kicker}</Kicker>
        <Reveal i={1} as="h2" className="ps-h2 eg-title">{w.title[0]}<em>{w.title[1]}</em></Reveal>
        <Reveal i={2} as="p" className="ps-lead">{w.lead}</Reveal>
        <div className="wf-grid">
          <Reveal i={3} className="wf-kiosk">
            <div className="wf-screen">
              <div className="wf-bar"><b>OrbitScope</b><span>kiosk</span></div>
              <div className="wf-sky">{[[18, 30], [40, 62], [64, 24], [78, 70], [30, 80], [52, 44]].map(([x, y], i) => <i key={i} style={{ left: `${x}%`, top: `${y}%` }} />)}<em /></div>
              {qrOn && (
                <div className="wf-qrs">
                  <div className={scan1 ? 'hl' : ''}><QrPlaceholder seed={3} scan={scan1} /><small><Wifi size={11} /> {w.ssid}: OrbitScope</small></div>
                  <div className={scan2 ? 'hl' : ''}><QrPlaceholder seed={11} scan={scan2} /><small>10.42.0.1</small></div>
                </div>
              )}
            </div>
            <p className="ps-small"><Monitor size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> {w.kiosk} — {w.addrKiosk}: <span className="ps-code">http://localhost/?kiosk=1</span></p>
          </Reveal>
          <Reveal i={4} className="wf-phone">
            <div className="wf-device">
              <div className="wf-pscreen">
                {(step === 2 || step === 4) && <div className="wf-cam"><QrPlaceholder seed={step === 2 ? 3 : 11} scan /></div>}
                {step === 3 && <div className="wf-net"><Wifi size={26} /><b>OrbitScope</b><small>{w.connected} · {w.noNet}</small></div>}
                {step >= 5 && (
                  <div className="wf-browser">
                    <div className="wf-url">10.42.0.1</div>
                    <div className="wf-page"><b>OrbitScope</b>{step === 6 && <><i /><span className="wf-snap">{w.offlineBadge}</span></>}</div>
                  </div>
                )}
                {step < 2 && <div className="wf-idle"><Smartphone size={30} /></div>}
              </div>
            </div>
            <p className="ps-small">{w.phone}</p>
          </Reveal>
          <Reveal i={5} from="right" className="ps-stack wf-steps">
            <ol>{w.steps.map((s, i) => <li key={s} className={i === step ? 'is-now' : i < step ? 'is-done' : ''}><i>{i + 1}</i>{s}</li>)}</ol>
            <div className="ps-panel pad wf-addr">
              <p><span>{w.addrLocal}</span> <span className="ps-code">http://10.42.0.1</span></p>
              <p><span>{w.addrKiosk}</span> <span className="ps-code">http://localhost/?kiosk=1</span></p>
              <p className="ps-small"><Lock size={12} style={{ display: 'inline', verticalAlign: '-2px' }} /> {w.passHidden}. {w.qrExample}.</p>
            </div>
          </Reveal>
        </div>
        <Reveal i={6} className="wf-topo">
          <span className="wf-topo-t">{w.topoTitle}</span>
          <span className="wf-pi"><Server size={16} /> Raspberry Pi 5</span>
          {w.topoParts.map((p) => <span key={p} className="ps-chip">{p}</span>)}
          <span className="wf-ph"><Smartphone size={16} /><Smartphone size={16} /><Smartphone size={16} /></span>
          <span className="ps-chip is-on">{w.noInternet}</span>
        </Reveal>
        <div className="ps-row" style={{ marginTop: 8 }}><Badge kind="unver" /><span className="ps-small">{w.alt} {w.source}</span></div>
      </div>
    </>
  );
}
