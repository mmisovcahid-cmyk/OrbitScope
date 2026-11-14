import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ExternalLink, Orbit, Play } from 'lucide-react';
import BlinkViewer from './BlinkViewer';
import JobProgressBar from '../common/JobProgressBar';
import { JobProgress, isAbort, runJob } from '../../lib/jobs';
import { NeossatCoverage, NeossatResult, cadcObservationUrl } from '../../lib/neossat';
import { errorText } from '../../lib/spherex';
import api from '../../services/api';

interface Props {
  ra: number;
  dec: number;
  pmra?: number | null;
  pmdec?: number | null;
  refEpoch?: number | null;
  /** Mark visits within ±1 day of this MJD (e.g. a SPHEREx detection) as simultaneous. */
  highlightMjd?: number;
}

const card = 'rounded-2xl border border-white/[0.08] bg-[#0a1020]/80 p-4';
const sel = 'px-2 py-1.5 rounded-lg bg-[#0b1224] border border-white/10 text-xs text-gray-200';

const isoToMjd = (iso: string) => Date.parse(iso) / 86400000 + 40587;

/** NEOSSat (CSA) frames of the same position: coverage from CADC, then plate-solved blink frames. */
export default function NeossatPanel({ ra, dec, pmra, pmdec, refEpoch, highlightMjd }: Props) {
  const { t, i18n } = useTranslation();
  const [coverage, setCoverage] = useState<NeossatCoverage | null>(null);
  const [covError, setCovError] = useState<string | null>(null);
  const [covLoading, setCovLoading] = useState(false);
  const [mode, setMode] = useState<'visits' | 'frames'>('visits');
  const [visit, setVisit] = useState<number | ''>('');
  const [result, setResult] = useState<NeossatResult | null>(null);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frameIdx, setFrameIdx] = useState(0);
  const ctrlRef = useRef<AbortController | null>(null);

  const netError = (e: unknown) => errorText(e, t('blink.errors.timeout'), t('blink.errors.network', { url: api.defaults.baseURL }));

  // Coverage is one CADC TAP query (cached 6 h on the server), so it loads with the panel.
  useEffect(() => {
    let alive = true;
    setCoverage(null); setCovError(null); setResult(null); setError(null); setVisit('');
    setCovLoading(true);
    api.get('/api/v1/neossat/coverage', { params: { ra: Number(ra.toFixed(6)), dec: Number(dec.toFixed(6)), locale: i18n.language }, timeout: 120000 })
      .then((res) => { if (alive) setCoverage(res.data?.data ?? null); })
      .catch((e) => { if (alive) setCovError(netError(e)); })
      .finally(() => { if (alive) setCovLoading(false); });
    return () => { alive = false; ctrlRef.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ra, dec, i18n.language]);

  const simultaneous = useMemo(() => {
    if (!coverage || highlightMjd === undefined) return new Set<number>();
    return new Set(coverage.visits.filter((v) => Math.abs(isoToMjd(v.start) - highlightMjd) <= 1).map((v) => v.index));
  }, [coverage, highlightMjd]);

  const load = () => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setLoading(true); setError(null); setProgress(null);
    runJob<NeossatResult>('neossat_blink', {
      ra: Number(ra.toFixed(6)), dec: Number(dec.toFixed(6)),
      pmra: pmra ?? undefined, pmdec: pmdec ?? undefined, ref_epoch: refEpoch ?? undefined,
      fov: 0.1, mode, visit_index: mode === 'frames' && visit !== '' ? visit : undefined,
      max_frames: mode === 'frames' ? 16 : 12, per_visit: 5,
    }, setProgress, ctrl.signal)
      .then((res) => { setResult(res); setFrameIdx(0); })
      .catch((e) => { if (!isAbort(e) && !ctrl.signal.aborted) { setResult(null); setError(netError(e)); } })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
  };

  const frame = result?.frames[Math.min(frameIdx, result.frames.length - 1)];
  const rejectedByReason = useMemo(() => {
    const out: Record<string, number> = {};
    for (const r of result?.rejected ?? []) out[r.reason] = (out[r.reason] ?? 0) + 1;
    return out;
  }, [result]);

  return (
    <div className={`${card} space-y-3`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Orbit className="w-4 h-4 text-amber-300" /> {t('neossat.title')}
          </h3>
          <p className="text-[11px] text-gray-400 mt-1 max-w-3xl">{t('neossat.subtitle')}</p>
        </div>
        <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300">CSA · CADC</span>
      </div>

      {covLoading && <p className="text-xs text-gray-400">{t('neossat.checking')}</p>}
      {covError && (
        <div className="text-xs text-red-200 flex gap-2"><AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />{covError}</div>
      )}

      {coverage && coverage.total_frames === 0 && (
        <p className="text-xs text-gray-400">{t('neossat.noCoverage')}</p>
      )}

      {coverage && coverage.total_frames > 0 && (
        <>
          <p className="text-xs text-gray-300">
            {t('neossat.coverageSummary', {
              frames: coverage.total_frames, visits: coverage.n_visits,
              from: coverage.date_min?.slice(0, 10), to: coverage.date_max?.slice(0, 10),
            })}
          </p>
          <details>
            <summary className="text-[11px] text-sky-400 cursor-pointer">{t('neossat.visitList', { n: coverage.n_visits })}</summary>
            <ul className="mt-2 max-h-40 overflow-y-auto space-y-0.5">
              {coverage.visits.map((v) => (
                <li key={v.index} className="text-[10px] font-mono text-gray-400">
                  {v.index + 1}. {v.start.replace('T', ' ').slice(0, 16)} · {v.n_frames} × {v.exptime_s} s · {v.targets.join(', ') || '—'}
                  {simultaneous.has(v.index) && <span className="ml-2 text-emerald-300">{t('neossat.simultaneous')}</span>}
                </li>
              ))}
            </ul>
          </details>

          <div className="flex flex-wrap items-center gap-2">
            <select className={sel} value={mode} onChange={(e) => setMode(e.target.value as 'visits' | 'frames')} aria-label={t('neossat.mode')}>
              <option value="visits">{t('neossat.modeVisits')}</option>
              <option value="frames">{t('neossat.modeFrames')}</option>
            </select>
            {mode === 'frames' && (
              <select className={sel} value={visit} onChange={(e) => setVisit(e.target.value === '' ? '' : Number(e.target.value))} aria-label={t('neossat.visit')}>
                <option value="">{t('neossat.visitAuto')}</option>
                {coverage.visits.map((v) => (
                  <option key={v.index} value={v.index}>{v.index + 1}. {v.start.slice(0, 10)} ({v.n_frames})</option>
                ))}
              </select>
            )}
            <button onClick={load} disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-xs text-amber-200 hover:bg-amber-500/25 disabled:opacity-50 flex items-center gap-1">
              <Play className="w-3.5 h-3.5" /> {t('neossat.show')}
            </button>
          </div>
        </>
      )}

      {loading && (
        <JobProgressBar progress={progress} hint={t('neossat.loadingHint')}
          onCancel={() => { ctrlRef.current?.abort(); setLoading(false); setError(t('jobs.cancelled')); }} />
      )}
      {!loading && error && (
        <div className="text-xs text-red-200 flex gap-2"><AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />{error}</div>
      )}

      {!loading && result && frame && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-4">
          <BlinkViewer result={result} onFrameChange={setFrameIdx} />
          <div className="space-y-3 text-[11px]">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
              <dt className="text-gray-500">{t('blink.panels.date')}</dt>
              <dd className="text-gray-200 font-mono">{frame.date_start.replace('T', ' ').slice(0, 16)}</dd>
              <dt className="text-gray-500">{t('blink.panels.exposures')}</dt>
              <dd className="text-gray-200">{frame.n_frames}</dd>
              <dt className="text-gray-500">{t('blink.panels.wavelength')}</dt>
              <dd className="text-gray-200">0.4–0.9 µm</dd>
              <dt className="text-gray-500">{t('neossat.astrometry')}</dt>
              <dd className="text-gray-200">
                {Math.min(...frame.members.map((m) => m.astrometry.n_match))}+ {t('neossat.stars')} · ≤{Math.max(...frame.members.map((m) => m.astrometry.rms_arcsec)).toFixed(2)}″
              </dd>
            </dl>
            <details>
              <summary className="text-sky-400 cursor-pointer">{t('blink.panels.sourceFiles', { n: frame.members.length })}</summary>
              <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {frame.members.map((m) => (
                  <li key={m.obs_id} className="text-[10px] font-mono text-gray-400 flex flex-wrap items-center gap-x-2">
                    <a href={m.url} target="_blank" rel="noreferrer" className="hover:text-sky-300 inline-flex items-center gap-1">
                      {m.obs_id} <ExternalLink className="w-3 h-3" />
                    </a>
                    <a href={cadcObservationUrl(m.obs_id)} target="_blank" rel="noreferrer" className="text-gray-600 hover:text-sky-300">CADC</a>
                    <span className="text-gray-600">{m.astrometry.n_match}/{m.astrometry.n_stars} · {m.astrometry.rms_arcsec}″</span>
                  </li>
                ))}
              </ul>
            </details>
            {result.rejected.length > 0 && (
              <div>
                <div className="text-gray-500">{t('neossat.rejected', { n: result.rejected.length })}</div>
                <ul className="mt-1 space-y-0.5">
                  {Object.entries(rejectedByReason).map(([reason, n]) => (
                    <li key={reason} className="text-[10px] text-amber-300/90">{n} × {t(`neossat.reasons.${reason}`, { defaultValue: reason })}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-[10px] text-gray-500">{result.units}. {result.astrometry}.</p>
            <p className="text-[10px] text-gray-600">{result.source}</p>
          </div>
        </div>
      )}

      <p className="text-[10px] text-gray-600">{t('neossat.disclaimer')}</p>
    </div>
  );
}
