import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Search, Sparkles, Link2, Code2, Download, ExternalLink, AlertTriangle, Satellite, Clock } from 'lucide-react';
import BlinkViewer from '../components/blink/BlinkViewer';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { spherexService } from '../services';
import {
  BlinkQuery, BlinkResult, DEFAULT_QUERY, DETECTOR_INFO, apiParams, errorText, formatDec, formatRA,
  queryFromParams, queryToParams,
} from '../lib/spherex';

interface Preset { id: string; name: string; note: string; detector: number; kind: string }

const FALLBACK_PRESETS: Preset[] = [
  { id: 'barnard', name: "Barnard's Star", note: '', detector: 3, kind: 'high_pm_star' },
  { id: 'eps-indi-b', name: 'Epsilon Indi B', note: '', detector: 4, kind: 'brown_dwarf_binary' },
  { id: 'wise-0855', name: 'WISE 0855-0714', note: '', detector: 6, kind: 'brown_dwarf' },
  { id: 'rw-aur', name: 'RW Aurigae', note: '', detector: 3, kind: 'variable_star' },
  { id: 'r-dra', name: 'R Draconis', note: '', detector: 3, kind: 'variable_star' },
];

const card = 'rounded-2xl border border-white/[0.08] bg-[#0a1020]/80 p-4';
const input = 'w-full px-3 py-2 rounded-lg bg-[#0b1224] border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-sky-500/60';

