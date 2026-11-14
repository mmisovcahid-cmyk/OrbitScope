import './act2.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pause, Play } from 'lucide-react';
import { content } from '../content';
import { useCountUp, useCycle, useSequence } from '../hooks';
import { usePerf } from '../perf-context';
import { decodeFrames, displacement, paint, type BarnardFile, type Frames, type Mode } from '../lib/barnard';
import { useJson } from '../lib/useJson';
import Badge from '../ui/Badge';
import Kicker from '../ui/Kicker';
import Reveal from '../ui/Reveal';

const comma = (s: string | number): string => String(s).replace('.', ',');
const fmtDate = (iso: string): string => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/* ------------------------------------------------------------------ 05 */
const MODES: Mode[] = ['blink', 'diff', 'motion', 'stack'];
const CROP = 38; // pixels of the 59x59 grid shown around the star
const SIZE = 608;

function Viewer({ frames, mode, frame, marker }: { frames: Frames; mode: Mode; frame: number; marker: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const off = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = frames.w;
    c.height = frames.h;
    return c;
  }, [frames]);

  useEffect(() => {
    const cv = ref.current;
    const octx = off.getContext('2d');
    const ctx = cv?.getContext('2d');
    if (!cv || !octx || !ctx) return;
    const img = octx.createImageData(frames.w, frames.h);
    paint(frames, mode, frame, img);
    octx.putImageData(img, 0, 0);
    const t0 = frames.meta[0].target_px, t1 = frames.meta[frames.meta.length - 1].target_px;
    const cx = (t0[0] + t1[0]) / 2, cy = (t0[1] + t1[1]) / 2;
    const sx = Math.max(0, Math.min(frames.w - CROP, Math.round(cx - CROP / 2)));
    const sy = Math.max(0, Math.min(frames.h - CROP, Math.round(frames.h - 1 - cy - CROP / 2)));
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#02030f';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.drawImage(off, sx, sy, CROP, CROP, 0, 0, SIZE, SIZE);
    const k = SIZE / CROP;
    const at = (p: [number, number]): [number, number] => [(p[0] + 0.5 - sx) * k, (frames.h - 1 - p[1] + 0.5 - sy) * k];
    if (marker) {
      const ring = (p: [number, number], color: string, dashed: boolean) => {
        const [x, y] = at(p);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash(dashed ? [5, 5] : []);
        ctx.beginPath();
        ctx.arc(x, y, 2.6 * k, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      };
      if (mode === 'blink') ring(frames.meta[frame].target_px, '#f6c65b', false);
      else {
        ring(t0, '#ff7a90', true);
        ring(t1, '#6aa7ff', true);
        const [x0, y0] = at(t0), [x1, y1] = at(t1);
        ctx.strokeStyle = 'rgba(246,198,91,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
    }
    // 60" scale bar
    const bar = (60 / frames.pix) * k;
    ctx.fillStyle = '#fff';
    ctx.fillRect(22, SIZE - 30, bar, 3);
    ctx.font = '600 20px "Lora Variable", Georgia, serif';
    ctx.fillText('60″', 22 + bar + 10, SIZE - 22);
  }, [frames, mode, frame, marker, off]);

  return <canvas ref={ref} width={SIZE} height={SIZE} className="bk-canvas" role="img" aria-label={content.blink.example} />;
}

export function S05Blink() {
  const b = content.blink;
  const { data, error } = useJson<BarnardFile>('/presentation/data/barnard-frames.json');
  const frames = useMemo(() => (data ? decodeFrames(data) : null), [data]);
  const [playing, setPlaying] = useState(true);
  const { reduced } = usePerf();
  const [modeIdx, pinMode] = useCycle(4, 6500, playing);
  const [frameIdx, pinFrame] = useCycle(3, 1300, playing && modeIdx === 0);
  const [marker, setMarker] = useState(true);
  const mode = MODES[modeIdx];
  const disp = useMemo(() => (frames ? displacement(frames) : null), [frames]);
  const arc = useCountUp(disp?.arcsec ?? 0, 1600, 1);
  const frame = reduced && mode === 'blink' ? 0 : frameIdx;

  return (
    <>
      <div className="ps-atmo ps-atmo--blink" />
      <div className="ps-inner bk-grid">
        <div className="bk-viewer ps-panel pad">
          {frames ? (
            <>
              <Viewer frames={frames} mode={mode} frame={frame} marker={marker} />
              <div className="bk-hud">
                {mode === 'blink' ? (
                  <span><b>{b.frame} {frame + 1}/{frames.meta.length}</b> · {fmtDate(frames.meta[frame].date)} · D{data?.detector}
                    · {comma(frames.meta[frame].wavelength_um[0])}–{comma(frames.meta[frame].wavelength_um[1])} µm</span>
                ) : (
                  <span><b>{b.modes[mode]}</b> · {fmtDate(frames.meta[0].date)} → {fmtDate(frames.meta[frames.meta.length - 1].date)}</span>
                )}
              </div>
              {(mode === 'motion' || mode === 'diff') && (
                <div className="bk-legend"><i style={{ background: '#ff5a72' }} />{b.legendOld}<i style={{ background: '#5a8cff' }} />{b.legendNew}</div>
              )}
            </>
          ) : (
            <div className="bk-empty ps-small">{error ? b.loadError : '…'}</div>
          )}
        </div>
        <div className="ps-stack bk-side">
          <Kicker n="05">{b.kicker}</Kicker>
          <Reveal i={1} as="h2" className="ps-h2">{b.title[0]}<em>{b.title[1]}</em></Reveal>
          <Reveal i={2} as="p" className="ps-lead">{b.lead}</Reveal>
          <Reveal i={3} className="bk-modes" as="div">
            {MODES.map((m, i) => (
              <button key={m} type="button" className={`ps-chip${i === modeIdx ? ' is-on' : ''}`} onClick={() => pinMode(i)}>{b.modes[m]}</button>
            ))}
          </Reveal>
          <Reveal i={4} as="p" className="ps-small bk-help">{b.modeHelp[mode]}</Reveal>
          <Reveal i={4} className="bk-controls">
            <button type="button" className="ps-chip" onClick={() => setPlaying((v) => !v)} aria-pressed={!playing}>
              {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? b.pause : b.play}
            </button>
            {frames && frames.meta.map((m, i) => (
              <button key={m.date} type="button" className={`ps-chip${mode === 'blink' && i === frameIdx ? ' is-on' : ''}`}
                onClick={() => { pinMode(0); pinFrame(i); }}>{i + 1} · {fmtDate(m.date).slice(3)}</button>
            ))}
            <button type="button" className={`ps-chip${marker ? ' is-on' : ''}`} onClick={() => setMarker((v) => !v)} aria-pressed={marker}>{b.marker}</button>
          </Reveal>
          <Reveal i={5} className="ps-panel pad bk-read">
            <p className="ps-h3 ps-gold">{b.example}</p>
            {disp && (
              <div className="bk-nums">
                <span><span className="ps-num-lg">≈{comma(arc)}<span className="ps-unit">″</span></span><small>{b.shift}</small></span>
                <span><span className="ps-num-lg">{comma(disp.px.toFixed(1))}<span className="ps-unit">{b.pixels}</span></span><small>6,15″ / {b.pixels}</small></span>
                <span><span className="ps-num-lg">{Math.round(disp.days)}<span className="ps-unit">{b.days}</span></span><small>{fmtDate(frames!.meta[0].date)} → {fmtDate(frames!.meta[frames!.meta.length - 1].date)}</small></span>
              </div>
            )}
          </Reveal>
          <Reveal i={6} className="ps-row"><Badge kind="impl">{content.common.badges.real}</Badge><span className="ps-small">{b.real}</span></Reveal>
          <p className="ps-small">{b.note}</p>
          <p className="ps-source"><b>{b.meta}</b>{data ? <> · {b.saved}: {fmtDate(data.exported_at)}</> : null}</p>
          <Reveal i={7}><Link className="ps-btn ps-btn--gold" to="/?target=Barnard%27s+Star&fov=0.1&det=3">{b.open}</Link></Reveal>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ 06 */
interface SpectrumFile {
  exported_at: string;
  n_good: number;
  points: { wl: number; flux: number; err: number; det: number; date: string; flagged: boolean }[];
}
const HUES = ['#9b6cff', '#6d8bff', '#43b8ff', '#43e3d0', '#f6c65b', '#ff7a6b'];
const X0 = 0.7, X1 = 5.1, PL = 58, PR = 14, PT = 18, PB = 48, CW = 760, CH = 400;
const sx = (wl: number) => PL + ((wl - X0) / (X1 - X0)) * (CW - PL - PR);

const median = (a: number[]): number => {
  const s = [...a].sort((p, q) => p - q);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function Absorb() {
  const { lite, reduced } = usePerf();
  const anim = !lite && !reduced;
  const rows = [48, 90, 132];
  return (
    <svg viewBox="0 0 340 210" className="ps-svg" role="img" aria-label={content.spectrum.eduTitle}>
      <rect x="120" y="22" width="86" height="136" rx="16" fill="rgba(139,108,255,0.12)" stroke="#8b6cff" strokeWidth="1.6" strokeDasharray="4 5" />
      {[[140, 50], [168, 74], [150, 104], [184, 124], [138, 140], [176, 48]].map(([x, y], i) => (
        <g key={i} className="ps-pulse" style={{ animationDelay: `${i * 0.3}s` }}>
          <circle cx={x} cy={y} r="5" fill="#cdbdff" /><circle cx={x + 7} cy={y + 4} r="3.4" fill="#8b6cff" />
        </g>
      ))}
      {rows.map((y, i) => {
        const absorbed = i === 1;
        const color = absorbed ? '#ff7a6b' : '#43e3ff';
        return (
          <g key={y}>
            <line x1="14" y1={y} x2="326" y2={y} stroke={color} strokeWidth="0.6" opacity="0.25" />
            {[0, 1, 2].map((k) => (
              <circle key={k} cx={anim ? undefined : 30 + k * 40} cy={y} r="5.5" fill={color} style={{ filter: `drop-shadow(0 0 5px ${color})` }}>
                {anim && <animate attributeName="cx" from="14" to="326" dur="4.2s" begin={`${k * 1.4}s`} repeatCount="indefinite" />}
                {anim && absorbed && <animate attributeName="opacity" values="1;1;0;0;0" keyTimes="0;0.3;0.38;0.9;1" dur="4.2s" begin={`${k * 1.4}s`} repeatCount="indefinite" />}
              </circle>
            ))}
          </g>
        );
      })}
      <text x="163" y="178" textAnchor="middle" fontSize="13" className="t-ink">{content.spectrum.bands[0].k}</text>
      <path d="M14 196 L140 196 Q 160 196 163 206 Q 166 196 186 196 L326 196" fill="none" stroke="#f6c65b" strokeWidth="2" opacity="0.0" />
    </svg>
  );
}

export function S06Spectrum() {
  const s = content.spectrum;
  const { data, error } = useJson<SpectrumFile>('/presentation/data/epsindib-spectrum.json');
  const step = useSequence(5, 1700, 500);
  const good = useMemo(() => (data ? data.points.filter((p) => !p.flagged) : []), [data]);
  const model = useMemo(() => {
    if (!good.length) return null;
    const fmax = Math.max(...good.map((p) => p.flux));
    const ymax = Math.ceil((fmax * 1.1) / 10) * 10;
    const sy = (f: number) => PT + (1 - f / ymax) * (CH - PT - PB);
    const bins: { x: number; y: number }[] = [];
    for (let lo = 0.7; lo < 5.1; lo += 0.16) {
      const inBin = good.filter((p) => p.wl >= lo && p.wl < lo + 0.16);
      if (inBin.length) bins.push({ x: sx(lo + 0.08), y: sy(median(inBin.map((p) => p.flux))) });
    }
    const line = bins.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' ');
    const inRange = (a: number, b: number) => good.filter((p) => p.wl >= a && p.wl <= b).map((p) => p.flux);
    const ch4 = inRange(3.2, 3.45), ref = inRange(3.6, 4.1);
    const ratio = ch4.length && ref.length ? median(ref) / median(ch4) : null;
    return { ymax, sy, line, ratio, ticks: [0, 1, 2, 3, 4].map((i) => (ymax / 4) * i) };
  }, [good]);
  const n = useCountUp(data?.n_good ?? 0, 1500);

  return (
    <>
      <div className="ps-atmo ps-atmo--spectrum" />
      <div className="ps-inner">
        <Kicker n="06">{s.kicker}</Kicker>
        <Reveal i={1} as="h2" className="ps-h2">{s.title[0]}<em>{s.title[1]}</em></Reveal>
        <Reveal i={2} as="p" className="ps-lead">{s.lead}</Reveal>
        <div className="sp-grid">
          <Reveal i={3} className="ps-panel pad sp-chart">
            <p className="ps-h3">{s.example}</p>
            {model && data ? (
              <svg viewBox={`0 0 ${CW} ${CH}`} className="ps-svg" role="img" aria-label={s.example}>
                {model.ticks.map((t) => (
                  <g key={t}>
                    <line x1={PL} x2={CW - PR} y1={model.sy(t)} y2={model.sy(t)} stroke="rgba(160,170,255,0.14)" />
                    <text x={PL - 8} y={model.sy(t) + 4} textAnchor="end" fontSize="13">{Math.round(t)}</text>
                  </g>
                ))}
                {[1, 2, 3, 4, 5].map((w) => (
                  <g key={w}>
                    <line x1={sx(w)} x2={sx(w)} y1={PT} y2={CH - PB} stroke="rgba(160,170,255,0.08)" />
                    <text x={sx(w)} y={CH - PB + 20} textAnchor="middle" fontSize="13">{w}</text>
                  </g>
                ))}
                <text x={(PL + CW - PR) / 2} y={CH - 6} textAnchor="middle" fontSize="13">{s.axisX}</text>
                <text x="14" y={PT + 8} fontSize="13">{s.axisY}</text>
                {s.bands.map((band, i) => (
                  <g key={band.k} style={{ opacity: step > i + 1 ? 1 : 0, transition: 'opacity 0.8s' }}>
                    <rect x={sx(band.range[0])} y={PT} width={sx(band.range[1]) - sx(band.range[0])} height={CH - PT - PB} fill="rgba(246,198,91,0.16)" />
                    <line x1={(sx(band.range[0]) + sx(band.range[1])) / 2} x2={(sx(band.range[0]) + sx(band.range[1])) / 2} y1={PT} y2={CH - PB} stroke="#f6c65b" strokeDasharray="4 5" />
                    <text x={(sx(band.range[0]) + sx(band.range[1])) / 2} y={PT + 18} textAnchor="middle" fontSize="16" className="t-gold t-b">{band.k}</text>
                    <text x={(sx(band.range[0]) + sx(band.range[1])) / 2} y={PT + 36} textAnchor="middle" fontSize="12">{band.wl}</text>
                  </g>
                ))}
                {good.map((p, i) => (
                  <circle key={i} cx={sx(p.wl)} cy={model.sy(p.flux)} r="3.6" fill={HUES[p.det - 1]} className="sp-pt"
                    style={{ opacity: step >= 0 ? 0.85 : 0, transitionDelay: `${(p.wl - 0.7) * 260}ms` }} />
                ))}
                <path d={model.line} fill="none" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" pathLength={100} strokeDasharray="100"
                  strokeDashoffset={step >= 1 ? 0 : 100} style={{ transition: 'stroke-dashoffset 2.4s ease', filter: 'drop-shadow(0 0 6px #43e3ff)' }} />
              </svg>
            ) : (
              <p className="ps-small">{error ? s.loadError : '…'}</p>
            )}
            <p className="ps-small">{s.detectorColors}</p>
            <div className="ps-row"><Badge kind="impl">{content.common.badges.real}</Badge><span className="ps-small">{s.real}</span></div>
            {data && model && (
              <p className="ps-source">{s.export} <b>{good.length}</b> {s.exportEnd} <b>{model.ratio ? comma(model.ratio.toFixed(1)) : '—'}×</b>. ({fmtDate(data.exported_at)}) {s.readmeNote}</p>
            )}
          </Reveal>
          <div className="ps-stack sp-side">
            <Reveal i={4} className="ps-panel pad sp-stats">
              <span><span className="ps-num-lg">{n}</span><small>{s.exposures}</small></span>
              <span><span className="ps-num-lg">≈{model?.ratio ? Math.round(model.ratio) : 5}×</span><small>{s.ratioLabel}</small></span>
            </Reveal>
            <Reveal i={5} className="ps-panel pad">
              <p className="ps-h3">{s.eduTitle}</p>
              <Absorb />
              <p className="ps-small">{s.eduBody}</p>
              <div className="ps-row" style={{ marginTop: 8 }}><Badge kind="edu" /><span className="ps-small">{s.eduCaption}</span></div>
            </Reveal>
            <Reveal i={6}><Link className="ps-btn ps-btn--gold" to="/?target=Epsilon+Indi+B&fov=0.1&det=4">{s.open}</Link></Reveal>
          </div>
        </div>
      </div>
    </>
  );
}
