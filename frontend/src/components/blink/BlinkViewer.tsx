import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Play, SkipBack, SkipForward, Crosshair, Layers } from 'lucide-react';
import {
  BlinkResult, ColorMapKind, DecodedFrame, StretchKind, buildLut, decodeFrames, formatDec, formatRA,
  percentiles, pixelToWorld, stretchValue,
} from '../../lib/spherex';

export type ViewMode = 'blink' | 'difference' | 'motion';

interface Props {
  result: BlinkResult;
  compact?: boolean;
  autoplay?: boolean;
  onFrameChange?: (index: number) => void;
}

interface RenderOpts {
  mode: ViewMode;
  lo: number;
  hi: number;
  stretch: StretchKind;
  lut: Uint8ClampedArray;
  diffLut: Uint8ClampedArray;
  showMask: boolean;
}

const NAN_RGB = [22, 26, 38];
const MASK_RGB = [217, 70, 239];

/** Render one frame (optionally against a reference frame) into RGBA pixels, north up. */
function renderPixels(
  cur: DecodedFrame, ref: DecodedFrame | null, w: number, h: number, o: RenderOpts, diffLim: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  const span = Math.max(o.hi - o.lo, 1e-12);
  const norm = (v: number) => Math.round(stretchValue((v - o.lo) / span, o.stretch) * 255);
  for (let r = 0; r < h; r++) {
    const y = h - 1 - r;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const p = (r * w + x) * 4;
      const v = cur.values[i];
      let R: number, G: number, B: number;
      if (o.mode === 'difference' && ref) {
        const d = v - ref.values[i];
        if (!Number.isFinite(d)) { [R, G, B] = NAN_RGB; }
        else {
          const k = Math.round(Math.min(1, Math.max(0, (d / diffLim + 1) / 2)) * 255) * 3;
          R = o.diffLut[k]; G = o.diffLut[k + 1]; B = o.diffLut[k + 2];
        }
      } else if (o.mode === 'motion' && ref) {
        const a = ref.values[i];
        if (!Number.isFinite(v) || !Number.isFinite(a)) { [R, G, B] = NAN_RGB; }
        else { R = norm(a); G = B = norm(v); }
      } else if (!Number.isFinite(v)) {
        [R, G, B] = NAN_RGB;
      } else {
        const k = norm(v) * 3;
        R = o.lut[k]; G = o.lut[k + 1]; B = o.lut[k + 2];
      }
      if (o.showMask && cur.mask[i]) {
        R = (R + MASK_RGB[0]) >> 1; G = (G + MASK_RGB[1]) >> 1; B = (B + MASK_RGB[2]) >> 1;
      }
      out[p] = R; out[p + 1] = G; out[p + 2] = B; out[p + 3] = 255;
    }
  }
  return out;
}

function diffLimit(cur: DecodedFrame, ref: DecodedFrame): number {
  const d = new Float32Array(cur.values.length);
  for (let i = 0; i < d.length; i++) d[i] = cur.values[i] - ref.values[i];
  return Math.max(percentiles([d], [99.5], true)[0], 1e-6);
}