export default function BlinkPage() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => queryFromParams(params), [params]);

  const [form, setForm] = useState<BlinkQuery>(() => query ?? DEFAULT_QUERY);
  const [targetText, setTargetText] = useState(() => query?.target ?? (query?.ra !== undefined ? `${query.ra} ${query.dec}` : ''));
  const [presets, setPresets] = useState<Preset[]>(FALLBACK_PRESETS);
  const [result, setResult] = useState<BlinkResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [frameIdx, setFrameIdx] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    spherexService.targets().then((res) => {
      const list = res.data?.data?.targets;
      if (Array.isArray(list) && list.length) setPresets(list);
    }).catch(() => undefined);
  }, []);

  // URL is the source of truth: load whenever the query string changes.
  useEffect(() => {
    if (!query) { setResult(null); return; }
    setForm(query);
    setTargetText(query.target ?? (query.ra !== undefined ? `${query.ra} ${query.dec}` : ''));
    const ctrl = new AbortController();
    setLoading(true); setError(null); setElapsed(0);
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    spherexService.blink(apiParams(query), ctrl.signal)
      .then((res) => { setResult(res.data?.data ?? null); setFrameIdx(0); })
      .catch((e) => { if (!ctrl.signal.aborted) { setResult(null); setError(errorText(e, t('blink.errors.timeout'))); } })
      .finally(() => { window.clearInterval(timer); if (!ctrl.signal.aborted) setLoading(false); });
    return () => { ctrl.abort(); window.clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString(), i18n.language]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = targetText.trim();
    if (!text) { setError(t('blink.errors.empty')); return; }
    setParams(queryToParams({ ...form, target: text, ra: undefined, dec: undefined }));
  };

  const pickPreset = (p: Preset) => {
    setTargetText(p.name);
    setParams(queryToParams({ ...DEFAULT_QUERY, target: p.name, detector: String(p.detector) }));
  };

  const shareParams = query ? queryToParams(query) : {};
  const shareUrl = `${window.location.origin}/?${new URLSearchParams(shareParams)}`;
  const embedUrl = `${window.location.origin}/embed?${new URLSearchParams(shareParams)}`;
  const embedCode = `<iframe src="${embedUrl}" width="420" height="560" style="border:0" title="OrbitScope SPHEREx blink"></iframe>`;
  const gifUrl = query ? spherexService.gifUrl(apiParams(query)) : '';

  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); window.setTimeout(() => setCopied(null), 1500); }
    catch { window.prompt(t('blink.share.copyManual'), text); }
  };

  const frame = result?.frames[Math.min(frameIdx, (result?.frames.length ?? 1) - 1)];

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-sky-400" /> {t('blink.title')}
        </h1>
        <p className="text-sm text-gray-400 mt-1 max-w-3xl">{t('blink.subtitle')}</p>
      </div>

      {/* Search */}
      <form onSubmit={submit} className={`${card} space-y-3`}>
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className={`${input} pl-9`}
              value={targetText}
              onChange={(e) => setTargetText(e.target.value)}
              placeholder={t('blink.search.placeholder')}
              aria-label={t('blink.search.label')}
            />
          </div>
          <button type="submit" disabled={loading}
            className="px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-sm font-semibold text-[#04101f]">
            {t('blink.search.button')}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <label className="text-[11px] text-gray-400 flex flex-col gap-1">
            {t('blink.search.fov')}
            <select className={input} value={form.fov} onChange={(e) => setForm({ ...form, fov: Number(e.target.value) })}>
              {[0.05, 0.1, 0.2, 0.3, 0.5].map((v) => <option key={v} value={v}>{v}° ({Math.round(v * 60)}′)</option>)}
            </select>
          </label>
          <label className="text-[11px] text-gray-400 flex flex-col gap-1">
            {t('blink.search.detector')}
            <select className={input} value={form.detector} onChange={(e) => setForm({ ...form, detector: e.target.value })}>
              {['1', '2', '3', '4', '5', '6', 'all'].map((d) => (
                <option key={d} value={d}>{d === 'all' ? t('blink.search.allDetectors') : `D${d}`} · {DETECTOR_INFO[d]}</option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-gray-400 flex flex-col gap-1">
            {t('blink.search.mode')}
            <select className={input} value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as BlinkQuery['mode'] })}>
              <option value="epoch">{t('blink.search.modeEpoch')}</option>
              <option value="frames">{t('blink.search.modeFrames')}</option>
            </select>
          </label>
          {form.mode === 'epoch' ? (
            <label className="text-[11px] text-gray-400 flex flex-col gap-1">
              {t('blink.search.perEpoch')}
              <select className={input} value={form.per_epoch} onChange={(e) => setForm({ ...form, per_epoch: Number(e.target.value) })}>
                {[1, 2, 4, 6, 8, 12].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
          ) : (
            <label className="text-[11px] text-gray-400 flex flex-col gap-1">
              {t('blink.search.maxFrames')}
              <select className={input} value={form.max_frames} onChange={(e) => setForm({ ...form, max_frames: Number(e.target.value) })}>
                {[8, 16, 24, 32, 48].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-gray-500">{t('blink.search.tryTargets')}</span>
          {presets.map((p) => (
            <button type="button" key={p.id} onClick={() => pickPreset(p)}
              className="px-2.5 py-1 rounded-full text-[11px] border border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20"
              title={p.note}>
              {p.name}
            </button>
          ))}
        </div>
      </form>

      {/* States */}
      {loading && (
        <div className={card}>
          <LoadingSpinner text={t('blink.loading', { seconds: elapsed })} />
          <p className="text-center text-[11px] text-gray-500 -mt-8 pb-4">{t('blink.loadingHint')}</p>
        </div>
      )}

      {!loading && error && (
        <div className={`${card} border-red-500/30 flex items-start gap-3`}>
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <div className="text-sm text-red-200">{error}</div>
        </div>
      )}

      {!loading && !error && !result && (
        <div className={`${card} text-sm text-gray-300 space-y-2`}>
          <h2 className="text-white font-semibold">{t('blink.intro.title')}</h2>
          <ol className="list-decimal list-inside space-y-1 text-gray-400">
            <li>{t('blink.intro.step1')}</li>
            <li>{t('blink.intro.step2')}</li>
            <li>{t('blink.intro.step3')}</li>
          </ol>
          <p className="text-[11px] text-gray-500">{t('blink.intro.note')}</p>
        </div>
      )}

      {!loading && result && frame && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
          <div className={card}>
            <BlinkViewer result={result} onFrameChange={setFrameIdx} />
          </div>

          <div className="space-y-4">
            {/* Target */}
            <div className={card}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('blink.panels.target')}</h3>
              <div className="text-white font-semibold">{result.target.name || t('blink.panels.customPosition')}</div>
              <div className="text-xs font-mono text-gray-300 mt-1">
                {formatRA(result.target.center_ra)} {formatDec(result.target.center_dec)}
              </div>
              <div className="text-[11px] text-gray-500 font-mono">
                {result.target.center_ra.toFixed(5)}°, {result.target.center_dec.toFixed(5)}°
              </div>
              {result.target.pmra != null && result.target.pmdec != null && (
                <div className="text-[11px] text-gray-400 mt-1">
                  {t('blink.panels.properMotion')}: {(result.target.pmra / 1000).toFixed(2)}″/yr, {(result.target.pmdec / 1000).toFixed(2)}″/yr
                </div>
              )}
              {result.target.note && <p className="text-[11px] text-sky-300/80 mt-2">{result.target.note}</p>}
              <p className="text-[10px] text-gray-600 mt-2">{t('blink.panels.resolver')}: {result.target.resolver}</p>
            </div>

            {/* Current frame */}
            <div className={card}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> {t('blink.panels.frame', { n: frameIdx + 1, total: result.frames.length })}
              </h3>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                <dt className="text-gray-500">{t('blink.panels.date')}</dt>
                <dd className="text-gray-200 font-mono">{frame.date_start.slice(0, 10)}{frame.date_end.slice(0, 10) !== frame.date_start.slice(0, 10) ? ` → ${frame.date_end.slice(0, 10)}` : ''}</dd>
                <dt className="text-gray-500">{t('blink.panels.exposures')}</dt>
                <dd className="text-gray-200">{frame.n_frames}</dd>
                <dt className="text-gray-500">{t('blink.panels.detectors')}</dt>
                <dd className="text-gray-200">{frame.detectors.map((d) => `D${d}`).join(', ')}</dd>
                <dt className="text-gray-500">{t('blink.panels.wavelength')}</dt>
                <dd className="text-gray-200">{frame.wavelength_um ? `${frame.wavelength_um[0]}–${frame.wavelength_um[1]} µm` : '—'}</dd>
                <dt className="text-gray-500">{t('blink.panels.masked')}</dt>
                <dd className="text-gray-200">{(frame.masked_fraction * 100).toFixed(1)}%</dd>
              </dl>
              {Object.keys(frame.flags).length > 0 && (
                <div className="mt-3">
                  <div className="text-[11px] text-gray-500 mb-1">{t('blink.panels.flags')}</div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(frame.flags).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                      <span key={k} title={t(`blink.flagHelp.${k}`, { defaultValue: k })}
                        className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300">
                        {k} {(v * 100).toFixed(1)}%
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <details className="mt-3">
                <summary className="text-[11px] text-sky-400 cursor-pointer">{t('blink.panels.sourceFiles', { n: frame.members.length })}</summary>
                <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                  {frame.members.map((m) => (
                    <li key={`${m.obs_id}-${m.detector}`} className="text-[10px] font-mono text-gray-400 flex items-center gap-1">
                      <a href={m.url} target="_blank" rel="noreferrer" className="hover:text-sky-300 inline-flex items-center gap-1">
                        {m.obs_id} D{m.detector} <ExternalLink className="w-3 h-3" />
                      </a>
                      <span className="text-gray-600">{m.date.slice(0, 10)}{m.wavelength_center_um ? ` · ${m.wavelength_center_um.toFixed(3)} µm` : ''}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </div>

            {/* Coverage */}
            <div className={card}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Satellite className="w-3.5 h-3.5" /> {t('blink.panels.coverage')}
              </h3>
              <p className="text-[11px] text-gray-300">
                {t('blink.panels.coverageSummary', {
                  frames: result.coverage.total_frames, epochs: result.coverage.n_epochs,
                  from: result.coverage.date_min?.slice(0, 10), to: result.coverage.date_max?.slice(0, 10),
                })}
              </p>
              <div className="mt-2 grid grid-cols-6 gap-1">
                {['1', '2', '3', '4', '5', '6'].map((d) => (
                  <div key={d} className={`rounded-md px-1 py-1 text-center border ${result.detectors.includes(Number(d)) ? 'border-sky-500/40 bg-sky-500/10' : 'border-white/5 bg-white/[0.02]'}`}>
                    <div className="text-[10px] text-gray-400">D{d}</div>
                    <div className="text-xs text-white">{result.coverage.by_detector[d] ?? 0}</div>
                  </div>
                ))}
              </div>
              <ul className="mt-2 space-y-0.5">
                {result.coverage.epochs.map((ep, i) => (
                  <li key={i} className="text-[10px] text-gray-500 font-mono">
                    {t('blink.panels.epoch')} {i + 1}: {ep.start.slice(0, 10)} → {ep.end.slice(0, 10)} ({ep.n_frames})
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-gray-600 mt-2">{result.source}</p>
            </div>

            {/* Share */}
            <div className={card}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('blink.share.title')}</h3>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => copy(shareUrl, 'link')} className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-gray-200 hover:bg-white/10 flex items-center gap-1">
                  <Link2 className="w-3.5 h-3.5" /> {copied === 'link' ? t('blink.share.copied') : t('blink.share.copyLink')}
                </button>
                <button onClick={() => copy(embedCode, 'embed')} className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-gray-200 hover:bg-white/10 flex items-center gap-1">
                  <Code2 className="w-3.5 h-3.5" /> {copied === 'embed' ? t('blink.share.copied') : t('blink.share.copyEmbed')}
                </button>
                <a href={gifUrl} target="_blank" rel="noreferrer" className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-gray-200 hover:bg-white/10 flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" /> GIF
                </a>
              </div>
              <p className="text-[10px] text-gray-600 mt-2 break-all">{shareUrl}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
