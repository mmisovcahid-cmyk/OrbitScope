import './act8.css';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { content } from '../content';
import { useCycle, useSequence } from '../hooks';
import { usePerf } from '../perf-context';
import { useScene } from '../scene-context';
import { scrollToScene } from '../lib/scroll';
import AndromedaBackdrop, { AndromedaCredit } from '../fx/AndromedaBackdrop';
import Particles from '../fx/Particles';
import Badge from '../ui/Badge';
import Kicker from '../ui/Kicker';
import Reveal from '../ui/Reveal';
import EduArt from './edu';

/* ------------------------------------------------------------------ 21 */
export function S21Educational() {
  const e = content.edu;
  const [i, pin] = useCycle(12, 5200);
  return (
    <>
      <div className="ps-atmo ps-atmo--edu" />
      <div className="ps-inner">
        <Kicker n="21">{e.kicker}</Kicker>
        <Reveal i={1} as="h2" className="ps-h2 ac-title">{e.title[0]}<em>{e.title[1]}</em></Reveal>
        <Reveal i={2} as="p" className="ps-lead">{e.lead}</Reveal>
        <div className="ed-grid">
          <Reveal i={3} as="ol" className="ed-list">
            {e.items.map((it, k) => (
              <li key={it.t}><button type="button" className={`ps-chip${k === i ? ' is-on' : ''}`} onClick={() => pin(k)} aria-pressed={k === i}><i>{k + 1}</i>{it.t}</button></li>
            ))}
          </Reveal>
          <Reveal i={4} from="right" className="ps-panel pad ed-stage">
            <div key={i} className="ed-art"><EduArt index={i} /></div>
            <p className="ps-h3">{e.items[i].t}</p>
            <p className="ps-body" aria-live="polite">{e.items[i].d}</p>
            <div className="ps-row" style={{ marginTop: 8 }}><Badge kind="edu">{e.badge}</Badge></div>
          </Reveal>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ 22 */
export function S22Technology() {
  const t = content.tech;
  return (
    <>
      <div className="ps-atmo ps-atmo--tech" />
      <div className="ps-inner">
        <Kicker n="22">{t.kicker}</Kicker>
        <Reveal i={1} as="h2" className="ps-h2 ac-title">{t.title[0]}<em>{t.title[1]}</em></Reveal>
        <Reveal i={2} as="p" className="ps-lead">{t.lead}</Reveal>
        <div className="tc-stack">
          {t.layers.map((l, k) => (
            <Reveal key={l.t} i={3 + k} from={k % 2 ? 'right' : 'left'} className="tc-layer-wrap">
              <div className={`tc-layer tc-l${k}`}>
                <b>{l.t}</b>
                <ul>{l.items.map((x) => <li key={x} className="ps-chip">{x}</li>)}</ul>
              </div>
              {k < t.layers.length - 1 && <div className="tc-gap" aria-hidden="true"><i /><i /><i /></div>}
            </Reveal>
          ))}
        </div>
        <p className="ps-small" style={{ marginTop: 10 }}>{t.fontNote}</p>
        <p className="ps-source">{t.source}</p>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ 23 */
export function S23Validation() {
  const v = content.validation;
  const step = useSequence(v.rows.length, 650, 700);
  return (
    <>
      <div className="ps-atmo ps-atmo--valid" />
      <div className="ps-inner vl-wrap">
        <div>
          <Kicker n="23">{v.kicker}</Kicker>
          <Reveal i={1} as="h2" className="ps-h2 ac-title">{v.title[0]}<em>{v.title[1]}</em></Reveal>
          <Reveal i={2} as="p" className="ps-lead">{v.lead}</Reveal>
          <Reveal i={3} className="vl-stamp" aria-label={`${v.stamp}: ${v.date}`}><small>{v.stamp}</small><b>{v.date}</b></Reveal>
          <p className="ps-small" style={{ marginTop: 10 }}>{v.dateNote}</p>
        </div>
        <Reveal i={3} from="right" className="vl-sheet">
          <table>
            <tbody>
              {v.rows.map((r, i) => (
                <tr key={r.k} className={step > i ? 'on' : ''}>
                  <td className="vl-tick"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="#5be3a8" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" pathLength={100} strokeDasharray="100" strokeDashoffset={step > i ? 0 : 100} style={{ transition: 'stroke-dashoffset 0.7s ease' }} /></svg></td>
                  <td><b>{r.k}</b><small>{r.n}</small></td>
                  <td className="vl-v">{r.v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="ps-small">{v.verifiedToday}</p>
          <p className="vl-not">{v.not}</p>
          <div className="ps-row"><Badge kind="impl" /><span className="ps-source" style={{ margin: 0 }}>{v.source}</span></div>
        </Reveal>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ 24 */
export function S24Limitations() {
  const l = content.limits;
  return (
    <>
      <div className="ps-atmo ps-atmo--limits" />
      <div className="ps-inner lm-wrap">
        <div className="lm-head">
          <Kicker n="24">{l.kicker}</Kicker>
          <Reveal i={1} as="h2" className="ps-h2 ac-title">{l.title[0]}<em>{l.title[1]}</em></Reveal>
          <Reveal i={2} as="p" className="ps-lead">{l.lead}</Reveal>
          <p className="ps-source">{l.source}</p>
        </div>
        <ol className="lm-list">
          {l.items.map((it, k) => (
            <Reveal key={it.t} as="li" i={3 + k * 2} className="lm-item"><span>{String(k + 1).padStart(2, '0')}</span><div><b>{it.t}</b><p>{it.d}</p></div></Reveal>
          ))}
        </ol>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ 25 */
export function S25Future() {
  const f = content.future;
  const step = useSequence(f.items.length, 420, 600);
  return (
    <>
      <div className="ps-atmo ps-atmo--future" />
      <div className="ps-inner">
        <Kicker n="25">{f.kicker}</Kicker>
        <Reveal i={1} as="h2" className="ps-h2 ac-title">{f.title[0]}<em>{f.title[1]}</em></Reveal>
        <Reveal i={2} as="p" className="ps-lead">{f.lead}</Reveal>
        <div className="fu-grid">
          <Reveal i={3} className="fu-done">
            <p className="ps-h3 ps-cyan">{f.done}</p>
            <ul>{f.doneItems.map((d) => <li key={d}><Check size={16} />{d}</li>)}</ul>
            <Badge kind="impl" />
          </Reveal>
          <div className="fu-line">
            <p className="ps-h3 ps-gold">{f.todo}</p>
            <ol>
              {f.items.map((it, i) => (
                <li key={it.t} className={step > i ? 'on' : ''}>
                  <i />
                  <div>
                    <b>{it.t}</b>
                    <small>{it.n}</small>
                  </div>
                  <Badge kind={it.k === 'team' ? 'plan' : it.k === 'notes' ? 'notes' : 'plan'}>{it.k === 'team' ? f.team : undefined}</Badge>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <p className="ps-source">{f.source}</p>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ 26 */
/** The Ground Node page (/ground) exists only in the OrbitScopePI build; probe once so the button never points to a missing route. */
let groundProbe: Promise<boolean> | null = null;
function probeGround(): Promise<boolean> {
  if (!groundProbe) {
    const base = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000') as string;
    const ctl = new AbortController();
    const timer = window.setTimeout(() => ctl.abort(), 2500);
    groundProbe = fetch(`${base}/api/v1/ground/status`, { signal: ctl.signal })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => window.clearTimeout(timer));
  }
  return groundProbe;
}

function useGroundRoute(): boolean {
  const { seen } = useScene();
  const [has, setHas] = useState(false);
  useEffect(() => {
    if (!seen) return;
    let alive = true;
    probeGround().then((ok) => { if (alive) setHas(ok); });
    return () => { alive = false; };
  }, [seen]);
  return has;
}

export function S26Finale() {
  const f = content.finale;
  const { reduced } = usePerf();
  const ground = useGroundRoute();
  return (
    <>
      <AndromedaBackdrop variant="finale" />
      <Particles count={60} color="205,215,255" angle={-Math.PI / 2.4} speed={6} />
      <div className="ps-inner fn-wrap">
        <Reveal i={0} as="h2" className="fn-title">{f.title}</Reveal>
        <Reveal i={2} as="p" className="fn-sub">{f.subtitle}</Reveal>
        <Reveal i={3} as="p" className="fn-line">{f.line}</Reveal>
        <Reveal i={4} className="fn-btns">
          <Link to="/" className="ps-btn ps-btn--primary">{f.buttons[0]}</Link>
          <Link to="/about" className="ps-btn">{f.buttons[1]}</Link>
          {ground ? (
            <Link to="/ground" className="ps-btn ps-btn--gold">{f.buttons[2]}</Link>
          ) : (
            <a href="#yer-stansiyasi" className="ps-btn ps-btn--gold" onClick={(e) => { e.preventDefault(); scrollToScene('yer-stansiyasi', reduced); }}>{f.buttons[2]}</a>
          )}
        </Reveal>
        <Reveal i={6} className="fn-credits">
          <p><b>{f.credits}</b></p>
          <p>{f.data}</p>
          <p>{f.noDiscovery}</p>
        </Reveal>
      </div>
      <AndromedaCredit />
    </>
  );
}