export default function BlinkViewer({ result, compact = false, autoplay = true, onFrameChange }: Props) {
  const { t } = useTranslation();
  const frames = useMemo(() => decodeFrames(result), [result]);
  const { width: w, height: h } = result.grid;

  const [idx, setIdx] = useState(0);
  const [refIdx, setRefIdx] = useState(0);
  const [playing, setPlaying] = useState(autoplay && frames.length > 1);
  const [fps, setFps] = useState(2);
  const [mode, setMode] = useState<ViewMode>('blink');
  const [stretch, setStretch] = useState<StretchKind>('asinh');
  const [cmap, setCmap] = useState<ColorMapKind>('gray');
  const [lowPct, setLowPct] = useState(1);
  const [highPct, setHighPct] = useState(99.7);
  const [smooth, setSmooth] = useState(false);
  const [showTarget, setShowTarget] = useState(true);
  const [showMask, setShowMask] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setIdx(0); setRefIdx(0); setPlaying(autoplay && frames.length > 1); }, [frames, autoplay]);
  useEffect(() => { onFrameChange?.(idx); }, [idx, onFrameChange]);

  const [lo, hi] = useMemo(
    () => percentiles(frames.map((f) => f.values), [lowPct, highPct]),
    [frames, lowPct, highPct],
  );
  const lut = useMemo(() => buildLut(cmap), [cmap]);
  const diffLut = useMemo(() => buildLut('diverging'), []);
  const opts: RenderOpts = { mode, lo, hi, stretch, lut, diffLut, showMask };

  const cur = frames[Math.min(idx, frames.length - 1)];
  const ref = frames[Math.min(refIdx, frames.length - 1)];
  const lim = useMemo(() => (cur && ref && mode === 'difference' ? diffLimit(cur, ref) : 1), [cur, ref, mode]);

  // Draw the main canvas.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !cur) return;
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(w, h);
    img.data.set(renderPixels(cur, ref, w, h, opts, lim));
    ctx.putImageData(img, 0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, ref, w, h, mode, lo, hi, stretch, lut, diffLut, showMask, lim]);

  // Thumbnails (filmstrip).
  const thumbs = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return [] as string[];
    return frames.map((f) => {
      const img = ctx.createImageData(w, h);
      img.data.set(renderPixels(f, null, w, h, { ...opts, mode: 'blink', showMask: false }, 1));
      ctx.putImageData(img, 0, 0);
      return c.toDataURL();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames, w, h, lo, hi, stretch, lut]);

  // Playback.
  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const iv = window.setInterval(() => setIdx((p) => (p + 1) % frames.length), 1000 / fps);
    return () => window.clearInterval(iv);
  }, [playing, fps, frames.length]);

  const step = useCallback((d: number) => {
    setPlaying(false);
    setIdx((p) => (p + d + frames.length) % frames.length);
  }, [frames.length]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  };

  const onMove = (e: React.MouseEvent) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    const x = Math.floor(((e.clientX - box.left) / box.width) * w);
    const r = Math.floor(((e.clientY - box.top) / box.height) * h);
    if (x < 0 || x >= w || r < 0 || r >= h) { setHover(null); return; }
    setHover({ x, y: h - 1 - r });
  };

  if (!cur) return null;

  const hoverWorld = hover ? pixelToWorld(hover.x, hover.y, result.grid) : null;
  const hoverVal = hover ? cur.values[hover.y * w + hover.x] : NaN;
  const scaleBarPx = 60 / result.grid.pixscale_arcsec; // 1 arcmin
  const tp = cur.meta.target_px;
  const markR = Math.max(2.5, w / 22);
  const needsRef = mode !== 'blink';

  const btn = 'p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 transition-colors disabled:opacity-40';
  const sel = 'px-2 py-1.5 rounded-lg bg-[#0b1224] border border-white/10 text-xs text-gray-200';

  return (
    <div className="flex flex-col gap-3" tabIndex={0} onKeyDown={onKey} aria-label={t('blink.viewer.aria')}>
      {/* Image */}
      <div
        ref={boxRef}
        className={`relative w-full aspect-square mx-auto rounded-xl overflow-hidden border border-white/10 bg-black cursor-crosshair ${compact ? '' : 'max-w-[min(100%,68vh)]'}`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ imageRendering: smooth ? 'auto' : 'pixelated' }}
        />
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
          {showTarget && tp && (
            <g stroke="#38bdf8" strokeWidth={Math.max(0.25, w / 260)} fill="none" opacity={0.9}>
              <circle cx={tp[0] + 0.5} cy={h - tp[1] - 0.5} r={markR} />
              <line x1={tp[0] + 0.5 - markR * 2} y1={h - tp[1] - 0.5} x2={tp[0] + 0.5 - markR * 1.2} y2={h - tp[1] - 0.5} />
              <line x1={tp[0] + 0.5 + markR * 1.2} y1={h - tp[1] - 0.5} x2={tp[0] + 0.5 + markR * 2} y2={h - tp[1] - 0.5} />
              <line x1={tp[0] + 0.5} y1={h - tp[1] - 0.5 - markR * 2} x2={tp[0] + 0.5} y2={h - tp[1] - 0.5 - markR * 1.2} />
              <line x1={tp[0] + 0.5} y1={h - tp[1] - 0.5 + markR * 1.2} x2={tp[0] + 0.5} y2={h - tp[1] - 0.5 + markR * 2} />
            </g>
          )}
          {scaleBarPx < w * 0.8 && (
            <line x1={w * 0.05} y1={h * 0.95} x2={w * 0.05 + scaleBarPx} y2={h * 0.95} stroke="white" strokeWidth={Math.max(0.3, w / 200)} />
          )}
        </svg>
        {/* Labels */}
        <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-black/70 text-[11px] font-mono text-white">
          {mode === 'blink' && <>{cur.meta.date.slice(0, 10)} · {idx + 1}/{frames.length}</>}
          {mode === 'difference' && <>{cur.meta.date.slice(0, 10)} − {ref.meta.date.slice(0, 10)}</>}
          {mode === 'motion' && <><span className="text-red-400">{ref.meta.date.slice(0, 10)}</span> / <span className="text-cyan-300">{cur.meta.date.slice(0, 10)}</span></>}
        </div>
        <div className="absolute top-2 right-2 px-1.5 py-1 rounded-md bg-black/60 text-[10px] font-mono text-gray-200 leading-tight text-center">
          <div>N ↑</div><div>← E</div>
        </div>
        {scaleBarPx < w * 0.8 && (
          <div className="absolute text-[10px] text-white font-mono" style={{ left: '5%', bottom: '6.5%' }}>1′</div>
        )}
        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-[10px] text-emerald-300">
          {t('blink.realData')}
        </div>
      </div>

      {/* Hover readout */}
      {!compact && (
        <div className="h-5 text-[11px] font-mono text-gray-400">
          {hoverWorld ? (
            <>RA {formatRA(hoverWorld[0])} · Dec {formatDec(hoverWorld[1])} · ({hover!.x}, {hover!.y}) · {Number.isFinite(hoverVal) ? `${hoverVal.toFixed(3)} MJy/sr` : 'NaN'}</>
          ) : (
            <span className="text-gray-600">{t('blink.viewer.hoverHint')}</span>
          )}
        </div>
      )}

      {/* Transport */}
      <div className="flex flex-wrap items-center gap-2">
        <button className={btn} onClick={() => step(-1)} disabled={frames.length < 2} title={t('blink.viewer.prev')}><SkipBack className="w-4 h-4" /></button>
        <button className={`${btn} px-3`} onClick={() => setPlaying((p) => !p)} disabled={frames.length < 2} title={t('blink.viewer.playPause')}>
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button className={btn} onClick={() => step(1)} disabled={frames.length < 2} title={t('blink.viewer.next')}><SkipForward className="w-4 h-4" /></button>
        <input
          type="range" min={0} max={Math.max(0, frames.length - 1)} value={idx}
          onChange={(e) => { setPlaying(false); setIdx(Number(e.target.value)); }}
          className="flex-1 min-w-[120px] accent-sky-400" aria-label={t('blink.viewer.frame')}
        />
        <label className="flex items-center gap-1.5 text-[11px] text-gray-400">
          {t('blink.viewer.speed')}
          <select className={sel} value={fps} onChange={(e) => setFps(Number(e.target.value))}>
            {[0.5, 1, 2, 4, 8].map((v) => <option key={v} value={v}>{v} fps</option>)}
          </select>
        </label>
      </div>

      {/* View options */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg overflow-hidden border border-white/10">
          {(['blink', 'difference', 'motion'] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); if (m !== 'blink' && idx === refIdx && frames.length > 1) setIdx(frames.length - 1); }}
              className={`px-3 py-1.5 text-xs ${mode === m ? 'bg-sky-500/20 text-sky-300' : 'bg-white/[0.03] text-gray-400 hover:text-gray-200'}`}
              title={t(`blink.viewer.modeHelp.${m}`)}
            >
              {t(`blink.viewer.modes.${m}`)}
            </button>
          ))}
        </div>
        {needsRef && (
          <label className="flex items-center gap-1.5 text-[11px] text-gray-400">
            {t('blink.viewer.reference')}
            <select className={sel} value={refIdx} onChange={(e) => setRefIdx(Number(e.target.value))}>
              {frames.map((f, i) => <option key={i} value={i}>{i + 1}. {f.meta.date.slice(0, 10)}</option>)}
            </select>
          </label>
        )}
        {!compact && (
          <>
            <select className={sel} value={stretch} onChange={(e) => setStretch(e.target.value as StretchKind)} aria-label={t('blink.viewer.stretch')}>
              {(['asinh', 'linear', 'sqrt', 'log'] as StretchKind[]).map((s) => <option key={s} value={s}>{t('blink.viewer.stretch')}: {s}</option>)}
            </select>
            <select className={sel} value={cmap} onChange={(e) => setCmap(e.target.value as ColorMapKind)} aria-label={t('blink.viewer.colormap')}>
              {(['gray', 'inferno', 'viridis', 'invert'] as ColorMapKind[]).map((s) => <option key={s} value={s}>{t('blink.viewer.colormap')}: {s}</option>)}
            </select>
          </>
        )}
        <button
          className={`${btn} text-xs flex items-center gap-1 ${showTarget ? 'text-sky-300' : ''}`}
          onClick={() => setShowTarget((v) => !v)} title={t('blink.viewer.targetMarker')}
        >
          <Crosshair className="w-3.5 h-3.5" />
        </button>
        <button
          className={`${btn} text-xs flex items-center gap-1 ${showMask ? 'text-fuchsia-300' : ''}`}
          onClick={() => setShowMask((v) => !v)} title={t('blink.viewer.maskOverlay')}
        >
          <Layers className="w-3.5 h-3.5" />
        </button>
        {!compact && (
          <label className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <input type="checkbox" checked={smooth} onChange={(e) => setSmooth(e.target.checked)} className="accent-sky-400" />
            {t('blink.viewer.smooth')}
          </label>
        )}
      </div>

      {!compact && (
        <div className="grid grid-cols-2 gap-3 text-[11px] text-gray-400">
          <label className="flex flex-col gap-1">
            {t('blink.viewer.black')}: {lowPct}%
            <input type="range" min={0} max={20} step={0.5} value={lowPct} onChange={(e) => setLowPct(Number(e.target.value))} className="accent-sky-400" />
          </label>
          <label className="flex flex-col gap-1">
            {t('blink.viewer.white')}: {highPct}%
            <input type="range" min={90} max={100} step={0.1} value={highPct} onChange={(e) => setHighPct(Number(e.target.value))} className="accent-sky-400" />
          </label>
        </div>
      )}

      {/* Filmstrip */}
      {frames.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {thumbs.map((src, i) => (
            <button
              key={i}
              onClick={() => { setPlaying(false); setIdx(i); }}
              className={`shrink-0 rounded-md overflow-hidden border-2 ${i === idx ? 'border-sky-400' : 'border-transparent opacity-70 hover:opacity-100'}`}
              title={frames[i].meta.date}
            >
              <img src={src} alt={frames[i].meta.date} className="w-14 h-14" style={{ imageRendering: 'pixelated' }} />
              <div className="text-[9px] text-gray-400 bg-black/60 px-1">{frames[i].meta.date.slice(0, 10)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
